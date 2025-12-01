/**
 * Product Routes - CRUD operations for products
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db/schema';
import type { Product, CreateProductDto, UpdateProductDto, ApiResponse, PaginatedResponse } from '@hail-mary/shared';

const router = Router();

// Helper to map database row to Product object
function mapRowToProduct(row: Record<string, unknown>): Product {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string,
    category: row.category as Product['category'],
    manufacturer: row.manufacturer as string | undefined,
    model: row.model as string | undefined,
    sku: row.sku as string | undefined,
    price: row.price as number,
    costPrice: row.cost_price as number | undefined,
    specifications: row.specifications ? JSON.parse(row.specifications as string) : undefined,
    isActive: Boolean(row.is_active),
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

// GET /products - List all products
router.get('/', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const category = req.query.category as string;
    const activeOnly = req.query.active !== 'false';

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];

    if (activeOnly) {
      whereClause += ' AND is_active = 1';
    }
    if (category) {
      whereClause += ' AND category = ?';
      params.push(category);
    }

    const countResult = db.prepare(`SELECT COUNT(*) as total FROM products ${whereClause}`).get(...params) as { total: number };
    const total = countResult.total;

    const rows = db.prepare(`
      SELECT * FROM products 
      ${whereClause}
      ORDER BY name ASC 
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as Record<string, unknown>[];

    db.close();

    const response: PaginatedResponse<Product> = {
      success: true,
      data: rows.map(mapRowToProduct),
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

// GET /products/:id - Get single product
router.get('/:id', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    db.close();

    if (!row) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Product not found',
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<Product> = {
      success: true,
      data: mapRowToProduct(row),
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

// POST /products - Create product
router.post('/', (req: Request, res: Response) => {
  try {
    const dto: CreateProductDto = req.body;
    const id = uuidv4();
    const now = new Date().toISOString();

    const db = getDatabase();
    db.prepare(`
      INSERT INTO products (id, name, description, category, manufacturer, model, sku, 
        price, cost_price, specifications, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      dto.name,
      dto.description,
      dto.category,
      dto.manufacturer || null,
      dto.model || null,
      dto.sku || null,
      dto.price,
      dto.costPrice || null,
      dto.specifications ? JSON.stringify(dto.specifications) : null,
      dto.isActive ? 1 : 0,
      now,
      now
    );

    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Record<string, unknown>;
    db.close();

    const response: ApiResponse<Product> = {
      success: true,
      data: mapRowToProduct(row),
      message: 'Product created successfully',
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

// PUT /products/:id - Update product
router.put('/:id', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);

    if (!existing) {
      db.close();
      const response: ApiResponse<null> = {
        success: false,
        error: 'Product not found',
      };
      return res.status(404).json(response);
    }

    const dto: UpdateProductDto = req.body;
    const now = new Date().toISOString();

    const updates: string[] = [];
    const values: unknown[] = [];

    if (dto.name !== undefined) {
      updates.push('name = ?');
      values.push(dto.name);
    }
    if (dto.description !== undefined) {
      updates.push('description = ?');
      values.push(dto.description);
    }
    if (dto.category !== undefined) {
      updates.push('category = ?');
      values.push(dto.category);
    }
    if (dto.manufacturer !== undefined) {
      updates.push('manufacturer = ?');
      values.push(dto.manufacturer);
    }
    if (dto.model !== undefined) {
      updates.push('model = ?');
      values.push(dto.model);
    }
    if (dto.sku !== undefined) {
      updates.push('sku = ?');
      values.push(dto.sku);
    }
    if (dto.price !== undefined) {
      updates.push('price = ?');
      values.push(dto.price);
    }
    if (dto.costPrice !== undefined) {
      updates.push('cost_price = ?');
      values.push(dto.costPrice);
    }
    if (dto.specifications !== undefined) {
      updates.push('specifications = ?');
      values.push(JSON.stringify(dto.specifications));
    }
    if (dto.isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(dto.isActive ? 1 : 0);
    }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(req.params.id);

    db.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id) as Record<string, unknown>;
    db.close();

    const response: ApiResponse<Product> = {
      success: true,
      data: mapRowToProduct(row),
      message: 'Product updated successfully',
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

// DELETE /products/:id - Delete product
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    db.close();

    if (result.changes === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Product not found',
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<null> = {
      success: true,
      message: 'Product deleted successfully',
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
