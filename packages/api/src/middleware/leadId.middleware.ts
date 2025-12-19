/**
 * LeadId Validation Middleware
 * 
 * Ensures that leadId is present in requests that create or update artifacts
 * (notes, photos, transcripts, etc.) that should be linked to a customer/lead.
 */

import { Request, Response, NextFunction } from 'express';
import type { ApiResponse } from '@hail-mary/shared';

/**
 * Middleware to require leadId in request body
 * Used for POST/PUT/PATCH requests that create or update artifacts
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
