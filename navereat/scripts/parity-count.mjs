#!/usr/bin/env node
/**
 * Counts the PARITY.md inventory: one row per legacy source line/feature.
 * A row's status is the first DONE/PARTIAL/TODO/N/A token found in its cells.
 * Section 0 (this reconciliation) and sections 7, 9, 10 are narrative and are
 * skipped, so the inventory number cannot drift with prose.
 *
 * Usage: node scripts/parity-count.mjs [--md]
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const text = readFileSync(join(root, 'PARITY.md'), 'utf8');
// §0 is the reconciliation report itself (it quotes old statuses), §7/9/10 are
// narrative (tests, open defects, delivery notes).
const NARRATIVE = /^(0\.|7\.|9\.|10\.)/;
const STATUS = /\b(DONE|PARTIAL|TODO|N\/A)\b/;

const rows = [];
let section = '(preamble)';
for (const line of text.split('\n')) {
  if (line.startsWith('#')) {
    section = line.replace(/^#+\s*/, '').trim();
    continue;
  }
  if (!line.startsWith('|')) continue;
  const cells = line
    .split('|')
    .slice(1, -1)
    .map((c) => c.trim());
  if (cells.length < 2) continue;
  if (cells.every((c) => /^:?-{2,}:?$/.test(c.replace(/ /g, '')))) continue;
  if (/^(source|key|what|item|file)$/i.test(cells[0])) continue;
  const status = (cells.join(' ').match(STATUS) ?? [null])[0];
  if (!status) continue;
  rows.push({ section, status, source: cells[0] });
}

const groups = new Map();
for (const row of rows) {
  if (NARRATIVE.test(row.section)) continue;
  const g = groups.get(row.section) ?? { DONE: 0, PARTIAL: 0, TODO: 0, 'N/A': 0 };
  g[row.status] += 1;
  groups.set(row.section, g);
}
const total = { DONE: 0, PARTIAL: 0, TODO: 0, 'N/A': 0 };
for (const g of groups.values()) for (const k of Object.keys(total)) total[k] += g[k];
const sum = Object.values(total).reduce((a, b) => a + b, 0);

if (process.argv.includes('--md')) {
  console.log('| Section | DONE | PARTIAL | TODO | N/A | rows |');
  console.log('| --- | --- | --- | --- | --- | --- |');
  for (const [name, g] of groups) {
    console.log(`| ${name} | ${g.DONE} | ${g.PARTIAL} | ${g.TODO} | ${g['N/A']} | ${g.DONE + g.PARTIAL + g.TODO + g['N/A']} |`);
  }
  console.log(`| **Total** | **${total.DONE}** | **${total.PARTIAL}** | **${total.TODO}** | **${total['N/A']}** | **${sum}** |`);
} else {
  for (const [name, g] of groups) console.log(name, JSON.stringify(g));
  console.log('TOTAL', JSON.stringify(total), 'rows', sum);
}

let failures = 0;
if (total.TODO > 0) {
  console.error(`\n${total.TODO} TODO row(s):`);
  for (const row of rows) {
    if (row.status === 'TODO' && !NARRATIVE.test(row.section)) console.error('  -', row.section, '|', row.source);
  }
  failures += 1;
}
process.exitCode = failures ? 1 : 0;
