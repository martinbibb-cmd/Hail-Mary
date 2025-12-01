/**
 * Database migration script
 */

import { initializeDatabase } from './schema';
import fs from 'fs';
import path from 'path';

// Ensure data directory exists
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

console.log('Running database migrations...');
initializeDatabase();
console.log('Migrations complete!');
