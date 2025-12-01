/**
 * Customer Routes - CRUD operations for customers using Postgres/Drizzle
 */

import { Router, Request, Response } from "express";
import { db } from "../db/drizzle-client";
import { customers } from "../db/drizzle-schema";
import { eq, desc, count } from "drizzle-orm";
import type {
  Customer,
  CreateCustomerDto,
  UpdateCustomerDto,
  ApiResponse,
  PaginatedResponse,
} from "@hail-mary/shared";

const router = Router();

// Helper to map database row to Customer object
function mapRowToCustomer(
  row: typeof customers.$inferSelect
): Customer {
  return {
    id: row.id,
    accountId: row.accountId,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email || "",
    phone: row.phone || "",
    address: {
      line1: row.addressLine1 || "",
      line2: row.addressLine2 || undefined,
      city: row.city || "",
      postcode: row.postcode || "",
      country: row.country || "UK",
    },
    notes: row.notes || undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// GET /customers - List all customers
router.get("/", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(customers)
        .orderBy(desc(customers.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(customers),
    ]);

    const total = countResult[0]?.count ?? 0;

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
    console.error("Error listing customers:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// GET /customers/:id - Get single customer
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Invalid customer ID",
      };
      return res.status(400).json(response);
    }

    const rows = await db
      .select()
      .from(customers)
      .where(eq(customers.id, id));

    if (rows.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Customer not found",
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<Customer> = {
      success: true,
      data: mapRowToCustomer(rows[0]),
    };
    res.json(response);
  } catch (error) {
    console.error("Error getting customer:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// POST /customers - Create customer
router.post("/", async (req: Request, res: Response) => {
  try {
    const dto: CreateCustomerDto = req.body;

    const [inserted] = await db
      .insert(customers)
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
        country: dto.address?.country || "UK",
        notes: dto.notes || null,
      })
      .returning();

    const response: ApiResponse<Customer> = {
      success: true,
      data: mapRowToCustomer(inserted),
      message: "Customer created successfully",
    };
    res.status(201).json(response);
  } catch (error) {
    console.error("Error creating customer:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// PUT /customers/:id - Update customer
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Invalid customer ID",
      };
      return res.status(400).json(response);
    }

    // Check if customer exists
    const existing = await db
      .select()
      .from(customers)
      .where(eq(customers.id, id));

    if (existing.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Customer not found",
      };
      return res.status(404).json(response);
    }

    const dto: UpdateCustomerDto = req.body;

    // Build update object with only provided fields
    const updateData: Partial<{
      firstName: string;
      lastName: string;
      email: string | null;
      phone: string | null;
      addressLine1: string | null;
      addressLine2: string | null;
      city: string | null;
      postcode: string | null;
      country: string | null;
      notes: string | null;
      updatedAt: Date;
    }> = {
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
    if (dto.notes !== undefined) updateData.notes = dto.notes || null;

    const [updated] = await db
      .update(customers)
      .set(updateData)
      .where(eq(customers.id, id))
      .returning();

    const response: ApiResponse<Customer> = {
      success: true,
      data: mapRowToCustomer(updated),
      message: "Customer updated successfully",
    };
    res.json(response);
  } catch (error) {
    console.error("Error updating customer:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

// DELETE /customers/:id - Delete customer
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Invalid customer ID",
      };
      return res.status(400).json(response);
    }

    const deleted = await db
      .delete(customers)
      .where(eq(customers.id, id))
      .returning();

    if (deleted.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Customer not found",
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<null> = {
      success: true,
      message: "Customer deleted successfully",
    };
    res.json(response);
  } catch (error) {
    console.error("Error deleting customer:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

export default router;
