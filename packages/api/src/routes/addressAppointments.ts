/**
 * Address-based Appointments API Routes
 *
 * Permission-based appointment management + diary feed
 *
 * Endpoints:
 * - GET  /api/address-appointments?from=&to=&type=&status=&mine=   (diary feed with permissions)
 * - POST /api/addresses/:addressId/appointments                     (create appointment)
 * - GET  /api/address-appointments/:id                              (get appointment detail)
 * - PATCH /api/address-appointments/:id                             (update appointment)
 * - POST /api/address-appointments/:id/uploads                      (upload file with parsing)
 * - POST /api/address-appointments/:id/note-entries                 (paste text note)
 * - GET  /api/address-appointments/:id/note-entries                 (list note entries)
 */

import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "../db/drizzle-client";
import { addresses, appointments, appointmentNoteEntries, appointmentFiles } from "../db/drizzle-schema";
import { and, desc, eq, gte, lte, or, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.middleware";
import type { ApiResponse, PaginatedResponse } from "@hail-mary/shared";

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Multer setup for file uploads
const UPLOADS_DIR = process.env.APPOINTMENTS_UPLOADS_DIR || path.join(process.cwd(), "../../data/appointments");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const userId = req.user?.id;
      const userDir = path.join(UPLOADS_DIR, String(userId));
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }
      cb(null, userDir);
    },
    filename: (_req, file, cb) => {
      const uniqueName = `${Date.now()}-${file.originalname}`;
      cb(null, uniqueName);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

/**
 * Helper: Get accessible address IDs for user
 */
async function getAccessibleAddressIds(userId: number, isAdmin: boolean): Promise<string[]> {
  if (isAdmin) {
    // Admin sees all addresses
    const allAddresses = await db.select({ id: addresses.id }).from(addresses);
    return allAddresses.map(a => a.id);
  }

  // Non-admin sees only created/assigned addresses
  const accessibleAddresses = await db
    .select({ id: addresses.id })
    .from(addresses)
    .where(
      or(
        eq(addresses.createdByUserId, userId),
        eq(addresses.assignedUserId, userId)
      )
    );

  return accessibleAddresses.map(a => a.id);
}

/**
 * Helper: Check if user can access appointment
 */
async function canAccessAppointment(appointmentId: string, userId: number, isAdmin: boolean): Promise<boolean> {
  if (isAdmin) return true;

  const [appointment] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .limit(1);

  if (!appointment) return false;

  // User can access if they're assigned to the appointment
  if (appointment.assignedUserId === userId) return true;

  // Or if they have access to the parent address
  const [address] = await db
    .select()
    .from(addresses)
    .where(eq(addresses.id, appointment.addressId))
    .limit(1);

  if (!address) return false;

  return address.createdByUserId === userId || address.assignedUserId === userId;
}

/**
 * Helper: Parse text and create note entry
 */
async function createNoteEntry(
  appointmentId: string,
  sourceType: string,
  sourceName: string | null,
  rawText: string,
  userId: number
): Promise<void> {
  // Simple parsing: just format the note with timestamp and source
  const timestamp = new Date().toLocaleString('en-GB');
  const renderedNote = `[${timestamp}] ${sourceName || 'Note'}\n\n${rawText}\n\n---\n`;

  await db.insert(appointmentNoteEntries).values({
    appointmentId,
    sourceType,
    sourceName,
    rawText,
    parsedJson: null,
    renderedNote,
    createdByUserId: userId,
  });

  // Regenerate aggregated notes
  await regenerateAppointmentNotes(appointmentId);
}

/**
 * Helper: Regenerate appointment.notesRichText from all entries
 */
async function regenerateAppointmentNotes(appointmentId: string): Promise<void> {
  const entries = await db
    .select()
    .from(appointmentNoteEntries)
    .where(eq(appointmentNoteEntries.appointmentId, appointmentId))
    .orderBy(appointmentNoteEntries.createdAt);

  const aggregatedNotes = entries.map(e => e.renderedNote).join('\n');

  await db
    .update(appointments)
    .set({
      notesRichText: aggregatedNotes,
      updatedAt: new Date(),
    })
    .where(eq(appointments.id, appointmentId));
}

/**
 * GET /api/address-appointments?from=&to=&type=&status=&mine=
 * Diary feed with permissions
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const type = req.query.type as string | undefined;
    const status = req.query.status as string | undefined;
    const mine = req.query.mine === 'true';

    // Build filters
    const filters = [];

    // Date range filter
    if (from) {
      filters.push(gte(appointments.startAt, new Date(from)));
    }
    if (to) {
      filters.push(lte(appointments.startAt, new Date(to)));
    }

    // Type filter
    if (type) {
      filters.push(eq(appointments.type, type));
    }

    // Status filter
    if (status) {
      filters.push(eq(appointments.status, status));
    }

    // Permission filter
    if (!isAdmin || mine) {
      // Non-admin or admin viewing "mine only"
      const accessibleAddressIds = await getAccessibleAddressIds(userId, isAdmin && !mine);

      // Can see appointments where:
      // 1. Assigned to me, OR
      // 2. Address is accessible to me
      const permissionFilter = or(
        eq(appointments.assignedUserId, userId),
        ...(accessibleAddressIds.length > 0
          ? accessibleAddressIds.map(id => eq(appointments.addressId, id))
          : [sql`false`])
      );

      filters.push(permissionFilter);
    }

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    const rows = await db
      .select()
      .from(appointments)
      .where(whereClause)
      .orderBy(appointments.startAt)
      .limit(500); // Reasonable limit for diary view

    const response: ApiResponse<{ appointments: typeof rows }> = {
      success: true,
      data: { appointments: rows },
    };
    return res.json(response);
  } catch (error) {
    console.error("Error getting appointments:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * GET /api/address-appointments/:id
 * Get appointment detail
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const appointmentId = req.params.id;

    const hasAccess = await canAccessAppointment(appointmentId, userId, isAdmin);
    if (!hasAccess) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Appointment not found or access denied",
      };
      return res.status(404).json(response);
    }

    const [appointment] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, appointmentId))
      .limit(1);

    if (!appointment) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Appointment not found",
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<{ appointment: typeof appointment }> = {
      success: true,
      data: { appointment },
    };
    return res.json(response);
  } catch (error) {
    console.error("Error getting appointment:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * PATCH /api/address-appointments/:id
 * Update appointment
 */
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const appointmentId = req.params.id;

    const hasAccess = await canAccessAppointment(appointmentId, userId, isAdmin);
    if (!hasAccess) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Appointment not found or access denied",
      };
      return res.status(404).json(response);
    }

    const { type, status, startAt, endAt, assignedUserId } = req.body;

    const updates: any = {
      updatedAt: new Date(),
    };

    if (type !== undefined) updates.type = type;
    if (status !== undefined) updates.status = status;
    if (startAt !== undefined) updates.startAt = new Date(startAt);
    if (endAt !== undefined) updates.endAt = endAt ? new Date(endAt) : null;

    // Only admin can reassign
    if (isAdmin && assignedUserId !== undefined) {
      updates.assignedUserId = assignedUserId || null;
    }

    const [updated] = await db
      .update(appointments)
      .set(updates)
      .where(eq(appointments.id, appointmentId))
      .returning();

    const response: ApiResponse<{ appointment: typeof updated }> = {
      success: true,
      data: { appointment: updated },
      message: "Appointment updated successfully",
    };
    return res.json(response);
  } catch (error) {
    console.error("Error updating appointment:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * POST /api/address-appointments/:id/uploads
 * Upload file with parsing
 */
router.post("/:id/uploads", upload.single('file'), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const appointmentId = req.params.id;
    const file = req.file;

    if (!file) {
      const response: ApiResponse<null> = {
        success: false,
        error: "No file uploaded",
      };
      return res.status(400).json(response);
    }

    const hasAccess = await canAccessAppointment(appointmentId, userId, isAdmin);
    if (!hasAccess) {
      fs.unlinkSync(file.path);
      const response: ApiResponse<null> = {
        success: false,
        error: "Appointment not found or access denied",
      };
      return res.status(404).json(response);
    }

    // Store file metadata
    const [fileRecord] = await db
      .insert(appointmentFiles)
      .values({
        appointmentId,
        addressId: null, // Could link to address if needed
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storagePath: file.path,
        createdByUserId: userId,
      })
      .returning();

    // If text file, parse and create note entry
    const textMimeTypes = ['text/plain', 'text/markdown', 'application/json'];
    if (textMimeTypes.includes(file.mimetype.toLowerCase())) {
      const fileContents = fs.readFileSync(file.path, 'utf-8');
      await createNoteEntry(
        appointmentId,
        'TRANSCRIPT_FILE',
        file.originalname,
        fileContents,
        userId
      );
    } else {
      // Non-text file: create placeholder note entry
      await createNoteEntry(
        appointmentId,
        'FILE_UPLOAD',
        file.originalname,
        `[File uploaded: ${file.originalname} (${(file.size / 1024).toFixed(1)} KB)]`,
        userId
      );
    }

    const response: ApiResponse<{ file: typeof fileRecord }> = {
      success: true,
      data: { file: fileRecord },
      message: "File uploaded and processed successfully",
    };
    return res.status(201).json(response);
  } catch (error) {
    console.error("Error uploading file:", error);
    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error("Error cleaning up file:", cleanupError);
      }
    }
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * POST /api/address-appointments/:id/note-entries
 * Paste text note
 */
router.post("/:id/note-entries", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const appointmentId = req.params.id;
    const { text, label } = req.body;

    if (!text) {
      const response: ApiResponse<null> = {
        success: false,
        error: "text is required",
      };
      return res.status(400).json(response);
    }

    const hasAccess = await canAccessAppointment(appointmentId, userId, isAdmin);
    if (!hasAccess) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Appointment not found or access denied",
      };
      return res.status(404).json(response);
    }

    await createNoteEntry(
      appointmentId,
      'TEXT_PASTE',
      label || 'Pasted Note',
      text,
      userId
    );

    const response: ApiResponse<{ success: boolean }> = {
      success: true,
      data: { success: true },
      message: "Note added successfully",
    };
    return res.status(201).json(response);
  } catch (error) {
    console.error("Error creating note entry:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * POST /api/addresses/:addressId/appointments
 * Create appointment for address
 */
router.post("/addresses/:addressId/appointments", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const addressId = req.params.addressId;

    // Check address access
    const accessibleAddressIds = await getAccessibleAddressIds(userId, isAdmin);
    if (!accessibleAddressIds.includes(addressId)) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Address not found or access denied",
      };
      return res.status(404).json(response);
    }

    const { type, status, startAt, endAt, assignedUserId, notes } = req.body;

    if (!type || !startAt) {
      const response: ApiResponse<null> = {
        success: false,
        error: "type and startAt are required",
      };
      return res.status(400).json(response);
    }

    // Only admin can assign to other users
    const finalAssignedUserId = isAdmin && assignedUserId ? assignedUserId : userId;

    const [inserted] = await db
      .insert(appointments)
      .values({
        addressId,
        type,
        status: status || 'PLANNED',
        startAt: new Date(startAt),
        endAt: endAt ? new Date(endAt) : null,
        createdByUserId: userId,
        assignedUserId: finalAssignedUserId,
        notesRichText: notes?.trim() || null,
      })
      .returning();

    const response: ApiResponse<{ appointment: typeof inserted }> = {
      success: true,
      data: { appointment: inserted },
      message: "Appointment created successfully",
    };
    return res.status(201).json(response);
  } catch (error) {
    console.error("Error creating appointment:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * GET /api/address-appointments/:id/note-entries
 * List note entries
 */
router.get("/:id/note-entries", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const appointmentId = req.params.id;

    const hasAccess = await canAccessAppointment(appointmentId, userId, isAdmin);
    if (!hasAccess) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Appointment not found or access denied",
      };
      return res.status(404).json(response);
    }

    const entries = await db
      .select()
      .from(appointmentNoteEntries)
      .where(eq(appointmentNoteEntries.appointmentId, appointmentId))
      .orderBy(appointmentNoteEntries.createdAt);

    const response: ApiResponse<{ entries: typeof entries }> = {
      success: true,
      data: { entries },
    };
    return res.json(response);
  } catch (error) {
    console.error("Error getting note entries:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

export default router;
