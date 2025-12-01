/**
 * Lead Routes - CRUD operations for leads
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db/schema';
import type { Lead, CreateLeadDto, UpdateLeadDto, ApiResponse, PaginatedResponse } from '@hail-mary/shared';

const router = Router();

// Helper to map database row to Lead object
function mapRowToLead(row: Record<string, unknown>): Lead {
  return {
    id: row.id as string,
    customerId: row.customer_id as string | undefined,
    source: row.source as string,
    status: row.status as Lead['status'],
    description: row.description as string,
    propertyType: row.property_type as string | undefined,
    estimatedValue: row.estimated_value as number | undefined,
    notes: row.notes as string | undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

// GET /leads - List all leads
router.get('/', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status as string;

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    const countResult = db.prepare(`SELECT COUNT(*) as total FROM leads ${whereClause}`).get(...params) as { total: number };
    const total = countResult.total;

    const rows = db.prepare(`
      SELECT * FROM leads 
      ${whereClause}
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as Record<string, unknown>[];

    db.close();

    const response: PaginatedResponse<Lead> = {
      success: true,
      data: rows.map(mapRowToLead),
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

// GET /leads/:id - Get single lead
router.get('/:id', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    db.close();

    if (!row) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Lead not found',
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<Lead> = {
      success: true,
      data: mapRowToLead(row),
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

// POST /leads - Create lead
router.post('/', (req: Request, res: Response) => {
  try {
    const dto: CreateLeadDto = req.body;
    const id = uuidv4();
    const now = new Date().toISOString();

    const db = getDatabase();
    db.prepare(`
      INSERT INTO leads (id, customer_id, source, status, description, property_type, 
        estimated_value, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      dto.customerId || null,
      dto.source,
      dto.status || 'new',
      dto.description,
      dto.propertyType || null,
      dto.estimatedValue || null,
      dto.notes || null,
      now,
      now
    );

    const row = db.prepare('SELECT * FROM leads WHERE id = ?').get(id) as Record<string, unknown>;
    db.close();

    const response: ApiResponse<Lead> = {
      success: true,
      data: mapRowToLead(row),
      message: 'Lead created successfully',
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

// PUT /leads/:id - Update lead
router.put('/:id', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const existing = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);

    if (!existing) {
      db.close();
      const response: ApiResponse<null> = {
        success: false,
        error: 'Lead not found',
      };
      return res.status(404).json(response);
    }

    const dto: UpdateLeadDto = req.body;
    const now = new Date().toISOString();

    const updates: string[] = [];
    const values: unknown[] = [];

    if (dto.customerId !== undefined) {
      updates.push('customer_id = ?');
      values.push(dto.customerId);
    }
    if (dto.source !== undefined) {
      updates.push('source = ?');
      values.push(dto.source);
    }
    if (dto.status !== undefined) {
      updates.push('status = ?');
      values.push(dto.status);
    }
    if (dto.description !== undefined) {
      updates.push('description = ?');
      values.push(dto.description);
    }
    if (dto.propertyType !== undefined) {
      updates.push('property_type = ?');
      values.push(dto.propertyType);
    }
    if (dto.estimatedValue !== undefined) {
      updates.push('estimated_value = ?');
      values.push(dto.estimatedValue);
    }
    if (dto.notes !== undefined) {
      updates.push('notes = ?');
      values.push(dto.notes);
    }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(req.params.id);

    db.prepare(`UPDATE leads SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const row = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id) as Record<string, unknown>;
    db.close();

    const response: ApiResponse<Lead> = {
      success: true,
      data: mapRowToLead(row),
      message: 'Lead updated successfully',
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

// DELETE /leads/:id - Delete lead
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);
    db.close();

    if (result.changes === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Lead not found',
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<null> = {
      success: true,
      message: 'Lead deleted successfully',
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
