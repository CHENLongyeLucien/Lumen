// Prints per-file coverage from coverage/coverage-summary.json (run after `pnpm coverage`).
import { readFileSync } from 'node:fs';

const summary = JSON.parse(readFileSync(new URL('../coverage/coverage-summary.json', import.meta.url), 'utf8'));
const rows = Object.entries(summary)
  .filter(([file]) => file !== 'total')
  .map(([file, data]) => [file.replaceAll('\\', '/').replace(/^.*\/src\//, 'src/'), data]);

const pad = (value, width) => String(value).padStart(width);
for (const [file, data] of rows) {
  console.log(
    `${file.padEnd(32)} lines ${pad(data.lines.pct, 6)}  branches ${pad(data.branches.pct, 6)}  functions ${pad(data.functions.pct, 6)}`,
  );
}
const { lines, branches, functions } = summary.total;
console.log(`${'TOTAL'.padEnd(32)} lines ${pad(lines.pct, 6)}  branches ${pad(branches.pct, 6)}  functions ${pad(functions.pct, 6)}`);
