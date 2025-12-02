/**
 * Lead Routes - CRUD operations for leads using Postgres/Drizzle
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/drizzle-client';
import { leads } from '../db/drizzle-schema';
import { eq, desc, count, and } from 'drizzle-orm';
import type { Lead, CreateLeadDto, UpdateLeadDto, ApiResponse, PaginatedResponse } from '@hail-mary/shared';

const router = Router();

// Helper to map database row to Lead object
function mapRowToLead(row: typeof leads.$inferSelect): Lead {
  return {
    id: String(row.id),
    customerId: row.customerId ? String(row.customerId) : undefined,
    source: row.source || '',
    status: row.status as Lead['status'],
    description: '', // Not in postgres schema, kept for API compatibility
    propertyType: undefined, // Not in postgres schema
    estimatedValue: undefined, // Not in postgres schema
    notes: row.notes || undefined,
    createdAt: row.createdAt,
    updatedAt: row.createdAt, // Use createdAt since updatedAt not in postgres schema
  };
}

// GET /leads - List all leads
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status as string;

    // Build conditions
    const conditions = [];
    if (status) conditions.push(eq(leads.status, status));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(leads)
        .where(whereClause)
        .orderBy(desc(leads.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(leads).where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;

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
    console.error('Error listing leads:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// GET /leads/:id - Get single lead
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Invalid lead ID',
      };
      return res.status(400).json(response);
    }

    const rows = await db
      .select()
      .from(leads)
      .where(eq(leads.id, id));

    if (rows.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Lead not found',
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<Lead> = {
      success: true,
      data: mapRowToLead(rows[0]),
    };
    res.json(response);
  } catch (error) {
    console.error('Error getting lead:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// POST /leads - Create lead
router.post('/', async (req: Request, res: Response) => {
  try {
    const dto: CreateLeadDto = req.body;

    const [inserted] = await db
      .insert(leads)
      .values({
        accountId: 1, // TODO: Get from auth context
        customerId: dto.customerId ? (typeof dto.customerId === 'number' ? dto.customerId : parseInt(dto.customerId)) : null,
        source: dto.source,
        status: dto.status || 'new',
        notes: dto.notes || null,
      })
      .returning();

    const response: ApiResponse<Lead> = {
      success: true,
      data: mapRowToLead(inserted),
      message: 'Lead created successfully',
    };
    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating lead:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// PUT /leads/:id - Update lead
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Invalid lead ID',
      };
      return res.status(400).json(response);
    }

    // Check if lead exists
    const existing = await db
      .select()
      .from(leads)
      .where(eq(leads.id, id));

    if (existing.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Lead not found',
      };
      return res.status(404).json(response);
    }

    const dto: UpdateLeadDto = req.body;

    // Build update object with only provided fields
    const updateData: Partial<{
      customerId: number | null;
      source: string | null;
      status: string;
      notes: string | null;
    }> = {};

    if (dto.customerId !== undefined) {
      updateData.customerId = dto.customerId ? (typeof dto.customerId === 'number' ? dto.customerId : parseInt(dto.customerId)) : null;
    }
    if (dto.source !== undefined) updateData.source = dto.source;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.notes !== undefined) updateData.notes = dto.notes || null;

    const [updated] = await db
      .update(leads)
      .set(updateData)
      .where(eq(leads.id, id))
      .returning();

    const response: ApiResponse<Lead> = {
      success: true,
      data: mapRowToLead(updated),
      message: 'Lead updated successfully',
    };
    res.json(response);
  } catch (error) {
    console.error('Error updating lead:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// DELETE /leads/:id - Delete lead
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Invalid lead ID',
      };
      return res.status(400).json(response);
    }

    const deleted = await db
      .delete(leads)
      .where(eq(leads.id, id))
      .returning();

    if (deleted.length === 0) {
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
    console.error('Error deleting lead:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

export default router;
