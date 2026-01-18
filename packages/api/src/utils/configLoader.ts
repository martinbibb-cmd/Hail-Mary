/**
 * Resilient Config Loader
 * 
 * Provides safe loading of JSON configuration files with multiple fallback paths.
 * Never crashes on missing files or invalid JSON - always returns a fallback value.
 */

import * as fs from 'fs';
import * as path from 'path';

interface ConfigLoadResult<T> {
  config: T;
  loadedFrom: string | null;
  usedFallback: boolean;
}

/**
 * Config source types for provenance tracking
 */
export type ConfigSource = 'db' | 'file' | 'env' | 'builtin' | 'unknown';

/**
 * Config usage type
 */
export type ConfigUsage = 'custom' | 'default' | 'unknown';

/**
 * Config provenance information
 */
export interface ConfigProvenance {
  used: ConfigUsage;
  source: ConfigSource;
  expected: string[];
  reason: string;
}

/**
 * Load a JSON configuration file with resilient fallback behavior.
 * 
 * Tries paths in this order:
 * 1. process.env.HAILMARY_CORE_PATH/<filename> (if HAILMARY_CORE_PATH is set)
 * 2. @hail-mary/shared/dist/core/<filename> (preferred for production)
 * 3. @hail-mary/shared/src/core/<filename> (dev fallback)
 * 4. Uses embedded fallback if all paths fail
 * 
 * @param fileName - Name of the JSON file (e.g., "atlas-schema.json")
 * @param fallback - Default value to return if file cannot be loaded
 * @returns Object containing the loaded config, source path, and whether fallback was used
 */
export function loadJsonConfig<T>(fileName: string, fallback: T): ConfigLoadResult<T> {
  const attemptedPaths: string[] = [];
  
  // Build list of paths to try
  const pathsToTry: string[] = [];
  
  // 1. Environment variable path (highest priority)
  if (process.env.HAILMARY_CORE_PATH) {
    const envPath = path.join(process.env.HAILMARY_CORE_PATH, fileName);
    pathsToTry.push(envPath);
  }
  
  // 2. Published dist path (preferred for production)
  // Resolve relative to this module's location, not process.cwd()
  // This ensures correct path resolution when API runs from /app/packages/api
  const moduleDir = __dirname; // e.g., /app/packages/api/src/utils or /app/packages/api/dist/utils

  // Go up to packages/api root, then to workspace root
  const apiRoot = path.join(moduleDir, '..', '..'); // Go up from src/utils or dist/utils to api root (/app/packages/api)
  const workspaceRoot = path.join(apiRoot, '..', '..'); // Go up to workspace root (/app)
  const distPath = path.join(workspaceRoot, 'packages', 'shared', 'dist', 'core', fileName);
  pathsToTry.push(distPath);

  // Also try from node_modules (for when shared is installed as a dependency)
  try {
    const nodeModulesPath = require.resolve(`@hail-mary/shared/dist/core/${fileName}`);
    pathsToTry.push(nodeModulesPath);
  } catch {
    // If require.resolve fails, that's fine - we'll try other paths
  }

  // 3. Source path (dev fallback)
  const srcPath = path.join(workspaceRoot, 'packages', 'shared', 'src', 'core', fileName);
  pathsToTry.push(srcPath);

  // Also try from node_modules source (for when shared is installed as a dependency)
  try {
    const nodeModulesSrcPath = require.resolve(`@hail-mary/shared/src/core/${fileName}`);
    pathsToTry.push(nodeModulesSrcPath);
  } catch {
    // If require.resolve fails, that's fine
  }
  
  // Try each path in order
  for (const filePath of pathsToTry) {
    attemptedPaths.push(filePath);
    
    if (!fs.existsSync(filePath)) {
      continue;
    }
    
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(fileContent);
      
      // Successfully loaded
      console.log(`✅ Loaded config ${fileName} from: ${filePath}`);
      return {
        config: parsed as T,
        loadedFrom: filePath,
        usedFallback: false,
      };
    } catch (error) {
      // JSON parse error or read error
      console.warn(`⚠️  Failed to parse ${filePath}:`, error instanceof Error ? error.message : error);
      continue;
    }
  }
  
  // All paths failed - use fallback
  console.warn(`⚠️  Could not load ${fileName} from any path. Using embedded fallback.`);
  console.warn(`   Attempted paths:`, attemptedPaths);
  
  return {
    config: fallback,
    loadedFrom: null,
    usedFallback: true,
  };
}

