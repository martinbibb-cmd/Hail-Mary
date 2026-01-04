/**
 * Job Graph API Routes
 *
 * Routes for managing job graphs, milestones, facts, decisions, and conflicts
 *
 * Core endpoints:
 * - GET    /api/job-graph/visits/:visitId               - Get complete job graph state
 * - POST   /api/job-graph/visits/:visitId               - Initialize job graph
 * - POST   /api/job-graph/:jobGraphId/facts             - Add fact
 * - POST   /api/job-graph/:jobGraphId/decisions         - Record decision
 * - GET    /api/job-graph/:jobGraphId/conflicts         - Get conflicts
 * - POST   /api/job-graph/:jobGraphId/process           - Process/update job graph state
 * - GET    /api/job-graph/:jobGraphId/summary           - Get summary
 * - GET    /api/job-graph/:jobGraphId/completeness      - Get completeness assessment
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/drizzle-client';
import {
  spineJobGraphs,
  spineMilestones,
  spineFacts,
  spineDecisions,
  spineConflicts,
  spineVisits,
} from '../db/drizzle-schema';
import { eq, and, desc, isNull } from 'drizzle-orm';
import {
  createJobGraph,
  JobGraphState,
  StandardMilestone,
  FactCategory,
  DecisionType,
  Confidence,
} from '@hail-mary/shared';

const router = Router();

/**
 * Get complete job graph state for a visit
 * GET /api/job-graph/visits/:visitId
 */
