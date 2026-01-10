#!/usr/bin/env node
/**
 * Rocky Health Checker CLI
 *
 * Usage: npm run rocky
 */

import { runHealthCheck, formatHealthCheckForCLI } from '../utils/rocky-health';

async function main() {
  console.log('Running Rocky health check...\n');

  try {
    const result = await runHealthCheck();
    const formatted = formatHealthCheckForCLI(result);
    console.log(formatted);

    // Exit with error code if unhealthy
    process.exit(result.status === 'unhealthy' ? 1 : 0);
  } catch (error) {
    console.error('Fatal error running health check:');
    console.error(error);
    process.exit(1);
  }
}

main();
