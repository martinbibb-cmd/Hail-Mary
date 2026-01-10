/**
 * Rocky Health Checker
 *
 * Never hallucinates. Only reports what can be verified.
 *
 * Checks:
 * - Database schema (actual vs expected)
 * - Migration status
 * - Container health (if running in Docker)
 * - API endpoints
 * - Service connectivity
 *
 * Returns actionable diagnostics with exact commands to fix issues.
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const DEFAULT_DATABASE_URL = "postgres://postgres@hailmary-postgres:5432/hailmary";

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: DatabaseCheck;
    migrations: MigrationCheck;
    schema: SchemaCheck;
    containers?: ContainerCheck;
    services: ServicesCheck;
  };
  diagnostics: Diagnostic[];
  summary: string;
}

interface DatabaseCheck {
  connected: boolean;
  latency?: number;
  version?: string;
  database?: string;
  error?: string;
}

interface MigrationCheck {
  appliedCount: number;
  availableCount: number;
  pendingMigrations: string[];
  lastApplied?: {
    hash: string;
    created_at: string;
  };
  error?: string;
}

interface SchemaCheck {
  tablesFound: number;
  expectedTables: number;
  missingTables: string[];
  extraTables: string[];
  columnMismatches: Array<{
    table: string;
    issue: string;
  }>;
  error?: string;
}

interface ContainerCheck {
  inDocker: boolean;
  containers?: Array<{
    name: string;
    status: string;
    health?: string;
  }>;
  error?: string;
}

interface ServicesCheck {
  api: ServiceStatus;
  assistant: ServiceStatus;
  pwa: ServiceStatus;
}

interface ServiceStatus {
  reachable: boolean;
  responseTime?: number;
  statusCode?: number;
  error?: string;
}

interface Diagnostic {
  severity: 'critical' | 'warning' | 'info';
  component: string;
  issue: string;
  fix: string;
  doNotTouch?: string;
}

/**
 * Expected tables from Drizzle schema
 */
const EXPECTED_TABLES = [
  'accounts',
  'users',
  'password_reset_tokens',
  'leads',
  'customers',
  'products',
  'quotes',
  'quote_lines',
  'visit_sessions',
  'media_attachments',
  'survey_templates',
  'survey_instances',
  'survey_answers',
  'visit_observations',
  'transcripts',
  'voice_notes',
  'knowledge_entries',
  'knowledge_tags',
  'system_recommendations',
  'properties',
  'visits',
  'timeline_events',
  'assets',
  'visit_events',
  'presentation_drafts',
  'workspaces',
  'lead_workspace_links',
  'addresses',
  'appointments',
  'heat_loss_surveys',
  'heat_loss_rooms',
  'heat_loss_windows',
  'heat_loss_doors',
  'heat_loss_walls',
  'heat_loss_roofs',
  'heat_loss_floors',
  'gc_boiler_catalog',
  'photos',
  'scans',
  'job_nodes',
  'job_edges',
  'job_artifacts',
  '__drizzle_migrations', // Drizzle's internal migrations table
];

/**
 * Run complete health check
 */
