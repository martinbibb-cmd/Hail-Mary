/**
 * Lead Workspace Routes - Normalized data model endpoints
 * 
 * Provides:
 * - GET /api/leads/:id/workspace - Composed workspace payload
 * - PATCH /api/leads/:id/contact - Update lead contact
 * - PATCH /api/leads/:id/occupancy - Update lead occupancy
 * - PATCH /api/leads/:id/property - Update property
 * - POST/DELETE /api/leads/:id/photos - Manage photos
 * - POST/DELETE /api/leads/:id/floorplans - Manage floorplans
 * - PATCH /api/leads/:id/heatloss - Update heat loss
 * - POST/DELETE /api/leads/:id/technologies - Manage technologies
 * - POST/DELETE /api/leads/:id/interests - Manage interests
 * - POST/DELETE /api/leads/:id/future-plans - Manage future plans
 * - POST/PUT/DELETE /api/leads/:id/recommendations - Manage recommendations
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/drizzle-client';
import {
  leads,
  leadContacts,
  leadOccupancy,
  properties,
  leadHeatloss,
  leadInterests,
  leadFuturePlans,
  leadTechnologies,
  quotes,
  recommendations,
  leadPhotos,
  propertyFloorplans,
} from '../db/drizzle-schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.middleware';
import type {
  ApiResponse,
  LeadWorkspace,
  UpdateLeadContactDto,
  UpdateLeadOccupancyDto,
  UpdatePropertyDto,
  UpdateLeadHeatlossDto,
  CreateLeadTechnologyDto,
  CreateLeadInterestDto,
  CreateLeadFuturePlanDto,
  CreateRecommendationDto,
  UpdateRecommendationDto,
  CreateLeadPhotoDto,
  CreatePropertyFloorplanDto,
} from '@hail-mary/shared';

const router = Router();

// Apply authentication middleware to all workspace routes
router.use(requireAuth);

/**
 * GET /api/leads/:id/workspace
 * Returns composed workspace payload with all related data
 */
