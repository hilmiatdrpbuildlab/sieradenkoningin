/** Minimal .env loader for CLI scripts (Node ≥ 22 has process.loadEnvFile). */
import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');

export const DATABASE_URL = process.env.DATABASE_URL || 'postgres://sk@localhost:54329/sieradenkoningin';
