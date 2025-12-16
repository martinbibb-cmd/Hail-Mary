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
 * Load a JSON configuration file with resilient fallback behavior.
 * 
 * Tries paths in this order:
 * 1. process.env.HAILMARY_CORE_PATH/<filename> (if HAILMARY_CORE_PATH is set)
 * 2. @hail-mary/shared/dist/core/<filename> (preferred for production)
 * 3. @hail-mary/shared/src/core/<filename> (dev fallback)
 * 4. Uses embedded fallback if all paths fail
 * 
 * @param fileName - Name of the JSON file (e.g., "depot-schema.json")
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
  // In a workspace, node_modules/@hail-mary/shared points to packages/shared
  // So we need to resolve from the workspace root
  const distPath = path.join(process.cwd(), 'packages', 'shared', 'dist', 'core', fileName);
  pathsToTry.push(distPath);
  
  // Also try from node_modules (for when shared is installed as a dependency)
  try {
    const nodeModulesPath = require.resolve(`@hail-mary/shared/dist/core/${fileName}`);
    pathsToTry.push(nodeModulesPath);
  } catch {
    // If require.resolve fails, that's fine - we'll try other paths
  }
  
  // 3. Source path (dev fallback)
  const srcPath = path.join(process.cwd(), 'packages', 'shared', 'src', 'core', fileName);
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
const configCache = new Map<string, ConfigLoadResult<any>>();

/**
 * Load config with caching to avoid repeated file system access
 */
export function loadJsonConfigCached<T>(fileName: string, fallback: T): ConfigLoadResult<T> {
  if (configCache.has(fileName)) {
    return configCache.get(fileName)!;
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