/**
 * Singleton storage for config load results to avoid reloading on every access
 */
const configCache = new Map<string, ConfigLoadResult<unknown>>();

/**
 * Load config with caching to avoid repeated file system access
 */
export function loadJsonConfigCached<T>(fileName: string, fallback: T): ConfigLoadResult<T> {
  const cached = configCache.get(fileName);
  if (cached) {
    return cached as ConfigLoadResult<T>;
  }
  
  const result = loadJsonConfig(fileName, fallback);
  configCache.set(fileName, result);
  return result;
}

/**
 * Clear the config cache (useful for testing)
 */
export function clearConfigCache(): void {
  configCache.clear();
}

/**
 * Resolve config provenance for a given config load result
 */
function resolveConfigProvenance(
  loadResult: ConfigLoadResult<unknown>,
  configName: string,
  fileName: string
): ConfigProvenance {
  const expected: string[] = [
    `env:HAILMARY_CORE_PATH/${fileName}`,
    `file:/data/atlas/${fileName}`,
    `file:packages/shared/dist/core/${fileName}`,
    `file:packages/shared/src/core/${fileName}`,
  ];

  if (loadResult.usedFallback) {
    return {
      used: 'default',
      source: 'builtin',
      expected,
      reason: `No custom ${configName} found`,
    };
  }

  // Determine source based on loaded path
  const loadedFrom = loadResult.loadedFrom || '';
  let source: ConfigSource = 'file';
  
  if (loadedFrom.includes('HAILMARY_CORE_PATH') || process.env.HAILMARY_CORE_PATH) {
    source = 'env';
  } else if (loadedFrom.includes('/dist/core/') || loadedFrom.includes('/src/core/')) {
    source = 'file';
  }

  return {
    used: 'custom',
    source,
    expected,
    reason: `Loaded from ${loadedFrom}`,
  };
}

/**
 * Resolve schema config provenance
 */
export function resolveSchemaConfig(): ConfigProvenance {
  const schemaResult = configCache.get('atlas-schema.json') || configCache.get('depot-schema.json');
  
  if (!schemaResult) {
    // Not yet loaded, return default state
    return {
      used: 'default',
      source: 'builtin',
      expected: [
        'env:HAILMARY_CORE_PATH/atlas-schema.json',
        'file:/data/atlas/atlas-schema.json',
        'file:packages/shared/dist/core/atlas-schema.json',
        'file:packages/shared/src/core/atlas-schema.json',
      ],
      reason: 'No custom schema config found',
    };
  }

  return resolveConfigProvenance(schemaResult, 'schema config', 'atlas-schema.json');
}

/**
 * Resolve checklist config provenance
 */
export function resolveChecklistConfig(): ConfigProvenance {
  const checklistResult = configCache.get('checklist-config.json');
  
  if (!checklistResult) {
    // Not yet loaded, return default state
    return {
      used: 'default',
      source: 'builtin',
      expected: [
        'env:HAILMARY_CORE_PATH/checklist-config.json',
        'file:/data/atlas/checklist-config.json',
        'file:packages/shared/dist/core/checklist-config.json',
        'file:packages/shared/src/core/checklist-config.json',
      ],
      reason: 'No custom checklist config found',
    };
  }

  return resolveConfigProvenance(checklistResult, 'checklist config', 'checklist-config.json');
}
