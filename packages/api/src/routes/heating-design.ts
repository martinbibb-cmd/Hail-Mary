/**
 * Heating Design System API Routes
 *
 * Endpoints for heating system design workflow:
 * - Projects, floor plans, building data
 * - Heat loss calculations
 * - Radiator selection
 * - Pipe routing
 */

import express, { Request, Response } from 'express';
import { db } from '../db/drizzle-client';
import {
  heatingProjects,
  heatingFloorPlans,
  heatingBuildingData,
  heatingRooms,
  heatingHeatLossResults,
  heatingRadiatorCatalog,
  heatingRadiatorSelections,
  heatingPipeNetworks,
} from '../db/drizzle-schema';
import { eq, and, desc } from 'drizzle-orm';
import {
  calculateRoomHeatLoss,
  calculateBuildingHeatLoss,
  calculateTotalHeatLoad,
} from '@hail-mary/heating-engine';
import {
  selectRadiator,
  selectRadiatorsForBuilding,
} from '@hail-mary/heating-engine';
import {
  HeatLossInputs,
  BuildingData,
  ClimateData,
  DesignConditions,
  Room,
  FlowTemperature,
  defaultTargetTemperatures,
  ukClimateData,
  thermalBridging,
} from '@hail-mary/shared';

const router = express.Router();

// ============================================================================
// Project Management
// ============================================================================

/**
 * GET /api/heating-design/projects
 * List all heating design projects for current user
 */
