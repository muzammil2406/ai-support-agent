'use strict';

/**
 * Packages the standalone Lambda into function.zip for the CloudFormation
 * stack (referenced via Code/S3Object after `aws cloudformation package`).
 *
 * Usage:  npm ci --omit=dev && node scripts/package.js
 * (archiver is a devDependency — it is NOT included in the runtime zip.)
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const archiver = require('archiver');

const ROOT = path.resolve(__dirname, '..');
const STAGE = path.join(os.tmpdir(), `nova-lambda-${process.pid}-${Date.now()}`);
const OUT = path.join(ROOT, 'function.zip');

const PRUNE_DIRS = new Set(['.cache', '.bin', '.git', 'test', 'tests', '__tests__', 'docs', 'examples', 'coverage']);

function prune(dir) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isSymbolicLink()) continue;
    if (ent.isDirectory()) {
      if (PRUNE_DIRS.has(ent.name)) {
        fs.rmSync(p, { recursive: true, force: true });
      } else {
        prune(p);
      }
    }
  }
}

function main() {
  const nodeModules = path.join(ROOT, 'node_modules');
  if (!fs.existsSync(nodeModules)) {
    throw new Error('node_modules missing — run "npm ci --omit=dev" in aws/lambda first');
  }

  console.log('Staging Lambda files to', STAGE);
  fs.rmSync(STAGE, { recursive: true, force: true });
  fs.mkdirSync(STAGE, { recursive: true });

  fs.copyFileSync(path.join(ROOT, 'index.js'), path.join(STAGE, 'index.js'));
  fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(STAGE, 'package.json'));

  fs.cpSync(nodeModules, path.join(STAGE, 'node_modules'), { recursive: true });
  prune(path.join(STAGE, 'node_modules'));

  console.log('Creating function.zip…');
  if (fs.existsSync(OUT)) fs.rmSync(OUT, { force: true });
  const output = fs.createWriteStream(OUT);
  const archive = archiver('zip', { zlib: { level: 9 } });

  return new Promise((resolve, reject) => {
    output.on('close', () => {
      console.log(`Packaged ${OUT} (${Math.round(archive.pointer() / 1024)} KB)`);
      fs.rmSync(STAGE, { recursive: true, force: true });
      resolve();
    });
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(STAGE, false);
    archive.finalize();
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});