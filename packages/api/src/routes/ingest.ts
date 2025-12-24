/**
 * Ingest Routes
 *
 * Companion app -> Atlas ingest endpoints.
 *
 * - POST /api/ingest/transcript
 */

import { Router, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/drizzle-client";
import { spineProperties, spineTimelineEvents, spineVisits } from "../db/drizzle-schema";

const router = Router();

const normalizePostcodeForStorage = (input: unknown): string => {
  if (typeof input !== "string") return "";
  // Spine stores postcode normalized (uppercase, no spaces)
  return input.toUpperCase().replace(/\s+/g, "").trim();
};

const normalizeAddressLine1ForMatch = (input: unknown): string => {
  if (typeof input !== "string") return "";
  return input.trim().replace(/\s+/g, " ").toLowerCase();
};

const parseDateOrNow = (input: unknown): Date => {
  if (typeof input !== "string") return new Date();
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? new Date() : d;
};

type IngestTranscriptBody = {
  source?: unknown;
  externalId?: unknown;
  occurredAt?: unknown;
  visitId?: unknown;
  property?: {
    postcode?: unknown;
    addressLine1?: unknown;
    town?: unknown;
  };
  transcriptText?: unknown;
  meta?: unknown;
};

// POST /api/ingest/transcript
router.post("/transcript", async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as IngestTranscriptBody;

    const source = typeof body.source === "string" && body.source.trim() ? body.source.trim() : null;
    if (!source) return res.status(400).json({ success: false, error: "source is required" });

    const externalId =
      typeof body.externalId === "string" && body.externalId.trim() ? body.externalId.trim() : null;

    const transcriptText =
      typeof body.transcriptText === "string" && body.transcriptText.trim()
        ? body.transcriptText
        : null;
    if (!transcriptText) return res.status(400).json({ success: false, error: "transcriptText is required" });

    const occurredAt = parseDateOrNow(body.occurredAt);

    const visitId =
      typeof body.visitId === "string" && body.visitId.trim() ? body.visitId.trim() : null;

    const meta = body.meta && typeof body.meta === "object" ? body.meta : undefined;

    const result = await db.transaction(async (tx) => {
      // 1) If externalId already exists -> idempotent OK
      if (externalId) {
        const existing = await tx
          .select({
            eventId: spineTimelineEvents.id,
            visitId: spineTimelineEvents.visitId,
            propertyId: spineVisits.propertyId,
          })
          .from(spineTimelineEvents)
          .innerJoin(spineVisits, eq(spineTimelineEvents.visitId, spineVisits.id))
          .where(eq(spineTimelineEvents.externalId, externalId))
          .limit(1);

        if (existing[0]) return existing[0];
      }

      // 2) If visitId provided -> attach to that visit
      if (visitId) {
        const rows = await tx
          .select({ visitId: spineVisits.id, propertyId: spineVisits.propertyId })
          .from(spineVisits)
          .where(eq(spineVisits.id, visitId))
          .limit(1);
        if (!rows[0]) {
          // Keeping this 404 to match existing API patterns (e.g. spine photo event)
          throw Object.assign(new Error("Visit not found"), { statusCode: 404 });
        }

        const inserted = await tx
          .insert(spineTimelineEvents)
          .values({
            visitId: rows[0].visitId,
            type: "transcript",
            ts: occurredAt,
            externalId,
            payload: {
              text: transcriptText,
              meta,
              source,
            },
          })
          .returning({ eventId: spineTimelineEvents.id });

        return { propertyId: rows[0].propertyId, visitId: rows[0].visitId, eventId: inserted[0].eventId };
      }

      // 3) Else resolve/create property and create a new visit
      const postcodeNorm = normalizePostcodeForStorage(body.property?.postcode);
      const addrNorm = normalizeAddressLine1ForMatch(body.property?.addressLine1);
      const addrTrimmed =
        typeof body.property?.addressLine1 === "string" ? body.property.addressLine1.trim().replace(/\s+/g, " ") : "";

      if (!postcodeNorm) throw Object.assign(new Error("property.postcode is required when visitId is not provided"), { statusCode: 400 });
      if (!addrTrimmed) throw Object.assign(new Error("property.addressLine1 is required when visitId is not provided"), { statusCode: 400 });

      // Postcode-first query, then case/space-normalised address match in JS.
      const candidates = await tx
        .select()
        .from(spineProperties)
        .where(eq(spineProperties.postcode, postcodeNorm))
        .limit(200);

      let propertyIdResolved: string | null = null;
      for (const p of candidates) {
        if (normalizeAddressLine1ForMatch(p.addressLine1) === addrNorm) {
          propertyIdResolved = p.id;
          break;
        }
      }

      if (!propertyIdResolved) {
        const town = typeof body.property?.town === "string" && body.property.town.trim() ? body.property.town.trim() : null;
        const [created] = await tx
          .insert(spineProperties)
          .values({
            addressLine1: addrTrimmed,
            town,
            postcode: postcodeNorm,
          })
          .returning({ id: spineProperties.id });
        propertyIdResolved = created.id;
      }

      const [createdVisit] = await tx
        .insert(spineVisits)
        .values({ propertyId: propertyIdResolved })
        .returning({ id: spineVisits.id });

      // 4) Insert TimelineEvent(type="transcript") with idempotency on externalId.
      if (externalId) {
        const inserted = await tx
          .insert(spineTimelineEvents)
          .values({
            visitId: createdVisit.id,
            type: "transcript",
            ts: occurredAt,
            externalId,
            payload: {
              text: transcriptText,
              meta,
              source,
            },
          })
          .onConflictDoNothing({ target: spineTimelineEvents.externalId })
          .returning({ eventId: spineTimelineEvents.id, visitId: spineTimelineEvents.visitId });

        if (inserted[0]) {
          return { propertyId: propertyIdResolved, visitId: inserted[0].visitId, eventId: inserted[0].eventId };
        }

        // Conflict (another request inserted first) -> return existing within the same transaction.
        const existing = await tx
          .select({
            eventId: spineTimelineEvents.id,
            visitId: spineTimelineEvents.visitId,
            propertyId: spineVisits.propertyId,
          })
          .from(spineTimelineEvents)
          .innerJoin(spineVisits, eq(spineTimelineEvents.visitId, spineVisits.id))
          .where(eq(spineTimelineEvents.externalId, externalId))
          .limit(1);

        if (existing[0]) return existing[0];

        throw new Error("Idempotency conflict without existing event (unexpected)");
      }

      const [event] = await tx
        .insert(spineTimelineEvents)
        .values({
          visitId: createdVisit.id,
          type: "transcript",
          ts: occurredAt,
          payload: {
            text: transcriptText,
            meta,
            source,
          },
        })
        .returning({ eventId: spineTimelineEvents.id });

      return { propertyId: propertyIdResolved, visitId: createdVisit.id, eventId: event.eventId };
    });

    return res.status(200).json({
      success: true,
      data: {
        propertyId: result.propertyId,
        visitId: result.visitId,
        eventId: result.eventId,
      },
    });
  } catch (error) {
    const statusCode =
      typeof (error as any)?.statusCode === "number" ? (error as any).statusCode : 500;

    if (statusCode >= 500) console.error("Error ingesting transcript:", error);
    return res.status(statusCode).json({ success: false, error: (error as Error).message });
  }
});

export default router;

