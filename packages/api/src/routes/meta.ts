/**
 * Meta API Routes
 *
 * Endpoints for build metadata and system information.
 * Used to identify exactly what backend code is running.
 */

import { Router, Request, Response } from "express";
import type { ApiResponse } from "@hail-mary/shared";
import os from "os";
import { readFileSync } from "fs";

const router = Router();

// Container ID short length (first 12 characters of full container ID)
const CONTAINER_ID_SHORT_LENGTH = 12;

/**
 * GET /api/meta/build
 * Get build metadata for the backend API
 * 
 * Returns:
 * - gitSha: Git commit SHA of the build
 * - buildTime: ISO timestamp of when the build was created
 * - env: Environment (production, development, etc.)
 * - version: API version from package.json
 * - hostname: Server hostname
 * - containerId: Container ID (if running in Docker)
 * - nodeVersion: Node.js version
 */
router.get("/build", async (_req: Request, res: Response) => {
  try {
    // Get Git SHA from environment variable or default to 'unknown'
    const gitSha = process.env.GIT_SHA || "unknown";
    
    // Get build time from environment variable or use server start time
    const buildTime = process.env.BUILD_TIME || new Date().toISOString();
    
    // Get environment
    const env = process.env.NODE_ENV || "development";
    
    // Get hostname
    const hostname = os.hostname();
    
    // Try to get container ID (if running in Docker)
    let containerId: string | undefined;
    try {
      // Docker container ID is typically the hostname in Docker environments
      // Or can be read from /proc/self/cgroup
      const cgroupContent = readFileSync("/proc/self/cgroup", "utf8");
      const match = cgroupContent.match(/docker[/-]([a-f0-9]{12,64})/);
      if (match) {
        containerId = match[1].substring(0, CONTAINER_ID_SHORT_LENGTH); // Short container ID
      }
    } catch {
      // Not in Docker or can't read cgroup file
      containerId = undefined;
    }
    
    // Get Node.js version
    const nodeVersion = process.version;
    
    // API version from package
    const version = process.env.npm_package_version || "unknown";

    const response: ApiResponse<{
      gitSha: string;
      buildTime: string;
      env: string;
      version: string;
      hostname: string;
      containerId?: string;
      nodeVersion: string;
    }> = {
      success: true,
      data: {
        gitSha,
        buildTime,
        env,
        version,
        hostname,
        containerId,
        nodeVersion,
      },
    };
    
    return res.json(response);
  } catch (error) {
    console.error("Error fetching build metadata:", error);
    const response: ApiResponse<null> = {
      success: false,
      error: (error as Error).message,
    };
    return res.status(500).json(response);
  }
});

export default router;
