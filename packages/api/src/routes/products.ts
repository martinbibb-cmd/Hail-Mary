/**
 * Product Routes - CRUD operations for products using Postgres/Drizzle
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/drizzle-client';
import { products } from '../db/drizzle-schema';
import { eq, count, and } from 'drizzle-orm';
import type { Product, CreateProductDto, UpdateProductDto, ApiResponse, PaginatedResponse } from '@hail-mary/shared';

const router = Router();

// Helper to map database row to Product object
function mapRowToProduct(row: typeof products.$inferSelect): Product {
  return {
    id: String(row.id),
    name: row.name,
    description: row.description || '',
    category: 'boiler' as Product['category'], // Default, not in postgres schema
    manufacturer: undefined, // Not in postgres schema
    model: undefined, // Not in postgres schema
    sku: row.sku,
    price: parseFloat(row.basePrice),
    costPrice: undefined, // Not in postgres schema
    specifications: undefined, // Not in postgres schema
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.createdAt, // Use createdAt since updatedAt not in postgres schema
  };
}

// GET /products - List all products
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const activeOnly = req.query.active !== 'false';

    // Build conditions
    const conditions = [];
    if (activeOnly) conditions.push(eq(products.isActive, true));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(products)
        .where(whereClause)
        .orderBy(products.name)
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(products).where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;

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
    console.error('Error listing products:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// GET /products/:id - Get single product
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Invalid product ID',
      };
      return res.status(400).json(response);
    }

    const rows = await db
      .select()
      .from(products)
      .where(eq(products.id, id));

    if (rows.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Product not found',
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<Product> = {
      success: true,
      data: mapRowToProduct(rows[0]),
    };
    res.json(response);
  } catch (error) {
    console.error('Error getting product:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// POST /products - Create product
router.post('/', async (req: Request, res: Response) => {
  try {
    const dto: CreateProductDto = req.body;

    const [inserted] = await db
      .insert(products)
      .values({
        accountId: 1, // TODO: Get from auth context
        sku: dto.sku || `SKU-${Date.now()}`,
        name: dto.name,
        description: dto.description || null,
        basePrice: String(dto.price),
        isActive: dto.isActive ?? true,
      })
      .returning();

    const response: ApiResponse<Product> = {
      success: true,
      data: mapRowToProduct(inserted),
      message: 'Product created successfully',
    };
    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating product:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// PUT /products/:id - Update product
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Invalid product ID',
      };
      return res.status(400).json(response);
    }

    // Check if product exists
    const existing = await db
      .select()
      .from(products)
      .where(eq(products.id, id));

    if (existing.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Product not found',
      };
      return res.status(404).json(response);
    }

    const dto: UpdateProductDto = req.body;

    // Build update object with only provided fields
    const updateData: Partial<{
      sku: string;
      name: string;
      description: string | null;
      basePrice: string;
      isActive: boolean;
    }> = {};

    if (dto.sku !== undefined) updateData.sku = dto.sku;
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description || null;
    if (dto.price !== undefined) updateData.basePrice = String(dto.price);
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const [updated] = await db
      .update(products)
      .set(updateData)
      .where(eq(products.id, id))
      .returning();

    const response: ApiResponse<Product> = {
      success: true,
      data: mapRowToProduct(updated),
      message: 'Product updated successfully',
    };
    res.json(response);
  } catch (error) {
    console.error('Error updating product:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// DELETE /products/:id - Delete product
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Invalid product ID',
      };
      return res.status(400).json(response);
    }

    const deleted = await db
      .delete(products)
      .where(eq(products.id, id))
      .returning();

    if (deleted.length === 0) {
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
    console.error('Error deleting product:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

export default router;
