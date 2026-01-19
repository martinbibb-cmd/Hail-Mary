/**
 * API Endpoint Configuration
 * 
 * Single source of truth for API base URLs.
 * Uses relative URLs by default so atlas.cloudbibb.uk can proxy /api and /admin-agent.
 * 
 * Environment Variables:
 * - VITE_API_BASE: Base URL for main API (default: "/api")
 * - VITE_ADMIN_AGENT_BASE: Base URL for admin agent (default: "/admin-agent")
 */

// Remove trailing slashes to ensure consistent URL construction
const removeTrailingSlash = (url: string): string => url.replace(/\/+$/, '');

/**
 * Base URL for the main API
 * Default: "/api" (same-origin, proxied by nginx)
 */
export const API_BASE = removeTrailingSlash(
  import.meta.env.VITE_API_BASE ?? '/api'
);

/**
 * Base URL for the admin agent
 * Default: "/admin-agent" (same-origin, proxied by nginx)
 */
export const ADMIN_AGENT_BASE = removeTrailingSlash(
  import.meta.env.VITE_ADMIN_AGENT_BASE ?? '/admin-agent'
);

/**
 * Health check path (appended to base URLs)
 */
export const HEALTH_PATH = '/health';
