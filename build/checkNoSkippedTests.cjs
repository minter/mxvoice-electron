const fs = require('node:fs');
const path = require('node:path');

const testsRoot = path.resolve(__dirname, '..', 'tests');
const skipPattern = /\b(?:test|it|describe)\s*\.\s*(?:skip|fixme)\b|\btest\s*\.\s*skip\s*\(/g;
const violations = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!/\.(?:c?js|mjs|ts|tsx)$/.test(entry.name)) continue;

    const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      skipPattern.lastIndex = 0;
      if (skipPattern.test(line)) {
        violations.push(`${path.relative(process.cwd(), fullPath)}:${index + 1}: ${line.trim()}`);
      }
    });
  }
}

walk(testsRoot);

if (violations.length) {
  console.error('Skipped or fixme tests are not permitted:');
  violations.forEach((violation) => console.error(`  ${violation}`));
  console.error('Make the test deterministic or replace it with a lower-level contract test.');
  process.exitCode = 1;
} else {
  console.log('No skipped or fixme tests found.');
}
