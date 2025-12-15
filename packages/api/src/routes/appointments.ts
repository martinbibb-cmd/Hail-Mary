/**
 * Appointment Routes - CRUD operations for appointments using Postgres/Drizzle
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/drizzle-client';
import { appointments, leads } from '../db/drizzle-schema';
import { eq, desc, count, and } from 'drizzle-orm';
import type { Appointment, CreateAppointmentDto, UpdateAppointmentDto, ApiResponse, PaginatedResponse } from '@hail-mary/shared';

const router = Router();

// Helper to map database row to Appointment object
function mapRowToAppointment(row: typeof appointments.$inferSelect): Appointment {
  return {
    id: String(row.id),
    leadId: String(row.leadId),
    quoteId: row.quoteId ? String(row.quoteId) : undefined,
    type: row.type as Appointment['type'],
    status: row.status as Appointment['status'],
    scheduledAt: row.scheduledAt,
    duration: row.duration,
    address: {
      line1: row.addressLine1 || '',
      line2: row.addressLine2 || undefined,
      city: row.city || '',
      postcode: row.postcode || '',
      country: row.country || 'UK',
    },
    notes: row.notes || undefined,
    assignedTo: row.assignedTo || undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// GET /appointments - List all appointments
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const type = req.query.type as string;
    const status = req.query.status as string;
    const leadId = req.query.leadId as string;

    // Build conditions
    const conditions = [];
    if (type) conditions.push(eq(appointments.type, type));
    if (status) conditions.push(eq(appointments.status, status));
    if (leadId) conditions.push(eq(appointments.leadId, parseInt(leadId)));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(appointments)
        .where(whereClause)
        .orderBy(appointments.scheduledAt)
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(appointments).where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;

    const response: PaginatedResponse<Appointment> = {
      success: true,
      data: rows.map(mapRowToAppointment),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    res.json(response);
  } catch (error) {
    console.error('Error listing appointments:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// GET /appointments/:id - Get single appointment
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Invalid appointment ID',
      };
      return res.status(400).json(response);
    }

    const rows = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, id));

    if (rows.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Appointment not found',
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<Appointment> = {
      success: true,
      data: mapRowToAppointment(rows[0]),
    };
    res.json(response);
  } catch (error) {
    console.error('Error getting appointment:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// POST /appointments - Create appointment
router.post('/', async (req: Request, res: Response) => {
  try {
    const dto: CreateAppointmentDto = req.body;
    const leadIdNum = typeof dto.leadId === 'number' ? dto.leadId : parseInt(String(dto.leadId));

    // Verify lead exists
    const lead = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadIdNum));

    if (lead.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Lead not found',
      };
      return res.status(400).json(response);
    }

    const quoteIdNum = dto.quoteId ? (typeof dto.quoteId === 'number' ? dto.quoteId : parseInt(String(dto.quoteId))) : null;

    const [inserted] = await db
      .insert(appointments)
      .values({
        accountId: 1, // TODO: Get from auth context
        leadId: leadIdNum,
        quoteId: quoteIdNum,
        type: dto.type,
        status: dto.status || 'scheduled',
        scheduledAt: new Date(dto.scheduledAt),
        duration: dto.duration,
        addressLine1: dto.address.line1,
        addressLine2: dto.address.line2 || null,
        city: dto.address.city,
        postcode: dto.address.postcode,
        country: dto.address.country,
        notes: dto.notes || null,
        assignedTo: dto.assignedTo || null,
      })
      .returning();

    const response: ApiResponse<Appointment> = {
      success: true,
      data: mapRowToAppointment(inserted),
      message: 'Appointment created successfully',
    };
    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating appointment:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// PUT /appointments/:id - Update appointment
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Invalid appointment ID',
      };
      return res.status(400).json(response);
    }

    // Check if appointment exists
    const existing = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, id));

    if (existing.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Appointment not found',
      };
      return res.status(404).json(response);
    }

    const dto: UpdateAppointmentDto = req.body;

    // Build update object with only provided fields
    const updateData: Partial<{
      quoteId: number | null;
      type: string;
      status: string;
      scheduledAt: Date;
      duration: number;
      addressLine1: string | null;
      addressLine2: string | null;
      city: string | null;
      postcode: string | null;
      country: string | null;
      notes: string | null;
      assignedTo: string | null;
      updatedAt: Date;
    }> = {
      updatedAt: new Date(),
    };

    if (dto.quoteId !== undefined) {
      updateData.quoteId = dto.quoteId ? (typeof dto.quoteId === 'number' ? dto.quoteId : parseInt(dto.quoteId)) : null;
    }
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.scheduledAt !== undefined) updateData.scheduledAt = new Date(dto.scheduledAt);
    if (dto.duration !== undefined) updateData.duration = dto.duration;
    if (dto.address?.line1 !== undefined) updateData.addressLine1 = dto.address.line1;
    if (dto.address?.line2 !== undefined) updateData.addressLine2 = dto.address.line2 || null;
    if (dto.address?.city !== undefined) updateData.city = dto.address.city;
    if (dto.address?.postcode !== undefined) updateData.postcode = dto.address.postcode;
    if (dto.address?.country !== undefined) updateData.country = dto.address.country;
    if (dto.notes !== undefined) updateData.notes = dto.notes || null;
    if (dto.assignedTo !== undefined) updateData.assignedTo = dto.assignedTo || null;

    const [updated] = await db
      .update(appointments)
      .set(updateData)
      .where(eq(appointments.id, id))
      .returning();

    const response: ApiResponse<Appointment> = {
      success: true,
      data: mapRowToAppointment(updated),
      message: 'Appointment updated successfully',
    };
    res.json(response);
  } catch (error) {
    console.error('Error updating appointment:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// DELETE /appointments/:id - Delete appointment
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Invalid appointment ID',
      };
      return res.status(400).json(response);
    }

    const deleted = await db
      .delete(appointments)
      .where(eq(appointments.id, id))
      .returning();

    if (deleted.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Appointment not found',
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<null> = {
      success: true,
      message: 'Appointment deleted successfully',
    };
    res.json(response);
  } catch (error) {
    console.error('Error deleting appointment:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

export default router;
