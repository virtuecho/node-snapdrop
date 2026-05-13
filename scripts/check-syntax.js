const { spawnSync } = require('child_process');
const { readdirSync, statSync } = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const ignoredDirectories = new Set([
  '.git',
  '.pnpm-store',
  'build',
  'coverage',
  'dist',
  'node_modules',
]);

function collectJavaScriptFiles(directory) {
  const entries = readdirSync(directory);
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (!ignoredDirectories.has(entry)) {
        files.push(...collectJavaScriptFiles(fullPath));
      }
      continue;
    }

    if (entry.endsWith('.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

const files = collectJavaScriptFiles(root).sort();
let failures = 0;

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], {
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    failures += 1;
    console.error(`Syntax check failed: ${path.relative(root, file)}`);
    if (result.stderr) {
      console.error(result.stderr.trim());
    }
  }
}

if (failures > 0) {
  console.error(`Syntax check failed for ${failures} file(s).`);
  process.exit(1);
}

console.log(`Syntax check passed (${files.length} file(s)).`);
