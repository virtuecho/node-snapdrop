const { execFileSync } = require('child_process');
const { existsSync, readFileSync } = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const errors = [];

function repoPath(relativePath) {
  return path.join(root, relativePath);
}

function requireFile(relativePath) {
  if (!existsSync(repoPath(relativePath))) {
    errors.push(`Missing required file: ${relativePath}`);
  }
}

function readJson(relativePath) {
  try {
    return JSON.parse(readFileSync(repoPath(relativePath), 'utf8'));
  } catch (error) {
    errors.push(`Cannot parse ${relativePath}: ${error.message}`);
    return {};
  }
}

function getTrackedFiles() {
  try {
    return execFileSync('git', ['ls-files'], {
      cwd: root,
      encoding: 'utf8',
    })
      .split(/\r?\n/)
      .filter(Boolean);
  } catch (error) {
    errors.push(`Cannot inspect tracked files with git: ${error.message}`);
    return [];
  }
}

[
  'README.md',
  'LICENSE',
  'package.json',
  'pnpm-lock.yaml',
  '.gitignore',
  '.gitattributes',
  '.editorconfig',
  '.env.example',
  'Dockerfile',
  '.github/workflows/ci.yml',
].forEach(requireFile);

if (existsSync(repoPath('package-lock.json'))) {
  errors.push('package-lock.json exists; this repository uses pnpm-lock.yaml.');
}

if (existsSync(repoPath('yarn.lock'))) {
  errors.push('yarn.lock exists; this repository uses pnpm-lock.yaml.');
}

const packageJson = readJson('package.json');
if (!String(packageJson.packageManager || '').startsWith('pnpm@')) {
  errors.push('package.json must declare packageManager as pnpm@<version>.');
}

const requiredScripts = [
  'start',
  'dev',
  'lint',
  'test',
  'smoke',
  'arch:check',
  'build',
  'check',
];
for (const script of requiredScripts) {
  if (!packageJson.scripts || !packageJson.scripts[script]) {
    errors.push(`package.json is missing script: ${script}`);
  }
}

const dockerfile = existsSync(repoPath('Dockerfile'))
  ? readFileSync(repoPath('Dockerfile'), 'utf8')
  : '';
if (!dockerfile.includes('pnpm install --frozen-lockfile')) {
  errors.push('Dockerfile must install dependencies with pnpm --frozen-lockfile.');
}

const readme = existsSync(repoPath('README.md'))
  ? readFileSync(repoPath('README.md'), 'utf8')
  : '';
if (!readme.includes('pnpm install')) {
  errors.push('README.md must document pnpm install.');
}

const trackedFiles = getTrackedFiles();
const generatedPatterns = [
  /^node_modules\//,
  /^dist\//,
  /^build\//,
  /^coverage\//,
  /^\.pnpm-store\//,
];
const secretPatterns = [
  /^\.env$/,
  /^\.env\.(?!example$)/,
  /(^|\/)secrets\//,
  /(^|\/)credentials\//,
  /\.(key|pem|p12|pfx)$/,
];

for (const file of trackedFiles) {
  if (generatedPatterns.some((pattern) => pattern.test(file))) {
    errors.push(`Generated file or directory is tracked: ${file}`);
  }

  if (secretPatterns.some((pattern) => pattern.test(file))) {
    errors.push(`Potential secret file is tracked: ${file}`);
  }
}

if (errors.length > 0) {
  console.error('Architecture check failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('Architecture check passed.');