router.get('/:id/workspace', async (req: Request, res: Response) => {
  try {
    const leadId = parseInt(req.params.id);
    if (isNaN(leadId)) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Invalid lead ID',
      };
      return res.status(400).json(response);
    }

    // Fetch lead
    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
    if (!lead) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Lead not found',
      };
      return res.status(404).json(response);
    }

    // Fetch all related data in parallel
    const [
      contactRows,
      occupancyRows,
      propertyRows,
      heatlossRows,
      interestsRows,
      futurePlansRows,
      technologiesRows,
      quotesRows,
      recommendationsRows,
      photosRows,
      floorplansRows,
    ] = await Promise.all([
      db.select().from(leadContacts).where(eq(leadContacts.leadId, leadId)),
      db.select().from(leadOccupancy).where(eq(leadOccupancy.leadId, leadId)),
      db.select().from(properties).where(eq(properties.leadId, leadId)),
      db.select().from(leadHeatloss).where(eq(leadHeatloss.leadId, leadId)),
      db.select().from(leadInterests).where(eq(leadInterests.leadId, leadId)),
      db.select().from(leadFuturePlans).where(eq(leadFuturePlans.leadId, leadId)),
      db.select().from(leadTechnologies).where(eq(leadTechnologies.leadId, leadId)),
      db.select().from(quotes).where(eq(quotes.leadId, leadId)),
      db.select().from(recommendations).where(eq(recommendations.leadId, leadId)),
      db.select().from(leadPhotos).where(eq(leadPhotos.leadId, leadId)),
      db.select().from(propertyFloorplans).where(eq(propertyFloorplans.leadId, leadId)),
    ]);

    const workspace: LeadWorkspace = {
      lead: {
        id: lead.id,
        accountId: lead.accountId,
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email || undefined,
        phone: lead.phone || undefined,
        address: {
          line1: lead.addressLine1 || '',
          line2: lead.addressLine2 || undefined,
          city: lead.city || '',
          postcode: lead.postcode || '',
          country: lead.country || 'UK',
        },
        source: lead.source || undefined,
        status: lead.status as any,
        description: lead.description || undefined,
        propertyType: lead.propertyType || undefined,
        estimatedValue: lead.estimatedValue ? Number(lead.estimatedValue) : undefined,
        notes: lead.notes || undefined,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
      },
      contact: contactRows[0] ? {
        id: contactRows[0].id,
        leadId: contactRows[0].leadId,
        name: contactRows[0].name,
        phone: contactRows[0].phone || undefined,
        email: contactRows[0].email || undefined,
        addressLine1: contactRows[0].addressLine1 || undefined,
        addressLine2: contactRows[0].addressLine2 || undefined,
        city: contactRows[0].city || undefined,
        postcode: contactRows[0].postcode || undefined,
        country: contactRows[0].country || undefined,
        createdAt: contactRows[0].createdAt,
        updatedAt: contactRows[0].updatedAt,
      } : undefined,
      occupancy: occupancyRows[0] ? {
        id: occupancyRows[0].id,
        leadId: occupancyRows[0].leadId,
        occupants: occupancyRows[0].occupants || undefined,
        schedule: occupancyRows[0].schedule || undefined,
        priorities: occupancyRows[0].priorities || undefined,
        notes: occupancyRows[0].notes || undefined,
        createdAt: occupancyRows[0].createdAt,
        updatedAt: occupancyRows[0].updatedAt,
      } : undefined,
      property: propertyRows[0] ? {
        id: propertyRows[0].id,
        leadId: propertyRows[0].leadId,
        type: propertyRows[0].type || undefined,
        ageBand: propertyRows[0].ageBand || undefined,
        construction: propertyRows[0].construction as any || undefined,
        notes: propertyRows[0].notes || undefined,
        createdAt: propertyRows[0].createdAt,
        updatedAt: propertyRows[0].updatedAt,
      } : undefined,
      heatloss: heatlossRows[0] ? {
        id: heatlossRows[0].id,
        leadId: heatlossRows[0].leadId,
        wholeHouseW: heatlossRows[0].wholeHouseW || undefined,
        method: heatlossRows[0].method || undefined,
        assumptions: heatlossRows[0].assumptions || undefined,
        createdAt: heatlossRows[0].createdAt,
        updatedAt: heatlossRows[0].updatedAt,
      } : undefined,
      interests: interestsRows.map(row => ({
        id: row.id,
        leadId: row.leadId,
        category: row.category,
        value: row.value || undefined,
        createdAt: row.createdAt,
      })),
      futurePlans: futurePlansRows.map(row => ({
        id: row.id,
        leadId: row.leadId,
        planType: row.planType,
        timeframe: row.timeframe || undefined,
        notes: row.notes || undefined,
        createdAt: row.createdAt,
      })),
      technologies: technologiesRows.map(row => ({
        id: row.id,
        leadId: row.leadId,
        type: row.type,
        make: row.make || undefined,
        model: row.model || undefined,
        notes: row.notes || undefined,
        createdAt: row.createdAt,
      })),
      quotes: quotesRows.map(row => ({
        id: row.id,
        quoteNumber: `Q-${row.id}`,
        leadId: row.leadId,
        status: row.status as any,
        title: row.title || '',
        description: undefined,
        lines: [],
        subtotal: 0,
        vatRate: 0.2,
        vatAmount: 0,
        total: 0,
        validUntil: row.validUntil || new Date(),
        createdAt: row.createdAt,
        updatedAt: new Date(),
      })),
      recommendations: recommendationsRows.map(row => ({
        id: row.id,
        leadId: row.leadId,
        option: row.option,
        summary: row.summary,
        rationale: row.rationale || undefined,
        dependencies: row.dependencies || undefined,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
      photos: photosRows.map(row => ({
        id: row.id,
        leadId: row.leadId,
        fileId: row.fileId || undefined,
        category: row.category || undefined,
        caption: row.caption || undefined,
        takenAt: row.takenAt || undefined,
        createdAt: row.createdAt,
      })),
      floorplans: floorplansRows.map(row => ({
        id: row.id,
        leadId: row.leadId,
        fileId: row.fileId || undefined,
        label: row.label || undefined,
        scale: row.scale || undefined,
        metadata: row.metadata as any || undefined,
        createdAt: row.createdAt,
      })),
    };

    const response: ApiResponse<LeadWorkspace> = {
      success: true,
      data: workspace,
    };
    res.json(response);
  } catch (error) {
    console.error('Error fetching lead workspace:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    res.status(500).json(response);
  }
});

/**
 * PATCH /api/leads/:id/contact
 * Update lead contact information
 */
router.patch('/:id/contact', async (req: Request, res: Response) => {
  try {
    const leadId = parseInt(req.params.id);
    if (isNaN(leadId)) {
      return res.status(400).json({ success: false, error: 'Invalid lead ID' });
    }

    const dto: UpdateLeadContactDto = req.body;

    // Check if contact exists, create if not
    const [existing] = await db.select().from(leadContacts).where(eq(leadContacts.leadId, leadId));

    let result;
    if (existing) {
      // Update existing
      [result] = await db
        .update(leadContacts)
        .set({ ...dto, updatedAt: new Date() })
        .where(eq(leadContacts.leadId, leadId))
        .returning();
    } else {
      // Create new
      [result] = await db
        .insert(leadContacts)
        .values({ leadId, ...dto } as any)
        .returning();
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error updating lead contact:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * PATCH /api/leads/:id/occupancy
 * Update lead occupancy information
 */
router.patch('/:id/occupancy', async (req: Request, res: Response) => {
  try {
    const leadId = parseInt(req.params.id);
    if (isNaN(leadId)) {
      return res.status(400).json({ success: false, error: 'Invalid lead ID' });
    }

    const dto: UpdateLeadOccupancyDto = req.body;

    const [existing] = await db.select().from(leadOccupancy).where(eq(leadOccupancy.leadId, leadId));

    let result;
    if (existing) {
      [result] = await db
        .update(leadOccupancy)
        .set({ ...dto, updatedAt: new Date() })
        .where(eq(leadOccupancy.leadId, leadId))
        .returning();
    } else {
      [result] = await db
        .insert(leadOccupancy)
        .values({ leadId, ...dto } as any)
        .returning();
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error updating lead occupancy:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * PATCH /api/leads/:id/property
 * Update property information
 */
router.patch('/:id/property', async (req: Request, res: Response) => {
  try {
    const leadId = parseInt(req.params.id);
    if (isNaN(leadId)) {
      return res.status(400).json({ success: false, error: 'Invalid lead ID' });
    }

    const dto: UpdatePropertyDto = req.body;

    const [existing] = await db.select().from(properties).where(eq(properties.leadId, leadId));

    let result;
    if (existing) {
      [result] = await db
        .update(properties)
        .set({ ...dto, updatedAt: new Date() })
        .where(eq(properties.leadId, leadId))
        .returning();
    } else {
      [result] = await db
        .insert(properties)
        .values({ leadId, ...dto } as any)
        .returning();
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error updating property:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * PATCH /api/leads/:id/heatloss
 * Update heat loss calculation
 */
router.patch('/:id/heatloss', async (req: Request, res: Response) => {
  try {
    const leadId = parseInt(req.params.id);
    if (isNaN(leadId)) {
      return res.status(400).json({ success: false, error: 'Invalid lead ID' });
    }

    const dto: UpdateLeadHeatlossDto = req.body;

    const [existing] = await db.select().from(leadHeatloss).where(eq(leadHeatloss.leadId, leadId));

    let result;
    if (existing) {
      [result] = await db
        .update(leadHeatloss)
        .set({ ...dto, updatedAt: new Date() })
        .where(eq(leadHeatloss.leadId, leadId))
        .returning();
    } else {
      [result] = await db
        .insert(leadHeatloss)
        .values({ leadId, ...dto } as any)
        .returning();
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error updating heat loss:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /api/leads/:id/technologies
 * Add a technology/equipment
 */
router.post('/:id/technologies', async (req: Request, res: Response) => {
  try {
    const leadId = parseInt(req.params.id);
    if (isNaN(leadId)) {
      return res.status(400).json({ success: false, error: 'Invalid lead ID' });
    }

    const dto: CreateLeadTechnologyDto = req.body;

    const [result] = await db
      .insert(leadTechnologies)
      .values({ leadId, ...dto } as any)
      .returning();

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error adding technology:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * DELETE /api/leads/:id/technologies/:techId
 * Remove a technology/equipment
 */
router.delete('/:id/technologies/:techId', async (req: Request, res: Response) => {
  try {
    const techId = parseInt(req.params.techId);
    if (isNaN(techId)) {
      return res.status(400).json({ success: false, error: 'Invalid technology ID' });
    }

    await db.delete(leadTechnologies).where(eq(leadTechnologies.id, techId));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting technology:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /api/leads/:id/interests
 * Add an interest
 */
router.post('/:id/interests', async (req: Request, res: Response) => {
  try {
    const leadId = parseInt(req.params.id);
    if (isNaN(leadId)) {
      return res.status(400).json({ success: false, error: 'Invalid lead ID' });
    }

    const dto: CreateLeadInterestDto = req.body;

    const [result] = await db
      .insert(leadInterests)
      .values({ leadId, ...dto } as any)
      .returning();

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error adding interest:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * DELETE /api/leads/:id/interests/:interestId
 * Remove an interest
 */
router.delete('/:id/interests/:interestId', async (req: Request, res: Response) => {
  try {
    const interestId = parseInt(req.params.interestId);
    if (isNaN(interestId)) {
      return res.status(400).json({ success: false, error: 'Invalid interest ID' });
    }

    await db.delete(leadInterests).where(eq(leadInterests.id, interestId));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting interest:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /api/leads/:id/future-plans
 * Add a future plan
 */
router.post('/:id/future-plans', async (req: Request, res: Response) => {
  try {
    const leadId = parseInt(req.params.id);
    if (isNaN(leadId)) {
      return res.status(400).json({ success: false, error: 'Invalid lead ID' });
    }

    const dto: CreateLeadFuturePlanDto = req.body;

    const [result] = await db
      .insert(leadFuturePlans)
      .values({ leadId, ...dto } as any)
      .returning();

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error adding future plan:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * DELETE /api/leads/:id/future-plans/:planId
 * Remove a future plan
 */
router.delete('/:id/future-plans/:planId', async (req: Request, res: Response) => {
  try {
    const planId = parseInt(req.params.planId);
    if (isNaN(planId)) {
      return res.status(400).json({ success: false, error: 'Invalid plan ID' });
    }

    await db.delete(leadFuturePlans).where(eq(leadFuturePlans.id, planId));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting future plan:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /api/leads/:id/recommendations
 * Add a recommendation
 */
router.post('/:id/recommendations', async (req: Request, res: Response) => {
  try {
    const leadId = parseInt(req.params.id);
    if (isNaN(leadId)) {
      return res.status(400).json({ success: false, error: 'Invalid lead ID' });
    }

    const dto: CreateRecommendationDto = req.body;

    const [result] = await db
      .insert(recommendations)
      .values({ leadId, ...dto } as any)
      .returning();

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error adding recommendation:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * PUT /api/leads/:id/recommendations/:recId
 * Update a recommendation
 */
router.put('/:id/recommendations/:recId', async (req: Request, res: Response) => {
  try {
    const recId = parseInt(req.params.recId);
    if (isNaN(recId)) {
      return res.status(400).json({ success: false, error: 'Invalid recommendation ID' });
    }

    const dto: UpdateRecommendationDto = req.body;

    const [result] = await db
      .update(recommendations)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(recommendations.id, recId))
      .returning();

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error updating recommendation:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * DELETE /api/leads/:id/recommendations/:recId
 * Remove a recommendation
 */
router.delete('/:id/recommendations/:recId', async (req: Request, res: Response) => {
  try {
    const recId = parseInt(req.params.recId);
    if (isNaN(recId)) {
      return res.status(400).json({ success: false, error: 'Invalid recommendation ID' });
    }

    await db.delete(recommendations).where(eq(recommendations.id, recId));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting recommendation:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /api/leads/:id/photos
 * Add a photo
 */
router.post('/:id/photos', async (req: Request, res: Response) => {
  try {
    const leadId = parseInt(req.params.id);
    if (isNaN(leadId)) {
      return res.status(400).json({ success: false, error: 'Invalid lead ID' });
    }

    const dto: CreateLeadPhotoDto = req.body;

    const [result] = await db
      .insert(leadPhotos)
      .values({ leadId, ...dto } as any)
      .returning();

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error adding photo:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * DELETE /api/leads/:id/photos/:photoId
 * Remove a photo
 */
router.delete('/:id/photos/:photoId', async (req: Request, res: Response) => {
  try {
    const photoId = parseInt(req.params.photoId);
    if (isNaN(photoId)) {
      return res.status(400).json({ success: false, error: 'Invalid photo ID' });
    }

    await db.delete(leadPhotos).where(eq(leadPhotos.id, photoId));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting photo:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /api/leads/:id/floorplans
 * Add a floorplan
 */
router.post('/:id/floorplans', async (req: Request, res: Response) => {
  try {
    const leadId = parseInt(req.params.id);
    if (isNaN(leadId)) {
      return res.status(400).json({ success: false, error: 'Invalid lead ID' });
    }

    const dto: CreatePropertyFloorplanDto = req.body;

    const [result] = await db
      .insert(propertyFloorplans)
      .values({ leadId, ...dto } as any)
      .returning();

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error adding floorplan:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * DELETE /api/leads/:id/floorplans/:floorplanId
 * Remove a floorplan
 */
router.delete('/:id/floorplans/:floorplanId', async (req: Request, res: Response) => {
  try {
    const floorplanId = parseInt(req.params.floorplanId);
    if (isNaN(floorplanId)) {
      return res.status(400).json({ success: false, error: 'Invalid floorplan ID' });
    }

    await db.delete(propertyFloorplans).where(eq(propertyFloorplans.id, floorplanId));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting floorplan:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
