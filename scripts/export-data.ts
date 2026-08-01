#!/usr/bin/env tsx
/**
 * Export personal/contact data to data/exports/ (JSON).
 * Not blocked by AI budget.
 *
 * Usage: npm run export-data
 */
import { ensureDb } from "../src/db/ensure";
import { writePersonalDataExport } from "../src/modules/privacy/export";

ensureDb();
const result = writePersonalDataExport();
console.log(`Wrote ${result.bytes} bytes → ${result.path}`);
