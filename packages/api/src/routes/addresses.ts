/**
 * Addresses API Routes
 *
 * Permission-based address management
 *
 * Endpoints:
 * - GET  /api/addresses?query=&page=1&limit=50   (list/search with permissions)
 * - POST /api/addresses                          (create address)
 * - GET  /api/addresses/:id                      (get address detail)
 * - PATCH /api/addresses/:id                     (update address)
 * - GET  /api/addresses/:id/appointments         (get appointments for address)
 */

import { Router, Request, Response } from "express";
import { db } from "../db/drizzle-client";
import { addresses, addressAppointments } from "../db/drizzle-schema";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.middleware";
import type { ApiResponse, PaginatedResponse } from "@hail-mary/shared";

const router = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * Helper: Get permission filter for addresses
 * Admin sees all, non-admin sees only created/assigned
 */
function getAddressPermissionFilter(userId: number, isAdmin: boolean) {
  if (isAdmin) {
    return undefined; // No filter - admin sees all
  }
  return or(
    eq(addresses.createdByUserId, userId),
    eq(addresses.assignedUserId, userId)
  );
}

/**
 * Helper: Check if user can access address
 */
async function canAccessAddress(addressId: string, userId: number, isAdmin: boolean): Promise<boolean> {
  if (isAdmin) return true;

  const [address] = await db
    .select()
    .from(addresses)
    .where(eq(addresses.id, addressId))
    .limit(1);

  if (!address) return false;

  return address.createdByUserId === userId || address.assignedUserId === userId;
}

/**
 * GET /api/addresses?query=&page=1&limit=50
 * List/search addresses with permissions
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const query = req.query.query as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    // Build permission filter
    const permissionFilter = getAddressPermissionFilter(userId, isAdmin);

    // Build search filter
    const searchConditions = [];
    if (query) {
      const searchPattern = `%${query}%`;
      searchConditions.push(
        or(
          ilike(addresses.postcode, searchPattern),
          ilike(addresses.line1, searchPattern),
          ilike(addresses.town, searchPattern),
          ilike(addresses.customerName, searchPattern),
          ilike(addresses.phone, searchPattern),
          ilike(addresses.email, searchPattern)
        )
      );
    }

    // Combine filters
    const filters = [];
    if (permissionFilter) filters.push(permissionFilter);
    if (searchConditions.length > 0) filters.push(...searchConditions);

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(addresses)
      .where(whereClause);

    const total = Number(countResult?.count ?? 0);
    const totalPages = Math.ceil(total / limit);

    // Get paginated results
    const rows = await db
      .select()
      .from(addresses)
      .where(whereClause)
      .orderBy(desc(addresses.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    const response: PaginatedResponse<typeof rows[0]> = {
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
    return res.json(response);
  } catch (error) {
    console.error("Error listing addresses:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * POST /api/addresses
 * Create a new address
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      line1,
      line2,
      town,
      county,
      postcode,
      country,
      customerName,
      phone,
      email,
      notes,
      assignedUserId,
    } = req.body;

    if (!line1 || !postcode) {
      const response: ApiResponse<null> = {
        success: false,
        error: "line1 and postcode are required",
      };
      return res.status(400).json(response);
    }

    // Only admin can assign to other users; non-admin defaults to self
    const isAdmin = req.user!.role === 'admin';
    const finalAssignedUserId = isAdmin && assignedUserId ? assignedUserId : userId;

    const [inserted] = await db
      .insert(addresses)
      .values({
        createdByUserId: userId,
        assignedUserId: finalAssignedUserId,
        line1: line1.trim(),
        line2: line2?.trim() || null,
        town: town?.trim() || null,
        county: county?.trim() || null,
        postcode: postcode.trim().toUpperCase(),
        country: country?.trim() || "United Kingdom",
        customerName: customerName?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        notes: notes?.trim() || null,
      })
      .returning();

    const response: ApiResponse<{ address: typeof inserted }> = {
      success: true,
      data: { address: inserted },
      message: "Address created successfully",
    };
    return res.status(201).json(response);
  } catch (error) {
    console.error("Error creating address:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * GET /api/addresses/:id
 * Get address detail (with permission check)
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const addressId = req.params.id;

    // Check permission
    const hasAccess = await canAccessAddress(addressId, userId, isAdmin);
    if (!hasAccess) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Address not found or access denied",
      };
      return res.status(404).json(response);
    }

    const [address] = await db
      .select()
      .from(addresses)
      .where(eq(addresses.id, addressId))
      .limit(1);

    if (!address) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Address not found",
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<{ address: typeof address }> = {
      success: true,
      data: { address },
    };
    return res.json(response);
  } catch (error) {
    console.error("Error getting address:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * PATCH /api/addresses/:id
 * Update address (with permission check)
 */
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const addressId = req.params.id;

    // Check permission
    const hasAccess = await canAccessAddress(addressId, userId, isAdmin);
    if (!hasAccess) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Address not found or access denied",
      };
      return res.status(404).json(response);
    }

    const {
      line1,
      line2,
      town,
      county,
      postcode,
      country,
      customerName,
      phone,
      email,
      notes,
      assignedUserId,
    } = req.body;

    // Build update object (only include provided fields)
    const updates: any = {
      updatedAt: new Date(),
    };

    if (line1 !== undefined) updates.line1 = line1.trim();
    if (line2 !== undefined) updates.line2 = line2?.trim() || null;
    if (town !== undefined) updates.town = town?.trim() || null;
    if (county !== undefined) updates.county = county?.trim() || null;
    if (postcode !== undefined) updates.postcode = postcode.trim().toUpperCase();
    if (country !== undefined) updates.country = country.trim();
    if (customerName !== undefined) updates.customerName = customerName?.trim() || null;
    if (phone !== undefined) updates.phone = phone?.trim() || null;
    if (email !== undefined) updates.email = email?.trim() || null;
    if (notes !== undefined) updates.notes = notes?.trim() || null;

    // Only admin can reassign
    if (isAdmin && assignedUserId !== undefined) {
      updates.assignedUserId = assignedUserId || null;
    }

    const [updated] = await db
      .update(addresses)
      .set(updates)
      .where(eq(addresses.id, addressId))
      .returning();

    const response: ApiResponse<{ address: typeof updated }> = {
      success: true,
      data: { address: updated },
      message: "Address updated successfully",
    };
    return res.json(response);
  } catch (error) {
    console.error("Error updating address:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

/**
 * GET /api/addresses/:id/appointments
 * Get appointments for address (with permission check)
 */
router.get("/:id/appointments", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    const addressId = req.params.id;

    // Check permission
    const hasAccess = await canAccessAddress(addressId, userId, isAdmin);
    if (!hasAccess) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Address not found or access denied",
      };
      return res.status(404).json(response);
    }

    const rows = await db
      .select()
      .from(addressAppointments)
      .where(eq(addressAppointments.addressId, addressId))
      .orderBy(desc(addressAppointments.startAt));

    const response: ApiResponse<{ appointments: typeof rows }> = {
      success: true,
      data: { appointments: rows },
    };
    return res.json(response);
  } catch (error) {
    console.error("Error getting address appointments:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

export default router;
