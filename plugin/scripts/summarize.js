#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function findProjectRoot(startDir) {
  let dir = path.resolve(startDir || process.cwd());
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, '.ecc', 'config.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(startDir || process.cwd());
}

function main() {
  const root = findProjectRoot();
  if (!fs.existsSync(path.join(root, '.ecc', 'config.json'))) return;

  const sessionPath = path.join(root, '.ecc', 'session-current.json');
  let session = { started: null, filesChanged: [], lintIssues: 0, lintPassed: 0 };
  if (fs.existsSync(sessionPath)) {
    try { session = JSON.parse(fs.readFileSync(sessionPath, 'utf8')); } catch (_) {}
  }

  if (session.filesChanged.length === 0) return;

  const uniqueFiles = new Set(session.filesChanged.map(f => f.path)).size;
  const languages = [...new Set(session.filesChanged.map(f => f.language).filter(l => l !== 'unknown'))];

  console.log('\n========================================');
  console.log('  🤖 ECC Auto - Session Summary');
  console.log('========================================');
  console.log(`  Time:    ${new Date().toISOString()}`);
  console.log(`  Project: ${path.basename(root)}`);
  console.log('----------------------------------------');
  console.log(`  Files modified: ${uniqueFiles}`);
  if (languages.length > 0) console.log(`  Languages: ${languages.join(', ')}`);
  if (session.lintIssues > 0) {
    console.log(`  Lint issues: ${session.lintIssues}`);
  } else if (session.lintPassed > 0) {
    console.log(`  Lint passed: ${session.lintPassed}`);
  }
  console.log('----------------------------------------');
  console.log('  Run `ecc-auto report` for details');
  console.log('========================================\n');

  const reportsDir = path.join(root, '.ecc', 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  const timestamp = new Date().toISOString();
  fs.writeFileSync(
    path.join(reportsDir, `${timestamp.replace(/:/g, '-')}.json`),
    JSON.stringify({
      timestamp,
      project: path.basename(root),
      filesChanged: uniqueFiles,
      lintIssues: session.lintIssues || 0,
      lintPassed: session.lintPassed || 0,
    }, null, 2)
  );

  if (fs.existsSync(sessionPath)) fs.unlinkSync(sessionPath);
}

main();