router.get('/projects', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const projects = await db
      .select()
      .from(heatingProjects)
      .where(eq(heatingProjects.userId, userId))
      .orderBy(desc(heatingProjects.updatedAt));

    res.json(projects);
  } catch (error) {
    console.error('Error fetching heating projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

/**
 * POST /api/heating-design/projects
 * Create a new heating design project
 */
router.post('/projects', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const accountId = (req as any).user?.accountId;

    if (!userId || !accountId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, leadId } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const [project] = await db
      .insert(heatingProjects)
      .values({
        name,
        leadId: leadId || null,
        userId,
        accountId,
        status: 'draft',
      })
      .returning();

    res.status(201).json(project);
  } catch (error) {
    console.error('Error creating heating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

/**
 * GET /api/heating-design/projects/:id
 * Get a specific project with all related data
 */
router.get('/projects/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const projectId = req.params.id;

    const [project] = await db
      .select()
      .from(heatingProjects)
      .where(and(
        eq(heatingProjects.id, projectId),
        eq(heatingProjects.userId, userId)
      ));

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Fetch related data
    const [floorPlan] = await db
      .select()
      .from(heatingFloorPlans)
      .where(eq(heatingFloorPlans.projectId, projectId));

    const [buildingDataRow] = await db
      .select()
      .from(heatingBuildingData)
      .where(eq(heatingBuildingData.projectId, projectId));

    const rooms = floorPlan ? await db
      .select()
      .from(heatingRooms)
      .where(eq(heatingRooms.floorPlanId, floorPlan.id)) : [];

    const [pipeNetwork] = await db
      .select()
      .from(heatingPipeNetworks)
      .where(eq(heatingPipeNetworks.projectId, projectId));

    res.json({
      project,
      floorPlan,
      buildingData: buildingDataRow,
      rooms,
      pipeNetwork,
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

/**
 * PUT /api/heating-design/projects/:id
 * Update project details
 */
router.put('/projects/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const projectId = req.params.id;
    const { name, status } = req.body;

    const [updated] = await db
      .update(heatingProjects)
      .set({
        name,
        status,
        updatedAt: new Date(),
      })
      .where(and(
        eq(heatingProjects.id, projectId),
        eq(heatingProjects.userId, userId)
      ))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

/**
 * DELETE /api/heating-design/projects/:id
 * Delete a project and all related data
 */
router.delete('/projects/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const projectId = req.params.id;

    await db
      .delete(heatingProjects)
      .where(and(
        eq(heatingProjects.id, projectId),
        eq(heatingProjects.userId, userId)
      ));

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// ============================================================================
// Building Data
// ============================================================================

/**
 * POST /api/heating-design/projects/:id/building-data
 * Create or update building data for a project
 */
router.post('/projects/:id/building-data', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const projectId = req.params.id;

    // Verify project ownership
    const [project] = await db
      .select()
      .from(heatingProjects)
      .where(and(
        eq(heatingProjects.id, projectId),
        eq(heatingProjects.userId, userId)
      ));

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const buildingDataInput = req.body;

    // Check if building data already exists
    const [existing] = await db
      .select()
      .from(heatingBuildingData)
      .where(eq(heatingBuildingData.projectId, projectId));

    let result;

    if (existing) {
      // Update existing
      [result] = await db
        .update(heatingBuildingData)
        .set({
          ...buildingDataInput,
          updatedAt: new Date(),
        })
        .where(eq(heatingBuildingData.projectId, projectId))
        .returning();
    } else {
      // Create new
      [result] = await db
        .insert(heatingBuildingData)
        .values({
          projectId,
          ...buildingDataInput,
        })
        .returning();
    }

    res.json(result);
  } catch (error) {
    console.error('Error saving building data:', error);
    res.status(500).json({ error: 'Failed to save building data' });
  }
});

// ============================================================================
// Heat Loss Calculations
// ============================================================================

/**
 * POST /api/heating-design/projects/:id/calculate-heat-loss
 * Calculate heat loss for all rooms in the project
 */
router.post('/projects/:id/calculate-heat-loss', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const projectId = req.params.id;

    // Fetch project and verify ownership
    const [project] = await db
      .select()
      .from(heatingProjects)
      .where(and(
        eq(heatingProjects.id, projectId),
        eq(heatingProjects.userId, userId)
      ));

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Fetch building data
    const [buildingDataRow] = await db
      .select()
      .from(heatingBuildingData)
      .where(eq(heatingBuildingData.projectId, projectId));

    if (!buildingDataRow) {
      return res.status(400).json({ error: 'Building data not found. Please add building construction details first.' });
    }

    // Fetch floor plan and rooms
    const [floorPlan] = await db
      .select()
      .from(heatingFloorPlans)
      .where(eq(heatingFloorPlans.projectId, projectId));

    if (!floorPlan) {
      return res.status(400).json({ error: 'Floor plan not found. Please import a floor plan first.' });
    }

    const roomsData = await db
      .select()
      .from(heatingRooms)
      .where(eq(heatingRooms.floorPlanId, floorPlan.id));

    if (roomsData.length === 0) {
      return res.status(400).json({ error: 'No rooms found in floor plan' });
    }

    // Prepare inputs for heat loss calculation
    const building: BuildingData = {
      id: buildingDataRow.id,
      projectId: buildingDataRow.projectId,
      address: buildingDataRow.address || '',
      postcode: buildingDataRow.postcode || '',
      constructionYear: buildingDataRow.constructionYear || undefined,
      wallConstruction: buildingDataRow.wallConstruction as any,
      wallUValue: buildingDataRow.wallUValue ? Number(buildingDataRow.wallUValue) : undefined,
      roofConstruction: buildingDataRow.roofConstruction as any,
      roofUValue: buildingDataRow.roofUValue ? Number(buildingDataRow.roofUValue) : undefined,
      floorConstruction: buildingDataRow.floorConstruction as any,
      floorUValue: buildingDataRow.floorUValue ? Number(buildingDataRow.floorUValue) : undefined,
      airChangesPerHour: Number(buildingDataRow.airChangesPerHour) || 1.0,
    };

    // Determine climate data based on postcode
    const climate: ClimateData = {
      postcode: building.postcode,
      outsideDesignTemp: Number(buildingDataRow.outsideDesignTemp) || -3,
      windSpeed: 4.5,
      altitude: 50,
      region: 'UK',
    };

    const designConditions: DesignConditions = {
      targetTemperatures: defaultTargetTemperatures,
      infiltrationRate: building.airChangesPerHour,
      thermalBridging: Number(buildingDataRow.thermalBridging) || 0.15,
      safetyMargin: Number(buildingDataRow.safetyMargin) || 15,
      flowTemperature: (buildingDataRow.flowTemperature as FlowTemperature) || '70/50',
    };

    // Parse rooms from stored JSON geometry
    const rooms: Room[] = roomsData.map(r => r.geometry as Room);

    // Calculate heat loss for all rooms
    const results = calculateBuildingHeatLoss(
      rooms,
      building,
      climate,
      designConditions
    );

    // Save results to database
    for (const result of results) {
      // Delete existing results for this room
      await db
        .delete(heatingHeatLossResults)
        .where(eq(heatingHeatLossResults.roomId, result.roomId));

      // Insert new result
      await db
        .insert(heatingHeatLossResults)
        .values({
          roomId: result.roomId,
          fabricLoss: result.fabricLoss.toString(),
          ventilationLoss: result.ventilationLoss.toString(),
          totalLoss: result.totalLoss.toString(),
          requiredOutput: result.requiredOutput.toString(),
          breakdown: result.breakdown as any,
          overridden: false,
        });
    }

    // Update project status
    await db
      .update(heatingProjects)
      .set({
        status: 'heat_loss_calculated',
        updatedAt: new Date(),
      })
      .where(eq(heatingProjects.id, projectId));

    // Calculate total heat load
    const totalLoad = calculateTotalHeatLoad(results);

    res.json({
      results,
      totalLoad,
      roomCount: results.length,
    });
  } catch (error) {
    console.error('Error calculating heat loss:', error);
    res.status(500).json({ error: 'Failed to calculate heat loss' });
  }
});

/**
 * GET /api/heating-design/projects/:id/heat-loss
 * Get heat loss results for a project
 */
router.get('/projects/:id/heat-loss', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const projectId = req.params.id;

    // Verify project ownership
    const [project] = await db
      .select()
      .from(heatingProjects)
      .where(and(
        eq(heatingProjects.id, projectId),
        eq(heatingProjects.userId, userId)
      ));

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Fetch floor plan and rooms
    const [floorPlan] = await db
      .select()
      .from(heatingFloorPlans)
      .where(eq(heatingFloorPlans.projectId, projectId));

    if (!floorPlan) {
      return res.status(404).json({ error: 'Floor plan not found' });
    }

    const roomsData = await db
      .select()
      .from(heatingRooms)
      .where(eq(heatingRooms.floorPlanId, floorPlan.id));

    const roomIds = roomsData.map(r => r.id);

    // Fetch heat loss results
    const results = await db
      .select()
      .from(heatingHeatLossResults)
      .where(eq(heatingHeatLossResults.roomId, roomIds[0])); // TODO: Fix this to get all rooms

    res.json(results);
  } catch (error) {
    console.error('Error fetching heat loss results:', error);
    res.status(500).json({ error: 'Failed to fetch heat loss results' });
  }
});

// ============================================================================
// Radiator Catalog
// ============================================================================

/**
 * GET /api/heating-design/radiators/catalog
 * Get all radiators from catalog
 */
router.get('/radiators/catalog', async (req: Request, res: Response) => {
  try {
    const radiators = await db
      .select()
      .from(heatingRadiatorCatalog)
      .orderBy(heatingRadiatorCatalog.manufacturer, heatingRadiatorCatalog.model);

    res.json(radiators);
  } catch (error) {
    console.error('Error fetching radiator catalog:', error);
    res.status(500).json({ error: 'Failed to fetch radiator catalog' });
  }
});

/**
 * GET /api/heating-design/uvalues
 * Get U-value reference data
 */
router.get('/uvalues', async (req: Request, res: Response) => {
  try {
    const { wallConstructions, roofConstructions, floorConstructions, glazingTypes } = await import('@hail-mary/shared');

    res.json({
      walls: wallConstructions,
      roofs: roofConstructions,
      floors: floorConstructions,
      glazing: glazingTypes,
    });
  } catch (error) {
    console.error('Error fetching U-values:', error);
    res.status(500).json({ error: 'Failed to fetch U-values' });
  }
});

export default router;