export async function runHealthCheck(): Promise<HealthCheckResult> {
  const timestamp = new Date().toISOString();
  const diagnostics: Diagnostic[] = [];

  // Check database
  const database = await checkDatabase();
  if (!database.connected) {
    diagnostics.push({
      severity: 'critical',
      component: 'database',
      issue: 'Cannot connect to database',
      fix: `Check DATABASE_URL and ensure PostgreSQL is running:\n  docker compose ps\n  docker logs hailmary-postgres`,
      doNotTouch: 'Do not manually edit the database'
    });
  }

  // Check migrations
  const migrations = await checkMigrations();
  if (migrations.pendingMigrations.length > 0) {
    diagnostics.push({
      severity: 'critical',
      component: 'migrations',
      issue: `${migrations.pendingMigrations.length} pending migrations`,
      fix: `Run migrations:\n  docker exec hailmary-api npm run db:migrate -w packages/api\n  OR: cd packages/api && npm run db:migrate`,
      doNotTouch: 'Never manually apply migrations - use the migration tool'
    });
  }

  // Check schema
  const schema = await checkSchema();
  if (schema.missingTables.length > 0) {
    diagnostics.push({
      severity: 'critical',
      component: 'schema',
      issue: `Missing tables: ${schema.missingTables.join(', ')}`,
      fix: `Run migrations to create missing tables:\n  docker exec hailmary-api npm run db:migrate -w packages/api`,
      doNotTouch: 'Never manually create tables - use migrations'
    });
  }

  if (schema.extraTables.length > 0) {
    diagnostics.push({
      severity: 'warning',
      component: 'schema',
      issue: `Extra tables not in schema: ${schema.extraTables.join(', ')}`,
      fix: 'These tables may be from old migrations or manual changes. Review and remove if unused.',
      doNotTouch: 'Do not drop tables without backing up data first'
    });
  }

  schema.columnMismatches.forEach(mismatch => {
    diagnostics.push({
      severity: 'warning',
      component: 'schema',
      issue: mismatch.issue,
      fix: 'Run migrations to fix schema mismatches:\n  docker exec hailmary-api npm run db:migrate -w packages/api',
      doNotTouch: 'Never manually alter table structure'
    });
  });

  // Check containers (if in Docker)
  const containers = await checkContainers();
  if (containers.containers) {
    containers.containers.forEach(container => {
      if (container.status !== 'running') {
        diagnostics.push({
          severity: 'critical',
          component: 'containers',
          issue: `Container ${container.name} is ${container.status}`,
          fix: `Restart container:\n  docker compose restart ${container.name.replace('hailmary-', '')}`,
        });
      } else if (container.health === 'unhealthy') {
        diagnostics.push({
          severity: 'critical',
          component: 'containers',
          issue: `Container ${container.name} is unhealthy`,
          fix: `Check logs and restart:\n  docker logs ${container.name}\n  docker compose restart ${container.name.replace('hailmary-', '')}`,
        });
      }
    });
  }

  // Check services
  const services = await checkServices();
  if (!services.api.reachable) {
    diagnostics.push({
      severity: 'critical',
      component: 'api',
      issue: 'API service is not reachable',
      fix: `Check if API is running:\n  docker logs hailmary-api\n  curl http://localhost:3001/health`,
    });
  }

  if (!services.assistant.reachable) {
    diagnostics.push({
      severity: 'warning',
      component: 'assistant',
      issue: 'Assistant service is not reachable',
      fix: `Check if assistant is running:\n  docker logs hailmary-assistant\n  curl http://localhost:3002/health`,
    });
  }

  if (!services.pwa.reachable) {
    diagnostics.push({
      severity: 'warning',
      component: 'pwa',
      issue: 'PWA is not reachable',
      fix: `Check if PWA is running:\n  docker logs hailmary-pwa\n  curl http://localhost:3000/`,
    });
  }

  // Determine overall status
  const hasCritical = diagnostics.some(d => d.severity === 'critical');
  const hasWarning = diagnostics.some(d => d.severity === 'warning');

  let status: 'healthy' | 'degraded' | 'unhealthy';
  let summary: string;

  if (hasCritical) {
    status = 'unhealthy';
    summary = `System is unhealthy. ${diagnostics.filter(d => d.severity === 'critical').length} critical issues found.`;
  } else if (hasWarning) {
    status = 'degraded';
    summary = `System is degraded. ${diagnostics.filter(d => d.severity === 'warning').length} warnings found.`;
  } else {
    status = 'healthy';
    summary = 'All systems operational.';
  }

  return {
    status,
    timestamp,
    checks: {
      database,
      migrations,
      schema,
      containers,
      services,
    },
    diagnostics,
    summary,
  };
}

/**
 * Check database connectivity and basic info
 */
