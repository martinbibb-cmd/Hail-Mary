/**
 * Quote Routes - CRUD operations for quotes
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db/schema';
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

// Helper to map database row to Quote object
function mapRowToQuote(row: Record<string, unknown>, lines: QuoteLine[] = []): Quote {
  return {
    id: row.id as string,
    quoteNumber: row.quote_number as string,
    customerId: row.customer_id as string,
    leadId: row.lead_id as string | undefined,
    status: row.status as Quote['status'],
    title: row.title as string,
    description: row.description as string | undefined,
    lines,
    subtotal: row.subtotal as number,
    vatRate: row.vat_rate as number,
    vatAmount: row.vat_amount as number,
    total: row.total as number,
    validUntil: new Date(row.valid_until as string),
    notes: row.notes as string | undefined,
    terms: row.terms as string | undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

function mapRowToQuoteLine(row: Record<string, unknown>): QuoteLine {
  return {
    id: row.id as string,
    productId: row.product_id as string,
    description: row.description as string,
    quantity: row.quantity as number,
    unitPrice: row.unit_price as number,
    discount: row.discount as number | undefined,
    lineTotal: row.line_total as number,
  };
}

// GET /quotes - List all quotes
router.get('/', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status as string;
    const customerId = req.query.customerId as string;

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    if (customerId) {
      whereClause += ' AND customer_id = ?';
      params.push(customerId);
    }

    const countResult = db.prepare(`SELECT COUNT(*) as total FROM quotes ${whereClause}`).get(...params) as { total: number };
    const total = countResult.total;

    const rows = db.prepare(`
      SELECT * FROM quotes 
      ${whereClause}
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as Record<string, unknown>[];

    // Get lines for each quote
    const quotes = rows.map(row => {
      const lineRows = db.prepare('SELECT * FROM quote_lines WHERE quote_id = ?').all(row.id as string) as Record<string, unknown>[];
      const lines = lineRows.map(mapRowToQuoteLine);
      return mapRowToQuote(row, lines);
    });

    db.close();

    const response: PaginatedResponse<Quote> = {
      success: true,
      data: quotes,
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

// GET /quotes/:id - Get single quote
router.get('/:id', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;

    if (!row) {
      db.close();
      const response: ApiResponse<null> = {
        success: false,
        error: 'Quote not found',
      };
      return res.status(404).json(response);
    }

    const lineRows = db.prepare('SELECT * FROM quote_lines WHERE quote_id = ?').all(req.params.id) as Record<string, unknown>[];
    const lines = lineRows.map(mapRowToQuoteLine);
    db.close();

    const response: ApiResponse<Quote> = {
      success: true,
      data: mapRowToQuote(row, lines),
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

// POST /quotes - Create quote
router.post('/', (req: Request, res: Response) => {
  try {
    const dto: CreateQuoteDto = req.body;
    const id = uuidv4();
    const quoteNumber = generateQuoteNumber();
    const now = new Date().toISOString();

    // Calculate totals from lines
    const lines = dto.lines || [];
    const { subtotal, vatAmount, total } = calculateTotals(lines, dto.vatRate);

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
      INSERT INTO quotes (id, quote_number, customer_id, lead_id, status, title, description,
        subtotal, vat_rate, vat_amount, total, valid_until, notes, terms, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      quoteNumber,
      dto.customerId,
      dto.leadId || null,
      dto.status || 'draft',
      dto.title,
      dto.description || null,
      subtotal,
      dto.vatRate,
      vatAmount,
      total,
      dto.validUntil ? new Date(dto.validUntil).toISOString() : null,
      dto.notes || null,
      dto.terms || null,
      now,
      now
    );

    // Insert quote lines
    const insertLine = db.prepare(`
      INSERT INTO quote_lines (id, quote_id, product_id, description, quantity, unit_price, discount, line_total, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const line of lines) {
      insertLine.run(
        uuidv4(),
        id,
        line.productId || null,
        line.description,
        line.quantity,
        line.unitPrice,
        line.discount || 0,
        line.lineTotal,
        now,
        now
      );
    }

    const row = db.prepare('SELECT * FROM quotes WHERE id = ?').get(id) as Record<string, unknown>;
    const lineRows = db.prepare('SELECT * FROM quote_lines WHERE quote_id = ?').all(id) as Record<string, unknown>[];
    db.close();

    const response: ApiResponse<Quote> = {
      success: true,
      data: mapRowToQuote(row, lineRows.map(mapRowToQuoteLine)),
      message: 'Quote created successfully',
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

// PUT /quotes/:id - Update quote
router.put('/:id', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const existing = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);

    if (!existing) {
      db.close();
      const response: ApiResponse<null> = {
        success: false,
        error: 'Quote not found',
      };
      return res.status(404).json(response);
    }

    const dto: UpdateQuoteDto = req.body;
    const now = new Date().toISOString();

    const updates: string[] = [];
    const values: unknown[] = [];

    if (dto.status !== undefined) {
      updates.push('status = ?');
      values.push(dto.status);
    }
    if (dto.title !== undefined) {
      updates.push('title = ?');
      values.push(dto.title);
    }
    if (dto.description !== undefined) {
      updates.push('description = ?');
      values.push(dto.description);
    }
    if (dto.validUntil !== undefined) {
      updates.push('valid_until = ?');
      values.push(new Date(dto.validUntil).toISOString());
    }
    if (dto.notes !== undefined) {
      updates.push('notes = ?');
      values.push(dto.notes);
    }
    if (dto.terms !== undefined) {
      updates.push('terms = ?');
      values.push(dto.terms);
    }

    // If lines are updated, recalculate totals
    if (dto.lines !== undefined) {
      const { subtotal, vatAmount, total } = calculateTotals(dto.lines, dto.vatRate || 20);
      updates.push('subtotal = ?', 'vat_amount = ?', 'total = ?');
      values.push(subtotal, vatAmount, total);

      // Delete existing lines and insert new ones
      db.prepare('DELETE FROM quote_lines WHERE quote_id = ?').run(req.params.id);
      
      const insertLine = db.prepare(`
        INSERT INTO quote_lines (id, quote_id, product_id, description, quantity, unit_price, discount, line_total, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const line of dto.lines) {
        insertLine.run(
          uuidv4(),
          req.params.id,
          line.productId || null,
          line.description,
          line.quantity,
          line.unitPrice,
          line.discount || 0,
          line.lineTotal,
          now,
          now
        );
      }
    }

    if (dto.vatRate !== undefined) {
      updates.push('vat_rate = ?');
      values.push(dto.vatRate);
    }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(req.params.id);

    db.prepare(`UPDATE quotes SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const row = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id) as Record<string, unknown>;
    const lineRows = db.prepare('SELECT * FROM quote_lines WHERE quote_id = ?').all(req.params.id) as Record<string, unknown>[];
    db.close();

    const response: ApiResponse<Quote> = {
      success: true,
      data: mapRowToQuote(row, lineRows.map(mapRowToQuoteLine)),
      message: 'Quote updated successfully',
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

// DELETE /quotes/:id - Delete quote
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM quotes WHERE id = ?').run(req.params.id);
    db.close();

    if (result.changes === 0) {
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
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// POST /quotes/:id/lines - Add line to quote
router.post('/:id/lines', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;

    if (!quote) {
      db.close();
      const response: ApiResponse<null> = {
        success: false,
        error: 'Quote not found',
      };
      return res.status(404).json(response);
    }

    const line = req.body;
    const lineId = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO quote_lines (id, quote_id, product_id, description, quantity, unit_price, discount, line_total, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      lineId,
      req.params.id,
      line.productId || null,
      line.description,
      line.quantity,
      line.unitPrice,
      line.discount || 0,
      line.lineTotal,
      now,
      now
    );

    // Recalculate quote totals
    const lineRows = db.prepare('SELECT * FROM quote_lines WHERE quote_id = ?').all(req.params.id) as Record<string, unknown>[];
    const lines = lineRows.map(mapRowToQuoteLine);
    const { subtotal, vatAmount, total } = calculateTotals(lines, quote.vat_rate as number);

    db.prepare('UPDATE quotes SET subtotal = ?, vat_amount = ?, total = ?, updated_at = ? WHERE id = ?')
      .run(subtotal, vatAmount, total, now, req.params.id);

    const updatedQuote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id) as Record<string, unknown>;
    db.close();

    const response: ApiResponse<Quote> = {
      success: true,
      data: mapRowToQuote(updatedQuote, lines),
      message: 'Line added successfully',
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

export default router;
