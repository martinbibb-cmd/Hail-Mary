/**
 * Appointment Routes - CRUD operations for appointments
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db/schema';
import type { Appointment, CreateAppointmentDto, UpdateAppointmentDto, ApiResponse, PaginatedResponse } from '@hail-mary/shared';

const router = Router();

// Helper to map database row to Appointment object
function mapRowToAppointment(row: Record<string, unknown>): Appointment {
  return {
    id: row.id as string,
    customerId: row.customer_id as string,
    quoteId: row.quote_id as string | undefined,
    type: row.type as Appointment['type'],
    status: row.status as Appointment['status'],
    scheduledAt: new Date(row.scheduled_at as string),
    duration: row.duration as number,
    address: {
      line1: row.address_line1 as string,
      line2: row.address_line2 as string | undefined,
      city: row.address_city as string,
      postcode: row.address_postcode as string,
      country: row.address_country as string,
    },
    notes: row.notes as string | undefined,
    assignedTo: row.assigned_to as string | undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

// GET /appointments - List all appointments
router.get('/', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const type = req.query.type as string;
    const status = req.query.status as string;
    const customerId = req.query.customerId as string;

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];

    if (type) {
      whereClause += ' AND type = ?';
      params.push(type);
    }
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    if (customerId) {
      whereClause += ' AND customer_id = ?';
      params.push(customerId);
    }

    const countResult = db.prepare(`SELECT COUNT(*) as total FROM appointments ${whereClause}`).get(...params) as { total: number };
    const total = countResult.total;

    const rows = db.prepare(`
      SELECT * FROM appointments 
      ${whereClause}
      ORDER BY scheduled_at ASC 
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as Record<string, unknown>[];

    db.close();

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
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// GET /appointments/:id - Get single appointment
router.get('/:id', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    db.close();

    if (!row) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Appointment not found',
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<Appointment> = {
      success: true,
      data: mapRowToAppointment(row),
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// POST /appointments - Create appointment
router.post('/', (req: Request, res: Response) => {
  try {
    const dto: CreateAppointmentDto = req.body;
    const id = uuidv4();
    const now = new Date().toISOString();

    const db = getDatabase();
    
    // Verify customer exists
    const customer = db.prepare('SELECT id FROM customers WHERE id = ?').get(dto.customerId);
    if (!customer) {
      db.close();
      const response: ApiResponse<null> = {
        success: false,
        error: 'Customer not found',
      };
      return res.status(400).json(response);
    }

    db.prepare(`
      INSERT INTO appointments (id, customer_id, quote_id, type, status, scheduled_at, duration,
        address_line1, address_line2, address_city, address_postcode, address_country, 
        notes, assigned_to, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      dto.customerId,
      dto.quoteId || null,
      dto.type,
      dto.status || 'scheduled',
      new Date(dto.scheduledAt).toISOString(),
      dto.duration,
      dto.address.line1,
      dto.address.line2 || null,
      dto.address.city,
      dto.address.postcode,
      dto.address.country,
      dto.notes || null,
      dto.assignedTo || null,
      now,
      now
    );

    const row = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id) as Record<string, unknown>;
    db.close();

    const response: ApiResponse<Appointment> = {
      success: true,
      data: mapRowToAppointment(row),
      message: 'Appointment created successfully',
    };
    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// PUT /appointments/:id - Update appointment
router.put('/:id', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const existing = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);

    if (!existing) {
      db.close();
      const response: ApiResponse<null> = {
        success: false,
        error: 'Appointment not found',
      };
      return res.status(404).json(response);
    }

    const dto: UpdateAppointmentDto = req.body;
    const now = new Date().toISOString();

    const updates: string[] = [];
    const values: unknown[] = [];

    if (dto.quoteId !== undefined) {
      updates.push('quote_id = ?');
      values.push(dto.quoteId);
    }
    if (dto.type !== undefined) {
      updates.push('type = ?');
      values.push(dto.type);
    }
    if (dto.status !== undefined) {
      updates.push('status = ?');
      values.push(dto.status);
    }
    if (dto.scheduledAt !== undefined) {
      updates.push('scheduled_at = ?');
      values.push(new Date(dto.scheduledAt).toISOString());
    }
    if (dto.duration !== undefined) {
      updates.push('duration = ?');
      values.push(dto.duration);
    }
    if (dto.address?.line1 !== undefined) {
      updates.push('address_line1 = ?');
      values.push(dto.address.line1);
    }
    if (dto.address?.line2 !== undefined) {
      updates.push('address_line2 = ?');
      values.push(dto.address.line2);
    }
    if (dto.address?.city !== undefined) {
      updates.push('address_city = ?');
      values.push(dto.address.city);
    }
    if (dto.address?.postcode !== undefined) {
      updates.push('address_postcode = ?');
      values.push(dto.address.postcode);
    }
    if (dto.address?.country !== undefined) {
      updates.push('address_country = ?');
      values.push(dto.address.country);
    }
    if (dto.notes !== undefined) {
      updates.push('notes = ?');
      values.push(dto.notes);
    }
    if (dto.assignedTo !== undefined) {
      updates.push('assigned_to = ?');
      values.push(dto.assignedTo);
    }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(req.params.id);

    db.prepare(`UPDATE appointments SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const row = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id) as Record<string, unknown>;
    db.close();

    const response: ApiResponse<Appointment> = {
      success: true,
      data: mapRowToAppointment(row),
      message: 'Appointment updated successfully',
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// DELETE /appointments/:id - Delete appointment
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM appointments WHERE id = ?').run(req.params.id);
    db.close();

    if (result.changes === 0) {
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
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

export default router;