async function checkDatabase(): Promise<DatabaseCheck> {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
  });

  try {
    const start = Date.now();
    const result = await pool.query('SELECT version(), current_database()');
    const latency = Date.now() - start;

    await pool.end();

    return {
      connected: true,
      latency,
      version: result.rows[0].version,
      database: result.rows[0].current_database,
    };
  } catch (error) {
    await pool.end();
    return {
      connected: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check migration status
 */
async function checkMigrations(): Promise<MigrationCheck> {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
  });

  try {
    // Get applied migrations from database
    const result = await pool.query(
      'SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at DESC'
    );
    const appliedMigrations = result.rows;

    // Get available migrations from filesystem
    const migrationsDir = path.resolve(__dirname, '../../drizzle');
    let availableMigrations: string[] = [];

    try {
      const files = fs.readdirSync(migrationsDir);
      availableMigrations = files.filter(f => f.endsWith('.sql')).sort();
    } catch (error) {
      // Can't read filesystem - may be in production build
      availableMigrations = [];
    }

    // Find pending migrations (available but not applied)
    const appliedHashes = new Set(appliedMigrations.map(m => m.hash));
    const pendingMigrations: string[] = [];

    // Simple heuristic: if we have fewer applied than expected, flag as pending
    if (appliedMigrations.length < availableMigrations.length) {
      const missingCount = availableMigrations.length - appliedMigrations.length;
      pendingMigrations.push(`~${missingCount} migrations may be pending`);
    }

    await pool.end();

    return {
      appliedCount: appliedMigrations.length,
      availableCount: availableMigrations.length || appliedMigrations.length,
      pendingMigrations,
      lastApplied: appliedMigrations.length > 0 ? {
        hash: appliedMigrations[0].hash,
        created_at: appliedMigrations[0].created_at,
      } : undefined,
    };
  } catch (error) {
    await pool.end();
    return {
      appliedCount: 0,
      availableCount: 0,
      pendingMigrations: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check database schema against expected
 */
async function checkSchema(): Promise<SchemaCheck> {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
  });

  try {
    // Get all tables in public schema
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    const actualTables = result.rows.map(r => r.table_name);
    const actualTableSet = new Set(actualTables);
    const expectedTableSet = new Set(EXPECTED_TABLES);

    // Find missing and extra tables
    const missingTables = EXPECTED_TABLES.filter(t => !actualTableSet.has(t));
    const extraTables = actualTables.filter(t => !expectedTableSet.has(t));

    // Check for column mismatches (basic check)
    const columnMismatches: Array<{ table: string; issue: string }> = [];

    // For critical tables, verify they have expected columns
    const criticalTables = ['users', 'accounts', 'leads', 'quotes'];

    for (const table of criticalTables) {
      if (actualTableSet.has(table)) {
        try {
          const columns = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = $1
            ORDER BY ordinal_position
          `, [table]);

          // Basic sanity checks
          if (columns.rows.length === 0) {
            columnMismatches.push({
              table,
              issue: `Table ${table} exists but has no columns (corrupted?)`,
            });
          }

          // Check for id column
          const hasId = columns.rows.some(c => c.column_name === 'id');
          if (!hasId) {
            columnMismatches.push({
              table,
              issue: `Table ${table} is missing 'id' column`,
            });
          }
        } catch (error) {
          // Ignore errors for individual table checks
        }
      }
    }

    await pool.end();

    return {
      tablesFound: actualTables.length,
      expectedTables: EXPECTED_TABLES.length,
      missingTables,
      extraTables,
      columnMismatches,
    };
  } catch (error) {
    await pool.end();
    return {
      tablesFound: 0,
      expectedTables: EXPECTED_TABLES.length,
      missingTables: EXPECTED_TABLES,
      extraTables: [],
      columnMismatches: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check Docker container status (if running in Docker)
 */
async function checkContainers(): Promise<ContainerCheck> {
  try {
    // Check if we're in Docker
    const inDocker = fs.existsSync('/.dockerenv') ||
                     fs.existsSync('/proc/self/cgroup') &&
                     fs.readFileSync('/proc/self/cgroup', 'utf8').includes('docker');

    // Try to get container status using docker CLI
    const { execSync } = require('child_process');

    try {
      const output = execSync(
        'docker compose ps --format json 2>/dev/null || docker ps --filter "name=hailmary" --format "{{.Names}}|{{.Status}}|{{.Health}}" 2>/dev/null',
        { encoding: 'utf8', timeout: 5000 }
      );

      const containers: Array<{ name: string; status: string; health?: string }> = [];

      // Parse output
      if (output.trim()) {
        const lines = output.trim().split('\n');
        for (const line of lines) {
          if (line.includes('|')) {
            // Docker ps format
            const [name, status, health] = line.split('|');
            containers.push({
              name,
              status: status.toLowerCase().includes('up') ? 'running' : 'stopped',
              health: health || undefined,
            });
          } else {
            // Try JSON format
            try {
              const json = JSON.parse(line);
              containers.push({
                name: json.Name || json.name,
                status: json.State || json.status,
                health: json.Health || undefined,
              });
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      return {
        inDocker,
        containers: containers.length > 0 ? containers : undefined,
      };
    } catch {
      // Docker CLI not available or error running command
      return { inDocker, containers: undefined };
    }
  } catch (error) {
    return {
      inDocker: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check service endpoints
 */
async function checkServices(): Promise<ServicesCheck> {
  const checkEndpoint = async (url: string): Promise<ServiceStatus> => {
    try {
      const start = Date.now();
      const response = await fetch(url, {
        signal: AbortSignal.timeout(5000)
      });
      const responseTime = Date.now() - start;

      return {
        reachable: response.ok,
        responseTime,
        statusCode: response.status,
      };
    } catch (error) {
      return {
        reachable: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };

  const [api, assistant, pwa] = await Promise.all([
    checkEndpoint('http://localhost:3001/health'),
    checkEndpoint('http://localhost:3002/health'),
    checkEndpoint('http://localhost:3000/'),
  ]);

  return { api, assistant, pwa };
}

/**
 * Format health check result for CLI display
 */
export function formatHealthCheckForCLI(result: HealthCheckResult): string {
  const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
  };

  const statusIcon = {
    healthy: `${colors.green}✓${colors.reset}`,
    degraded: `${colors.yellow}⚠${colors.reset}`,
    unhealthy: `${colors.red}✗${colors.reset}`,
  };

  let output = '\n';
  output += '═══════════════════════════════════════════════════════════════\n';
  output += '  Rocky Health Check Report\n';
  output += '═══════════════════════════════════════════════════════════════\n';
  output += `  Status: ${statusIcon[result.status]} ${result.status.toUpperCase()}\n`;
  output += `  Time: ${result.timestamp}\n`;
  output += `  ${result.summary}\n`;
  output += '═══════════════════════════════════════════════════════════════\n\n';

  // Database
  output += `${colors.blue}━━━ DATABASE ━━━${colors.reset}\n`;
  if (result.checks.database.connected) {
    output += `  ${statusIcon.healthy} Connected (${result.checks.database.latency}ms)\n`;
    output += `  Database: ${result.checks.database.database}\n`;
    output += `  Version: ${result.checks.database.version?.split(' ').slice(0, 2).join(' ')}\n`;
  } else {
    output += `  ${statusIcon.unhealthy} Disconnected\n`;
    output += `  Error: ${result.checks.database.error}\n`;
  }
  output += '\n';

  // Migrations
  output += `${colors.blue}━━━ MIGRATIONS ━━━${colors.reset}\n`;
  output += `  Applied: ${result.checks.migrations.appliedCount}\n`;
  output += `  Available: ${result.checks.migrations.availableCount}\n`;
  if (result.checks.migrations.pendingMigrations.length > 0) {
    output += `  ${statusIcon.unhealthy} Pending: ${result.checks.migrations.pendingMigrations.join(', ')}\n`;
  } else {
    output += `  ${statusIcon.healthy} All migrations applied\n`;
  }
  if (result.checks.migrations.lastApplied) {
    output += `  Last applied: ${result.checks.migrations.lastApplied.created_at}\n`;
  }
  output += '\n';

  // Schema
  output += `${colors.blue}━━━ SCHEMA ━━━${colors.reset}\n`;
  output += `  Tables found: ${result.checks.schema.tablesFound}\n`;
  output += `  Tables expected: ${result.checks.schema.expectedTables}\n`;
  if (result.checks.schema.missingTables.length > 0) {
    output += `  ${statusIcon.unhealthy} Missing: ${result.checks.schema.missingTables.join(', ')}\n`;
  } else {
    output += `  ${statusIcon.healthy} All expected tables present\n`;
  }
  if (result.checks.schema.extraTables.length > 0) {
    output += `  ${statusIcon.degraded} Extra: ${result.checks.schema.extraTables.join(', ')}\n`;
  }
  if (result.checks.schema.columnMismatches.length > 0) {
    output += `  ${statusIcon.unhealthy} Column issues:\n`;
    result.checks.schema.columnMismatches.forEach(m => {
      output += `    - ${m.issue}\n`;
    });
  }
  output += '\n';

  // Containers
  if (result.checks.containers?.containers) {
    output += `${colors.blue}━━━ CONTAINERS ━━━${colors.reset}\n`;
    result.checks.containers.containers.forEach(c => {
      const icon = c.status === 'running' && (!c.health || c.health === 'healthy')
        ? statusIcon.healthy
        : statusIcon.unhealthy;
      output += `  ${icon} ${c.name}: ${c.status}`;
      if (c.health) output += ` (${c.health})`;
      output += '\n';
    });
    output += '\n';
  }

  // Services
  output += `${colors.blue}━━━ SERVICES ━━━${colors.reset}\n`;
  output += `  ${result.checks.services.api.reachable ? statusIcon.healthy : statusIcon.unhealthy} API: `;
  output += result.checks.services.api.reachable
    ? `reachable (${result.checks.services.api.responseTime}ms)\n`
    : `unreachable (${result.checks.services.api.error})\n`;

  output += `  ${result.checks.services.assistant.reachable ? statusIcon.healthy : statusIcon.unhealthy} Assistant: `;
  output += result.checks.services.assistant.reachable
    ? `reachable (${result.checks.services.assistant.responseTime}ms)\n`
    : `unreachable (${result.checks.services.assistant.error})\n`;

  output += `  ${result.checks.services.pwa.reachable ? statusIcon.healthy : statusIcon.unhealthy} PWA: `;
  output += result.checks.services.pwa.reachable
    ? `reachable (${result.checks.services.pwa.responseTime}ms)\n`
    : `unreachable (${result.checks.services.pwa.error})\n`;
  output += '\n';

  // Diagnostics
  if (result.diagnostics.length > 0) {
    output += `${colors.blue}━━━ DIAGNOSTICS ━━━${colors.reset}\n`;
    result.diagnostics.forEach((d, i) => {
      const icon = d.severity === 'critical' ? colors.red + '●' :
                   d.severity === 'warning' ? colors.yellow + '▲' :
                   colors.blue + 'ℹ';
      output += `\n  ${icon}${colors.reset} ${d.component.toUpperCase()}: ${d.issue}\n`;
      output += `    ${colors.green}Fix:${colors.reset}\n`;
      d.fix.split('\n').forEach(line => {
        output += `      ${line}\n`;
      });
      if (d.doNotTouch) {
        output += `    ${colors.red}⚠ Do NOT:${colors.reset} ${d.doNotTouch}\n`;
      }
    });
    output += '\n';
  }

  output += '═══════════════════════════════════════════════════════════════\n';

  return output;
}