router.get('/visits/:visitId', async (req: Request, res: Response) => {
  try {
    const { visitId } = req.params;

    // Get job graph
    const [jobGraphRow] = await db
      .select()
      .from(spineJobGraphs)
      .where(eq(spineJobGraphs.visitId, visitId))
      .limit(1);

    if (!jobGraphRow) {
      return res.status(404).json({
        success: false,
        error: 'Job graph not found for this visit',
      });
    }

    // Get all related data
    const [milestones, facts, decisions, conflicts] = await Promise.all([
      db
        .select()
        .from(spineMilestones)
        .where(eq(spineMilestones.jobGraphId, jobGraphRow.id))
        .orderBy(spineMilestones.createdAt),
      db
        .select()
        .from(spineFacts)
        .where(eq(spineFacts.jobGraphId, jobGraphRow.id))
        .orderBy(spineFacts.createdAt),
      db
        .select()
        .from(spineDecisions)
        .where(eq(spineDecisions.jobGraphId, jobGraphRow.id))
        .orderBy(spineDecisions.createdAt),
      db
        .select()
        .from(spineConflicts)
        .where(eq(spineConflicts.jobGraphId, jobGraphRow.id))
        .orderBy(desc(spineConflicts.createdAt)),
    ]);

    // Build state object
    const state: JobGraphState = {
      graph: {
        id: jobGraphRow.id,
        visitId: jobGraphRow.visitId,
        propertyId: jobGraphRow.propertyId,
        status: jobGraphRow.status as any,
        overallConfidence: jobGraphRow.overallConfidence,
        createdAt: jobGraphRow.createdAt,
        updatedAt: jobGraphRow.updatedAt,
      },
      milestones: milestones.map((m) => ({
        id: m.id,
        jobGraphId: m.jobGraphId,
        key: m.key,
        label: m.label,
        status: m.status as any,
        confidence: m.confidence,
        blockers: m.blockers as string[],
        metadata: m.metadata as any,
        completedAt: m.completedAt ?? undefined,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      })),
      facts: facts.map((f) => ({
        id: f.id,
        jobGraphId: f.jobGraphId,
        sourceEventId: f.sourceEventId ?? undefined,
        category: f.category as FactCategory,
        key: f.key,
        value: f.value,
        unit: f.unit ?? undefined,
        confidence: f.confidence,
        extractedBy: f.extractedBy as any,
        notes: f.notes ?? undefined,
        createdAt: f.createdAt,
      })),
      decisions: decisions.map((d) => ({
        id: d.id,
        jobGraphId: d.jobGraphId,
        milestoneId: d.milestoneId ?? undefined,
        decisionType: d.decisionType as DecisionType,
        decision: d.decision,
        reasoning: d.reasoning,
        ruleApplied: d.ruleApplied as any,
        evidenceFactIds: d.evidenceFactIds,
        confidence: d.confidence,
        risks: d.risks as string[],
        createdAt: d.createdAt,
        createdBy: d.createdBy as any,
      })),
      conflicts: conflicts.map((c) => ({
        id: c.id,
        jobGraphId: c.jobGraphId,
        conflictType: c.conflictType as any,
        severity: c.severity as any,
        description: c.description,
        rule1: c.rule1 as any,
        rule2: c.rule2 as any,
        resolution: c.resolution ?? undefined,
        affectedFactIds: c.affectedFactIds,
        affectedDecisionIds: c.affectedDecisionIds,
        resolvedAt: c.resolvedAt ?? undefined,
        createdAt: c.createdAt,
      })),
    };

    res.json({
      success: true,
      data: state,
    });
  } catch (error) {
    console.error('Error getting job graph:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * Initialize job graph for a visit
 * POST /api/job-graph/visits/:visitId
 */
router.post('/visits/:visitId', async (req: Request, res: Response) => {
  try {
    const { visitId } = req.params;

    // Check if visit exists
    const [visit] = await db
      .select()
      .from(spineVisits)
      .where(eq(spineVisits.id, visitId))
      .limit(1);

    if (!visit) {
      return res.status(404).json({
        success: false,
        error: 'Visit not found',
      });
    }

    // Check if job graph already exists
    const [existing] = await db
      .select()
      .from(spineJobGraphs)
      .where(eq(spineJobGraphs.visitId, visitId))
      .limit(1);

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Job graph already exists for this visit',
      });
    }

    // Create job graph using orchestrator
    const jobGraphId = `jg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const { orchestrator, initialState } = createJobGraph(
      jobGraphId,
      visitId,
      visit.propertyId
    );

    // Save to database
    const [jobGraph] = await db
      .insert(spineJobGraphs)
      .values({
        id: jobGraphId,
        visitId: visitId,
        propertyId: visit.propertyId,
        status: initialState.graph.status,
        overallConfidence: initialState.graph.overallConfidence,
      })
      .returning();

    // Save milestones
    const milestoneValues = initialState.milestones.map((m) => ({
      id: m.id,
      jobGraphId: jobGraph.id,
      key: m.key,
      label: m.label,
      status: m.status,
      confidence: m.confidence,
      blockers: m.blockers,
      metadata: m.metadata,
    }));

    await db.insert(spineMilestones).values(milestoneValues);

    // Return initial state
    res.status(201).json({
      success: true,
      data: {
        jobGraphId: jobGraph.id,
        status: jobGraph.status,
        milestonesCreated: milestoneValues.length,
      },
    });
  } catch (error) {
    console.error('Error initializing job graph:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * Add a fact to the job graph
 * POST /api/job-graph/:jobGraphId/facts
 */
router.post('/:jobGraphId/facts', async (req: Request, res: Response) => {
  try {
    const { jobGraphId } = req.params;
    const { category, key, value, sourceEventId, unit, confidence, extractedBy, notes } =
      req.body;

    // Validate required fields
    if (!category || !key || value === undefined) {
      return res.status(400).json({
        success: false,
        error: 'category, key, and value are required',
      });
    }

    // Check if job graph exists
    const [jobGraph] = await db
      .select()
      .from(spineJobGraphs)
      .where(eq(spineJobGraphs.id, jobGraphId))
      .limit(1);

    if (!jobGraph) {
      return res.status(404).json({
        success: false,
        error: 'Job graph not found',
      });
    }

    // Create fact
    const [fact] = await db
      .insert(spineFacts)
      .values({
        jobGraphId,
        sourceEventId: sourceEventId || null,
        category,
        key,
        value,
        unit: unit || null,
        confidence: confidence ?? 50,
        extractedBy: extractedBy || 'manual',
        notes: notes || null,
      })
      .returning();

    res.status(201).json({
      success: true,
      data: fact,
    });
  } catch (error) {
    console.error('Error adding fact:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * Record a decision
 * POST /api/job-graph/:jobGraphId/decisions
 */
router.post('/:jobGraphId/decisions', async (req: Request, res: Response) => {
  try {
    const { jobGraphId } = req.params;
    const {
      milestoneId,
      decisionType,
      decision,
      reasoning,
      ruleApplied,
      evidenceFactIds,
      confidence,
      risks,
      createdBy,
    } = req.body;

    // Validate required fields
    if (!decisionType || !decision || !reasoning) {
      return res.status(400).json({
        success: false,
        error: 'decisionType, decision, and reasoning are required',
      });
    }

    // Check if job graph exists
    const [jobGraph] = await db
      .select()
      .from(spineJobGraphs)
      .where(eq(spineJobGraphs.id, jobGraphId))
      .limit(1);

    if (!jobGraph) {
      return res.status(404).json({
        success: false,
        error: 'Job graph not found',
      });
    }

    // Create decision
    const [decisionRecord] = await db
      .insert(spineDecisions)
      .values({
        jobGraphId,
        milestoneId: milestoneId || null,
        decisionType,
        decision,
        reasoning,
        ruleApplied: ruleApplied || null,
        evidenceFactIds: evidenceFactIds || [],
        confidence: confidence ?? 50,
        risks: risks || [],
        createdBy: createdBy || 'manual',
      })
      .returning();

    res.status(201).json({
      success: true,
      data: decisionRecord,
    });
  } catch (error) {
    console.error('Error recording decision:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * Get conflicts for a job graph
 * GET /api/job-graph/:jobGraphId/conflicts?unresolved=true
 */
router.get('/:jobGraphId/conflicts', async (req: Request, res: Response) => {
  try {
    const { jobGraphId } = req.params;
    const unresolvedOnly = req.query.unresolved === 'true';

    const whereClause = unresolvedOnly
      ? and(
          eq(spineConflicts.jobGraphId, jobGraphId),
          isNull(spineConflicts.resolvedAt)
        )
      : eq(spineConflicts.jobGraphId, jobGraphId);

    const conflicts = await db
      .select()
      .from(spineConflicts)
      .where(whereClause)
      .orderBy(desc(spineConflicts.createdAt));

    res.json({
      success: true,
      data: conflicts,
    });
  } catch (error) {
    console.error('Error getting conflicts:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * Process job graph state (run conflict detection, validation, update milestones)
 * POST /api/job-graph/:jobGraphId/process
 */
router.post('/:jobGraphId/process', async (req: Request, res: Response) => {
  try {
    const { jobGraphId } = req.params;

    // Get current state from database
    const [jobGraphRow] = await db
      .select()
      .from(spineJobGraphs)
      .where(eq(spineJobGraphs.id, jobGraphId))
      .limit(1);

    if (!jobGraphRow) {
      return res.status(404).json({
        success: false,
        error: 'Job graph not found',
      });
    }

    // Get all related data
    const [milestones, facts, decisions, conflicts] = await Promise.all([
      db.select().from(spineMilestones).where(eq(spineMilestones.jobGraphId, jobGraphId)),
      db.select().from(spineFacts).where(eq(spineFacts.jobGraphId, jobGraphId)),
      db.select().from(spineDecisions).where(eq(spineDecisions.jobGraphId, jobGraphId)),
      db.select().from(spineConflicts).where(eq(spineConflicts.jobGraphId, jobGraphId)),
    ]);

    // Build current state (simplified - in real implementation would use mapper)
    const currentState: JobGraphState = {
      graph: {
        id: jobGraphRow.id,
        visitId: jobGraphRow.visitId,
        propertyId: jobGraphRow.propertyId,
        status: jobGraphRow.status as any,
        overallConfidence: jobGraphRow.overallConfidence,
        createdAt: jobGraphRow.createdAt,
        updatedAt: jobGraphRow.updatedAt,
      },
      milestones: milestones.map((m) => ({
        id: m.id,
        jobGraphId: m.jobGraphId,
        key: m.key,
        label: m.label,
        status: m.status as any,
        confidence: m.confidence,
        blockers: m.blockers as string[],
        metadata: m.metadata as any,
        completedAt: m.completedAt ?? undefined,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      })),
      facts: [] as any[], // Simplified
      decisions: [] as any[], // Simplified
      conflicts: [] as any[], // Simplified
    };

    // Process with orchestrator
    const { orchestrator } = createJobGraph(
      jobGraphId,
      jobGraphRow.visitId,
      jobGraphRow.propertyId
    );

    const { updatedState, summary, completeness } =
      orchestrator.processJobGraphState(currentState);

    // Update database with new state
    await db
      .update(spineJobGraphs)
      .set({
        status: updatedState.graph.status,
        overallConfidence: updatedState.graph.overallConfidence,
        updatedAt: new Date(),
      })
      .where(eq(spineJobGraphs.id, jobGraphId));

    // Note: In full implementation, would also update milestones, add new conflicts, etc.

    res.json({
      success: true,
      data: {
        summary,
        completeness,
      },
    });
  } catch (error) {
    console.error('Error processing job graph:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

/**
 * Get job graph summary
 * GET /api/job-graph/:jobGraphId/summary
 */
router.get('/:jobGraphId/summary', async (req: Request, res: Response) => {
  try {
    const { jobGraphId } = req.params;

    const [jobGraph] = await db
      .select()
      .from(spineJobGraphs)
      .where(eq(spineJobGraphs.id, jobGraphId))
      .limit(1);

    if (!jobGraph) {
      return res.status(404).json({
        success: false,
        error: 'Job graph not found',
      });
    }

    // Get counts
    const [milestones, conflicts] = await Promise.all([
      db.select().from(spineMilestones).where(eq(spineMilestones.jobGraphId, jobGraphId)),
      db
        .select()
        .from(spineConflicts)
        .where(
          and(eq(spineConflicts.jobGraphId, jobGraphId), isNull(spineConflicts.resolvedAt))
        ),
    ]);

    const completedMilestones = milestones.filter((m) => m.status === 'complete').length;
    const criticalConflicts = conflicts.filter((c) => c.severity === 'critical').length;
    const warningConflicts = conflicts.filter((c) => c.severity === 'warning').length;

    res.json({
      success: true,
      data: {
        id: jobGraph.id,
        visitId: jobGraph.visitId,
        propertyId: jobGraph.propertyId,
        status: jobGraph.status,
        overallConfidence: jobGraph.overallConfidence,
        completedMilestones,
        totalMilestones: milestones.length,
        criticalConflicts,
        warningConflicts,
        updatedAt: jobGraph.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error getting job graph summary:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

export default router;
