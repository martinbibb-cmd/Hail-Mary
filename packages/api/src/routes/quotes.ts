/**
 * Quote Routes - CRUD operations for quotes using Postgres/Drizzle
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/drizzle-client';
import { quotes, quoteLines, leads } from '../db/drizzle-schema';
import { eq, desc, count, and } from 'drizzle-orm';
import type { Quote, QuoteLine, CreateQuoteDto, UpdateQuoteDto, ApiResponse, PaginatedResponse } from '@hail-mary/shared';

const router = Router();

// Generate quote number
function generateQuoteNumber(): string {
  const prefix = 'QT';
  const year = new Date().getFullYear().toString().slice(-2);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}${year}-${random}`;
}

// Calculate quote totals
function calculateTotals(lines: QuoteLine[], vatRate: number): { subtotal: number; vatAmount: number; total: number } {
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const vatAmount = subtotal * (vatRate / 100);
  const total = subtotal + vatAmount;
  return { subtotal, vatAmount, total };
}

// Helper to map database row to QuoteLine object
function mapRowToQuoteLine(row: typeof quoteLines.$inferSelect): QuoteLine {
  return {
    id: String(row.id),
    productId: row.productId ? String(row.productId) : '',
    description: row.description,
    quantity: row.quantity,
    unitPrice: parseFloat(row.unitPrice),
    discount: parseFloat(row.discount) || undefined,
    lineTotal: parseFloat(row.lineTotal),
  };
}

// Helper to map database row to Quote object
function mapRowToQuote(row: typeof quotes.$inferSelect, lines: QuoteLine[] = []): Quote {
  // Calculate totals from lines
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const vatRate = 20; // Default VAT rate
  const vatAmount = subtotal * (vatRate / 100);
  const total = subtotal + vatAmount;
  
  return {
    id: String(row.id),
    quoteNumber: generateQuoteNumber(), // Generate since not stored in DB
    leadId: String(row.leadId),
    status: row.status as Quote['status'],
    title: row.title || '',
    description: undefined, // Not in postgres schema
    lines,
    subtotal,
    vatRate,
    vatAmount,
    total,
    validUntil: row.validUntil || new Date(),
    notes: undefined, // Not in postgres schema
    terms: undefined, // Not in postgres schema
    createdAt: row.createdAt,
    updatedAt: row.createdAt, // Use createdAt since updatedAt not in postgres schema
  };
}

// GET /quotes - List all quotes
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status as string;
    const leadId = req.query.leadId as string;

    // Build conditions
    const conditions = [];
    if (status) conditions.push(eq(quotes.status, status));
    if (leadId) conditions.push(eq(quotes.leadId, parseInt(leadId)));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(quotes)
        .where(whereClause)
        .orderBy(desc(quotes.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(quotes).where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;

    // Get lines for each quote
    const quotesWithLines = await Promise.all(
      rows.map(async (row) => {
        const lineRows = await db
          .select()
          .from(quoteLines)
          .where(eq(quoteLines.quoteId, row.id));
        const lines = lineRows.map(mapRowToQuoteLine);
        return mapRowToQuote(row, lines);
      })
    );

    const response: PaginatedResponse<Quote> = {
      success: true,
      data: quotesWithLines,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    res.json(response);
  } catch (error) {
    console.error('Error listing quotes:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// GET /quotes/:id - Get single quote
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Invalid quote ID',
      };
      return res.status(400).json(response);
    }

    const rows = await db
      .select()
      .from(quotes)
      .where(eq(quotes.id, id));

    if (rows.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Quote not found',
      };
      return res.status(404).json(response);
    }

    const lineRows = await db
      .select()
      .from(quoteLines)
      .where(eq(quoteLines.quoteId, id));
    const lines = lineRows.map(mapRowToQuoteLine);

    const response: ApiResponse<Quote> = {
      success: true,
      data: mapRowToQuote(rows[0], lines),
    };
    res.json(response);
  } catch (error) {
    console.error('Error getting quote:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// POST /quotes - Create quote
router.post('/', async (req: Request, res: Response) => {
  try {
    const dto: CreateQuoteDto = req.body;
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

    const [inserted] = await db
      .insert(quotes)
      .values({
        accountId: 1, // TODO: Get from auth context
        leadId: leadIdNum,
        status: dto.status || 'draft',
        title: dto.title || null,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
      })
      .returning();

    // Insert quote lines if provided
    const lines = dto.lines || [];
    const insertedLines: QuoteLine[] = [];

    for (const line of lines) {
      const productIdNum = line.productId ? (typeof line.productId === 'number' ? line.productId : parseInt(String(line.productId))) : null;
      const [insertedLine] = await db
        .insert(quoteLines)
        .values({
          quoteId: inserted.id,
          productId: productIdNum,
          description: line.description,
          quantity: line.quantity,
          unitPrice: String(line.unitPrice),
          discount: String(line.discount || 0),
          lineTotal: String(line.lineTotal),
        })
        .returning();
      insertedLines.push(mapRowToQuoteLine(insertedLine));
    }

    const response: ApiResponse<Quote> = {
      success: true,
      data: mapRowToQuote(inserted, insertedLines),
      message: 'Quote created successfully',
    };
    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating quote:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// PUT /quotes/:id - Update quote
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Invalid quote ID',
      };
      return res.status(400).json(response);
    }

    // Check if quote exists
    const existing = await db
      .select()
      .from(quotes)
      .where(eq(quotes.id, id));

    if (existing.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Quote not found',
      };
      return res.status(404).json(response);
    }

    const dto: UpdateQuoteDto = req.body;

    // Build update object with only provided fields
    const updateData: Partial<{
      status: string;
      title: string | null;
      validUntil: Date | null;
    }> = {};

    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.title !== undefined) updateData.title = dto.title || null;
    if (dto.validUntil !== undefined) updateData.validUntil = dto.validUntil ? new Date(dto.validUntil) : null;

    const [updated] = await db
      .update(quotes)
      .set(updateData)
      .where(eq(quotes.id, id))
      .returning();

    // If lines are provided, update them
    let updatedLines: QuoteLine[] = [];
    if (dto.lines !== undefined) {
      // Delete existing lines
      await db.delete(quoteLines).where(eq(quoteLines.quoteId, id));

      // Insert new lines
      for (const line of dto.lines) {
        const productIdNum = line.productId ? (typeof line.productId === 'number' ? line.productId : parseInt(String(line.productId))) : null;
        const [insertedLine] = await db
          .insert(quoteLines)
          .values({
            quoteId: id,
            productId: productIdNum,
            description: line.description,
            quantity: line.quantity,
            unitPrice: String(line.unitPrice),
            discount: String(line.discount || 0),
            lineTotal: String(line.lineTotal),
          })
          .returning();
        updatedLines.push(mapRowToQuoteLine(insertedLine));
      }
    } else {
      // Get existing lines
      const lineRows = await db
        .select()
        .from(quoteLines)
        .where(eq(quoteLines.quoteId, id));
      updatedLines = lineRows.map(mapRowToQuoteLine);
    }

    const response: ApiResponse<Quote> = {
      success: true,
      data: mapRowToQuote(updated, updatedLines),
      message: 'Quote updated successfully',
    };
    res.json(response);
  } catch (error) {
    console.error('Error updating quote:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// DELETE /quotes/:id - Delete quote
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Invalid quote ID',
      };
      return res.status(400).json(response);
    }

    // Delete quote lines first (foreign key constraint)
    await db.delete(quoteLines).where(eq(quoteLines.quoteId, id));

    const deleted = await db
      .delete(quotes)
      .where(eq(quotes.id, id))
      .returning();

    if (deleted.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Quote not found',
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<null> = {
      success: true,
      message: 'Quote deleted successfully',
    };
    res.json(response);
  } catch (error) {
    console.error('Error deleting quote:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// POST /quotes/:id/lines - Add line to quote
router.post('/:id/lines', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Invalid quote ID',
      };
      return res.status(400).json(response);
    }

    const quoteRows = await db
      .select()
      .from(quotes)
      .where(eq(quotes.id, id));

    if (quoteRows.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Quote not found',
      };
      return res.status(404).json(response);
    }

    const line = req.body;

    const [insertedLine] = await db
      .insert(quoteLines)
      .values({
        quoteId: id,
        productId: line.productId ? parseInt(line.productId) : null,
        description: line.description,
        quantity: line.quantity,
        unitPrice: String(line.unitPrice),
        discount: String(line.discount || 0),
        lineTotal: String(line.lineTotal),
      })
      .returning();

    // Get all lines for the quote
    const lineRows = await db
      .select()
      .from(quoteLines)
      .where(eq(quoteLines.quoteId, id));
    const lines = lineRows.map(mapRowToQuoteLine);

    const response: ApiResponse<Quote> = {
      success: true,
      data: mapRowToQuote(quoteRows[0], lines),
      message: 'Line added successfully',
    };
    res.status(201).json(response);
  } catch (error) {
    console.error('Error adding quote line:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

export default router;
