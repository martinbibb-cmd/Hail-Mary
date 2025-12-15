/**
 * Log Observation Tool
 *
 * Logs raw observations from STT into the visit_observations table.
 */

import { db, visitObservations } from "../db";
import type { VisitObservation } from "@hail-mary/shared";

export interface LogObservationParams {
  visitSessionId: number;
  leadId: number;
  text: string;
}

export interface LogObservationResult {
  success: boolean;
  observation?: VisitObservation;
  error?: string;
}

/**
 * Logs an observation from STT into the database.
 */
export async function logObservation(
  params: LogObservationParams
): Promise<LogObservationResult> {
  try {
    const { visitSessionId, leadId, text } = params;

    const [inserted] = await db
      .insert(visitObservations)
      .values({
        visitSessionId,
        leadId,
        text,
      })
      .returning();

    return {
      success: true,
      observation: {
        id: inserted.id,
        visitSessionId: inserted.visitSessionId,
        leadId: inserted.leadId,
        text: inserted.text,
        createdAt: inserted.createdAt,
      },
    };
  } catch (error) {
    console.error("Failed to log observation:", error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}
