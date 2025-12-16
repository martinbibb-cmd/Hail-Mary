/**
 * Lead Routes - CRUD operations for leads using Postgres/Drizzle
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/drizzle-client';
import { leads } from '../db/drizzle-schema';
import { eq, desc, count, and } from 'drizzle-orm';
import { requireAuth, blockGuest } from '../middleware/auth.middleware';
import type { Lead, CreateLeadDto, UpdateLeadDto, ApiResponse, PaginatedResponse } from '@hail-mary/shared';

const router = Router();

// Apply authentication middleware to all lead routes
router.use(requireAuth);
// Block guest users from accessing lead data
router.use(blockGuest);

// Helper to map database row to Lead object
function mapRowToLead(row: typeof leads.$inferSelect): Lead {
  return {
    id: String(row.id),
    accountId: row.accountId,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email || undefined,
    phone: row.phone || undefined,
    address: {
      line1: row.addressLine1 || '',
      line2: row.addressLine2 || undefined,
      city: row.city || '',
      postcode: row.postcode || '',
      country: row.country || 'UK',
    },
    source: row.source || undefined,
    status: row.status as Lead['status'],
    description: row.description || undefined,
    propertyType: row.propertyType || undefined,
    estimatedValue: row.estimatedValue ? Number(row.estimatedValue) : undefined,
    notes: row.notes || undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
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
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email || null,
        phone: dto.phone || null,
        addressLine1: dto.address?.line1 || null,
        addressLine2: dto.address?.line2 || null,
        city: dto.address?.city || null,
        postcode: dto.address?.postcode || null,
        country: dto.address?.country || 'UK',
        source: dto.source || null,
        status: dto.status || 'new',
        description: dto.description || null,
        propertyType: dto.propertyType || null,
        estimatedValue: dto.estimatedValue ? String(dto.estimatedValue) : null,
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
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (dto.firstName !== undefined) updateData.firstName = dto.firstName;
    if (dto.lastName !== undefined) updateData.lastName = dto.lastName;
    if (dto.email !== undefined) updateData.email = dto.email || null;
    if (dto.phone !== undefined) updateData.phone = dto.phone || null;
    if (dto.address?.line1 !== undefined) updateData.addressLine1 = dto.address.line1 || null;
    if (dto.address?.line2 !== undefined) updateData.addressLine2 = dto.address.line2 || null;
    if (dto.address?.city !== undefined) updateData.city = dto.address.city || null;
    if (dto.address?.postcode !== undefined) updateData.postcode = dto.address.postcode || null;
    if (dto.address?.country !== undefined) updateData.country = dto.address.country || null;
    if (dto.source !== undefined) updateData.source = dto.source || null;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.description !== undefined) updateData.description = dto.description || null;
    if (dto.propertyType !== undefined) updateData.propertyType = dto.propertyType || null;
    if (dto.estimatedValue !== undefined) updateData.estimatedValue = dto.estimatedValue ? String(dto.estimatedValue) : null;
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
