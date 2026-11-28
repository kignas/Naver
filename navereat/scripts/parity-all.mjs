/**
 * Runs the pixel-parity harness at 360, 393 and 412 CSS px and writes one
 * report. The reference frontend is served statically from ORIGINAL_DIR and
 * every API call is answered from the demoApi fixtures, so the old and new
 * pages are compared with identical data.
 *
 *   ORIGINAL_DIR=../Nearbite npm run parity
 *
 * Writes parity-report/w<width>/{old,new,diff,side}/<screen>.png plus a root
 * index.html/index.json with the totals, worst screens and the pinned
 * reference commit.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const appRoot = process.cwd();
const repoRoot = path.resolve(appRoot, '..');
const outRoot = path.join(appRoot, 'parity-report');
const widths = [360, 393, 412];
const threshold = 0.5;
const originalDir = process.env.ORIGINAL_DIR
  ? path.resolve(appRoot, process.env.ORIGINAL_DIR)
  : path.resolve(appRoot, '../../Nearbite');

const referenceCommit = (() => {
  const result = spawnSync('git', ['-C', originalDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : 'unknown';
})();

rmSync(outRoot, { recursive: true, force: true });
mkdirSync(outRoot, { recursive: true });

const rows = [];
for (const width of widths) {
  const dir = path.join(outRoot, `w${width}`);
  mkdirSync(dir, { recursive: true });
  const result = spawnSync('npx', ['vite-node', 'scripts/design-parity.ts'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      ORIGINAL_DIR: originalDir,
      PARITY_ONLY: 'restaurant,customization',
      PARITY_WIDTH: String(width),
      PARITY_OUT: dir,
      PARITY_REPORT: dir,
    },
  });
  if (result.status !== 0) process.exitCode = 1;
  const report = path.join(dir, 'report.json');
  if (!existsSync(report)) {
    rows.push({ width, name: 'run', diffPct: null, error: 'report.json missing' });
    continue;
  }
  for (const entry of JSON.parse(readFileSync(report, 'utf8'))) rows.push({ width, ...entry });
  cpSync(path.join(dir, 'original'), path.join(dir, 'old'), { recursive: true });
  cpSync(path.join(dir, 'navereat'), path.join(dir, 'new'), { recursive: true });
}

const measured = rows.filter((entry) => typeof entry.diffPct === 'number');
const passed = measured.filter((entry) => entry.diffPct <= threshold).length;
const worst = [...measured].sort((a, b) => b.diffPct - a.diffPct).slice(0, 5);
const escape = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

const rowHtml = rows
  .map((entry) => {
    const state = typeof entry.diffPct === 'number' && entry.diffPct <= threshold ? 'pass' : 'fail';
    const render = typeof entry.diffPct === 'number' && !entry.error
      ? `<td>${entry.diffPct}%</td><td>${entry.diffPctRaw}%</td>` +
        `<td class="shots"><img src="w${entry.width}/old/${entry.name}.png" alt="old">` +
        `<img src="w${entry.width}/new/${entry.name}.png" alt="new">` +
        `<img src="w${entry.width}/diff/${entry.name}.png" alt="diff"></td>`
      : '<td>—</td><td>—</td><td>ERROR</td>';
    return `<tr class="${state}"><td>${entry.width}</td><td>${escape(entry.name)}</td>${render}` +
      `<td>${state.toUpperCase()}</td><td>${escape(entry.note ?? '')}</td></tr>`;
  })
  .join('\n');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Navereat parity report</title>
<style>
body{font:14px/1.45 system-ui,sans-serif;margin:24px;color:#16181d;background:#f7f7f9}
h1{font-size:22px}p.meta{color:#5b6270}
table{border-collapse:collapse;width:100%;background:#fff;margin:16px 0}
th,td{border:1px solid #e3e5ea;padding:6px 8px;text-align:left;vertical-align:top}
tr.fail td{background:#fff1f0}tr.pass td{background:#f4fbf6}
.shots{display:flex;gap:4px}.shots img{width:150px;display:block;border:1px solid #eee}
code{background:#eef0f4;padding:1px 4px;border-radius:4px}
</style></head><body>
<h1>Navereat pixel-parity report</h1>
<p class="meta">Reference <code>${escape(originalDir)}</code> at commit <code>${escape(referenceCommit)}</code>.<br>
Widths 360 / 393 / 412 CSS px, pixelmatch threshold 0.1, pass line ${threshold}% of usable pixels.
<strong>${passed} / ${measured.length} screens pass.</strong></p>
<h2>Worst five</h2><ul>${worst.map((entry) => `<li>${entry.width}px ${escape(entry.name)} — ${entry.diffPct}%</li>`).join('')}</ul>
<h2>All screens (old / new / diff)</h2>
<table><thead><tr><th>Width</th><th>Screen</th><th>Diff %</th><th>Raw %</th><th>Old / new / diff</th><th>State</th><th>Note</th></tr></thead>
<tbody>${rowHtml}</tbody></table>
</body></html>`;

writeFileSync(path.join(outRoot, 'index.html'), html);
writeFileSync(
  path.join(outRoot, 'index.json'),
  JSON.stringify({ reference: originalDir, referenceCommit, widths, threshold, passed, measured: measured.length, rows }, null, 2),
);

console.log(`\nParity: ${passed}/${measured.length} under ${threshold}%`);
console.log(`Report: ${path.join(outRoot, 'index.html')}`);
console.log(`Reference: ${referenceCommit}`);
