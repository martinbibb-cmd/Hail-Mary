/**
 * Log Observation Tool
 *
 * Logs raw observations from STT into the visit_observations table.
 */

import { db, visitObservations } from "../db";
import type { VisitObservation } from "@hail-mary/shared";

export interface LogObservationParams {
  visitSessionId: number;
  customerId: number;
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
    const { visitSessionId, customerId, text } = params;

    const [inserted] = await db
      .insert(visitObservations)
      .values({
        visitSessionId,
        customerId,
        text,
      })
      .returning();

    return {
      success: true,
      observation: {
        id: inserted.id,
        visitSessionId: inserted.visitSessionId,
        customerId: inserted.customerId,
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
