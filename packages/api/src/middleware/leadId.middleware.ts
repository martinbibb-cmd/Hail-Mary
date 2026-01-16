/**
 * LeadId Validation Middleware (DEPRECATED - transitioning to visit-based context)
 * 
 * Legacy middleware for routes still using leadId.
 * New routes should use visitId from spine_visits instead.
 */

import { Request, Response, NextFunction } from 'express';
import type { ApiResponse } from '@hail-mary/shared';

/**
 * Middleware to require leadId in request body (DEPRECATED)
 * Used for POST/PUT/PATCH requests that create or update artifacts
 * 
 * @deprecated New code should use visitId from spine_visits instead of leadId
 */
export function requireLeadId(req: Request, res: Response, next: NextFunction) {
  const leadId = req.body?.leadId;

  if (!leadId) {
    const response: ApiResponse<null> = {
      success: false,
      error: 'leadId is required (active customer not selected)',
    };
    return res.status(400).json(response);
  }

  // Validate leadId is a valid number or string
  const parsedLeadId = parseInt(String(leadId), 10);
  if (isNaN(parsedLeadId) || parsedLeadId <= 0) {
    const response: ApiResponse<null> = {
      success: false,
      error: 'Invalid leadId format',
    };
    return res.status(400).json(response);
  }

  next();
}

/**
 * Middleware to require visitId (UUID) in request body
 * Use this for new routes that work with spine_visits
 */
export function requireVisitId(req: Request, res: Response, next: NextFunction) {
  const visitId = req.body?.visitId;

  if (!visitId) {
    const response: ApiResponse<null> = {
      success: false,
      error: 'visitId is required (active visit not selected)',
    };
    return res.status(400).json(response);
  }

  // Validate visitId is a valid UUID string
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (typeof visitId !== 'string' || !uuidRegex.test(visitId)) {
    const response: ApiResponse<null> = {
      success: false,
      error: 'Invalid visitId format (must be UUID)',
    };
    return res.status(400).json(response);
  }

  next();
}

/**
 * Middleware to validate leadId in request params (for routes like /api/leads/:id/photos)
 */
export function validateLeadIdParam(req: Request, res: Response, next: NextFunction) {
  const leadId = req.params?.id;

  if (!leadId) {
    const response: ApiResponse<null> = {
      success: false,
      error: 'leadId parameter is required',
    };
    return res.status(400).json(response);
  }

  const parsedLeadId = parseInt(leadId, 10);
  if (isNaN(parsedLeadId) || parsedLeadId <= 0) {
    const response: ApiResponse<null> = {
      success: false,
      error: 'Invalid leadId format',
    };
    return res.status(400).json(response);
  }

  next();
}
