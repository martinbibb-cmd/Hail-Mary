/**
 * Mains Performance Test Routes
 *
 * API endpoints for managing mains water supply performance tests.
 *
 * Endpoints:
 * - POST /api/mains-test - Create a new test with devices
 * - GET /api/mains-test/:testId - Get test by ID
 * - POST /api/mains-test/:testId/steps - Add steps to test
 * - POST /api/mains-test/:testId/observations - Add observation
 * - GET /api/mains-test/:testId/results - Get computed results
 * - DELETE /api/mains-test/:testId - Delete test
 * - GET /api/mains-test/property/:propertyId - Get all tests for property
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/drizzle-client';
import {
  mainsPerformanceTests,
  mainsTestDevices,
  mainsTestSteps,
  mainsTestObservations,
} from '../db/drizzle-schema';
import { eq } from 'drizzle-orm';
import type {
  ApiResponse,
  MainsPerformanceTest,
  MainsTestDevice,
  MainsTestStep,
  MainsTestObservation,
  CreateMainsTestRequest,
  CreateMainsTestResponse,
  AddStepsRequest,
  AddObservationRequest,
  GetMainsTestResultsResponse,
} from '@hail-mary/shared';
import { computeTestResults } from '../services/mainsTest.service';

const router = Router();

// POST / - Create a new mains performance test with devices
router.post('/', async (req: Request, res: Response) => {
  try {
    const data: CreateMainsTestRequest = req.body;

    // Validate request
    if (!data.sourcePoint) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'sourcePoint is required',
      };
      return res.status(400).json(response);
    }

    if (!data.devices || data.devices.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'At least one device is required',
      };
      return res.status(400).json(response);
    }

    // Get userId and accountId from request (assume auth middleware sets this)
    const userId = (req as any).user?.id || 1; // TODO: Replace with actual auth
    const accountId = (req as any).user?.accountId || 1;

    // Create test
    const [test] = await db
      .insert(mainsPerformanceTests)
      .values({
        propertyId: data.propertyId,
        surveyId: data.surveyId,
        userId,
        accountId,
        sourcePoint: data.sourcePoint,
        ambientTempC: data.ambientTempC?.toString(),
        notes: data.notes,
        createdBy: userId,
      })
      .returning();

    // Create devices
    const deviceValues = data.devices.map((device) => ({
      testId: test.id,
      label: device.label,
      location: device.location,
      sensorType: device.sensorType || 'manual',
      notes: device.notes,
    }));

    const devices = await db.insert(mainsTestDevices).values(deviceValues).returning();

    const response: ApiResponse<CreateMainsTestResponse> = {
      success: true,
      data: {
        test: {
          ...test,
          createdAt: test.createdAt,
          ambientTempC: test.ambientTempC ? parseFloat(test.ambientTempC) : undefined,
        } as MainsPerformanceTest,
        devices: devices.map((d) => ({
          ...d,
          createdAt: d.createdAt,
        })) as MainsTestDevice[],
      },
    };

    return res.status(201).json(response);
  } catch (error) {
    console.error('Error creating mains test:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to create mains test',
    };
    return res.status(500).json(response);
  }
});

// GET /property/:propertyId - Get all tests for property
router.get('/property/:propertyId', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;

    const tests = await db
      .select()
      .from(mainsPerformanceTests)
      .where(eq(mainsPerformanceTests.propertyId, parseInt(propertyId)));

    const response: ApiResponse<MainsPerformanceTest[]> = {
      success: true,
      data: tests.map((t) => ({
        ...t,
        createdAt: t.createdAt,
        ambientTempC: t.ambientTempC ? parseFloat(t.ambientTempC) : undefined,
      })) as MainsPerformanceTest[],
    };

    return res.json(response);
  } catch (error) {
    console.error('Error getting tests for property:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to get tests',
    };
    return res.status(500).json(response);
  }
});

// GET /:testId - Get test by ID
router.get('/:testId', async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;

    const test = await db.select().from(mainsPerformanceTests).where(eq(mainsPerformanceTests.id, testId)).limit(1);

    if (!test || test.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Test not found',
      };
      return res.status(404).json(response);
    }

    const devices = await db.select().from(mainsTestDevices).where(eq(mainsTestDevices.testId, testId));

    const steps = await db.select().from(mainsTestSteps).where(eq(mainsTestSteps.testId, testId));

    const observations = await db.select().from(mainsTestObservations).where(eq(mainsTestObservations.testId, testId));

    const response: ApiResponse<{
      test: MainsPerformanceTest;
      devices: MainsTestDevice[];
      steps: MainsTestStep[];
      observations: MainsTestObservation[];
    }> = {
      success: true,
      data: {
        test: {
          ...test[0],
          createdAt: test[0].createdAt,
          ambientTempC: test[0].ambientTempC ? parseFloat(test[0].ambientTempC) : undefined,
        } as MainsPerformanceTest,
        devices: devices.map((d) => ({
          ...d,
          createdAt: d.createdAt,
        })) as MainsTestDevice[],
        steps: steps.map((s) => ({
          ...s,
          createdAt: s.createdAt,
          targetFlowLpm: s.targetFlowLpm ? parseFloat(s.targetFlowLpm) : undefined,
        })) as MainsTestStep[],
        observations: observations.map((o) => ({
          ...o,
          timestamp: o.timestamp,
          pressureBar: o.pressureBar ? parseFloat(o.pressureBar) : undefined,
          flowLpm: o.flowLpm ? parseFloat(o.flowLpm) : undefined,
          waterTempC: o.waterTempC ? parseFloat(o.waterTempC) : undefined,
          qualityFlags: (o.qualityFlags as any) || [],
        })) as MainsTestObservation[],
      },
    };

    return res.json(response);
  } catch (error) {
    console.error('Error getting mains test:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to get mains test',
    };
    return res.status(500).json(response);
  }
});

// POST /:testId/steps - Add steps to test
router.post('/:testId/steps', async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const data: AddStepsRequest = req.body;

    // Verify test exists
    const test = await db.select().from(mainsPerformanceTests).where(eq(mainsPerformanceTests.id, testId)).limit(1);

    if (!test || test.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Test not found',
      };
      return res.status(404).json(response);
    }

    if (!data.steps || data.steps.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'At least one step is required',
      };
      return res.status(400).json(response);
    }

    // Create steps
    const stepValues = data.steps.map((step) => ({
      testId,
      index: step.index,
      label: step.label,
      outletCount: step.outletCount,
      valveState: step.valveState,
      durationSeconds: step.durationSeconds,
      targetFlowLpm: step.targetFlowLpm?.toString(),
      notes: step.notes,
    }));

    const steps = await db.insert(mainsTestSteps).values(stepValues).returning();

    const response: ApiResponse<MainsTestStep[]> = {
      success: true,
      data: steps.map((s) => ({
        ...s,
        createdAt: s.createdAt,
        targetFlowLpm: s.targetFlowLpm ? parseFloat(s.targetFlowLpm) : undefined,
      })) as MainsTestStep[],
    };

    return res.status(201).json(response);
  } catch (error) {
    console.error('Error adding steps:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to add steps',
    };
    return res.status(500).json(response);
  }
});

// POST /:testId/observations - Add observation
router.post('/:testId/observations', async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const data: AddObservationRequest = req.body;

    // Get userId from request
    const userId = (req as any).user?.id || 1;

    // Verify test exists
    const test = await db.select().from(mainsPerformanceTests).where(eq(mainsPerformanceTests.id, testId)).limit(1);

    if (!test || test.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Test not found',
      };
      return res.status(404).json(response);
    }

    // Verify ownership - user must own the test to add observations
    if (test[0].createdBy !== userId) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Unauthorized to add observations to this test',
      };
      return res.status(403).json(response);
    }

    // Verify step exists
    const step = await db.select().from(mainsTestSteps).where(eq(mainsTestSteps.id, data.stepId)).limit(1);

    if (!step || step.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Step not found',
      };
      return res.status(404).json(response);
    }

    // Verify device exists
    const device = await db.select().from(mainsTestDevices).where(eq(mainsTestDevices.id, data.deviceId)).limit(1);

    if (!device || device.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Device not found',
      };
      return res.status(404).json(response);
    }

    // Create observation
    const [observation] = await db
      .insert(mainsTestObservations)
      .values({
        testId,
        stepId: data.stepId,
        deviceId: data.deviceId,
        pressureBar: data.pressureBar?.toString(),
        flowLpm: data.flowLpm?.toString(),
        waterTempC: data.waterTempC?.toString(),
        qualityFlags: data.qualityFlags || [],
        method: data.method || 'manual',
        enteredBy: userId,
      })
      .returning();

    const response: ApiResponse<MainsTestObservation> = {
      success: true,
      data: {
        ...observation,
        timestamp: observation.timestamp,
        pressureBar: observation.pressureBar ? parseFloat(observation.pressureBar) : undefined,
        flowLpm: observation.flowLpm ? parseFloat(observation.flowLpm) : undefined,
        waterTempC: observation.waterTempC ? parseFloat(observation.waterTempC) : undefined,
        qualityFlags: (observation.qualityFlags as any) || [],
      } as MainsTestObservation,
    };

    return res.status(201).json(response);
  } catch (error) {
    console.error('Error adding observation:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to add observation',
    };
    return res.status(500).json(response);
  }
});

// GET /:testId/results - Get computed results
router.get('/:testId/results', async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;

    const test = await db.select().from(mainsPerformanceTests).where(eq(mainsPerformanceTests.id, testId)).limit(1);

    if (!test || test.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Test not found',
      };
      return res.status(404).json(response);
    }

    const devices = await db.select().from(mainsTestDevices).where(eq(mainsTestDevices.testId, testId));

    const steps = await db.select().from(mainsTestSteps).where(eq(mainsTestSteps.testId, testId));

    const observations = await db.select().from(mainsTestObservations).where(eq(mainsTestObservations.testId, testId));

    // Convert to proper types
    const testData: MainsPerformanceTest = {
      ...test[0],
      createdAt: test[0].createdAt,
      ambientTempC: test[0].ambientTempC ? parseFloat(test[0].ambientTempC) : undefined,
    } as MainsPerformanceTest;

    const devicesData: MainsTestDevice[] = devices.map((d) => ({
      ...d,
      createdAt: d.createdAt,
    })) as MainsTestDevice[];

    const stepsData: MainsTestStep[] = steps.map((s) => ({
      ...s,
      createdAt: s.createdAt,
      targetFlowLpm: s.targetFlowLpm ? parseFloat(s.targetFlowLpm) : undefined,
    })) as MainsTestStep[];

    const observationsData: MainsTestObservation[] = observations.map((o) => ({
      ...o,
      timestamp: o.timestamp,
      pressureBar: o.pressureBar ? parseFloat(o.pressureBar) : undefined,
      flowLpm: o.flowLpm ? parseFloat(o.flowLpm) : undefined,
      waterTempC: o.waterTempC ? parseFloat(o.waterTempC) : undefined,
      qualityFlags: (o.qualityFlags as any) || [],
    })) as MainsTestObservation[];

    // Compute results
    const results = computeTestResults(testData, devicesData, stepsData, observationsData);

    const response: ApiResponse<GetMainsTestResultsResponse> = {
      success: true,
      data: {
        test: testData,
        devices: devicesData,
        steps: stepsData,
        observations: observationsData,
        results,
      },
    };

    return res.json(response);
  } catch (error) {
    console.error('Error computing results:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to compute results',
    };
    return res.status(500).json(response);
  }
});

// DELETE /:testId - Delete test
router.delete('/:testId', async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;

    const test = await db.select().from(mainsPerformanceTests).where(eq(mainsPerformanceTests.id, testId)).limit(1);

    if (!test || test.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Test not found',
      };
      return res.status(404).json(response);
    }

    // Delete test (cascade will handle devices, steps, observations)
    await db.delete(mainsPerformanceTests).where(eq(mainsPerformanceTests.id, testId));

    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'Test deleted successfully' },
    };

    return res.json(response);
  } catch (error) {
    console.error('Error deleting test:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to delete test',
    };
    return res.status(500).json(response);
  }
});

export default router;
