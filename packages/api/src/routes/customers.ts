/**
 * Customer Routes - CRUD operations for customers
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db/schema';
import type { Customer, CreateCustomerDto, UpdateCustomerDto, ApiResponse, PaginatedResponse } from '@hail-mary/shared';

const router = Router();

// Helper to map database row to Customer object
function mapRowToCustomer(row: Record<string, unknown>): Customer {
  return {
    id: row.id as string,
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    email: row.email as string,
    phone: row.phone as string,
    address: {
      line1: row.address_line1 as string,
      line2: row.address_line2 as string | undefined,
      city: row.address_city as string,
      postcode: row.address_postcode as string,
      country: row.address_country as string,
    },
    notes: row.notes as string | undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

// GET /customers - List all customers
router.get('/', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const countResult = db.prepare('SELECT COUNT(*) as total FROM customers').get() as { total: number };
    const total = countResult.total;

    const rows = db.prepare(`
      SELECT * FROM customers 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `).all(limit, offset) as Record<string, unknown>[];

    db.close();

    const response: PaginatedResponse<Customer> = {
      success: true,
      data: rows.map(mapRowToCustomer),
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

// GET /customers/:id - Get single customer
router.get('/:id', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    db.close();

    if (!row) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Customer not found',
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<Customer> = {
      success: true,
      data: mapRowToCustomer(row),
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

// POST /customers - Create customer
router.post('/', (req: Request, res: Response) => {
  try {
    const dto: CreateCustomerDto = req.body;
    const id = uuidv4();
    const now = new Date().toISOString();

    const db = getDatabase();
    db.prepare(`
      INSERT INTO customers (id, first_name, last_name, email, phone, 
        address_line1, address_line2, address_city, address_postcode, address_country,
        notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      dto.firstName,
      dto.lastName,
      dto.email,
      dto.phone,
      dto.address.line1,
      dto.address.line2 || null,
      dto.address.city,
      dto.address.postcode,
      dto.address.country,
      dto.notes || null,
      now,
      now
    );

    const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as Record<string, unknown>;
    db.close();

    const response: ApiResponse<Customer> = {
      success: true,
      data: mapRowToCustomer(row),
      message: 'Customer created successfully',
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

// PUT /customers/:id - Update customer
router.put('/:id', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);

    if (!existing) {
      db.close();
      const response: ApiResponse<null> = {
        success: false,
        error: 'Customer not found',
      };
      return res.status(404).json(response);
    }

    const dto: UpdateCustomerDto = req.body;
    const now = new Date().toISOString();

    // Build dynamic update query
    const updates: string[] = [];
    const values: unknown[] = [];

    if (dto.firstName !== undefined) {
      updates.push('first_name = ?');
      values.push(dto.firstName);
    }
    if (dto.lastName !== undefined) {
      updates.push('last_name = ?');
      values.push(dto.lastName);
    }
    if (dto.email !== undefined) {
      updates.push('email = ?');
      values.push(dto.email);
    }
    if (dto.phone !== undefined) {
      updates.push('phone = ?');
      values.push(dto.phone);
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

    updates.push('updated_at = ?');
    values.push(now);
    values.push(req.params.id);

    db.prepare(`UPDATE customers SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id) as Record<string, unknown>;
    db.close();

    const response: ApiResponse<Customer> = {
      success: true,
      data: mapRowToCustomer(row),
      message: 'Customer updated successfully',
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

// DELETE /customers/:id - Delete customer
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
    db.close();

    if (result.changes === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Customer not found',
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<null> = {
      success: true,
      message: 'Customer deleted successfully',
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
