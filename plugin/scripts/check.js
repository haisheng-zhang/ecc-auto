#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

function readSession(root) {
  const p = path.join(root, '.ecc', 'session-current.json');
  if (fs.existsSync(p)) {
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) {}
  }
  return { started: new Date().toISOString(), filesChanged: [], lintIssues: 0, lintPassed: 0 };
}

function writeSession(root, session) {
  const eccDir = path.join(root, '.ecc');
  if (!fs.existsSync(eccDir)) fs.mkdirSync(eccDir, { recursive: true });
  fs.writeFileSync(path.join(eccDir, 'session-current.json'), JSON.stringify(session, null, 2));
}

const EXT_LANGUAGE_MAP = {
  '.ts': 'typescript', '.tsx': 'typescript',
  '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
  '.py': 'python',
  '.go': 'golang',
  '.rs': 'rust',
  '.java': 'java',
  '.kt': 'kotlin', '.kts': 'kotlin',
  '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp', '.h': 'cpp', '.hpp': 'cpp',
  '.cs': 'csharp',
  '.php': 'php',
  '.swift': 'swift',
};

function languageFromPath(filePath) {
  return EXT_LANGUAGE_MAP[path.extname(filePath).toLowerCase()] || 'unknown';
}

function readStdin() {
  return new Promise(resolve => {
    if (process.stdin.isTTY) { resolve(null); return; }
    let buf = '';
    const timer = setTimeout(() => resolve(buf || null), 2000);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', c => { buf += c; });
    process.stdin.on('end', () => { clearTimeout(timer); resolve(buf || null); });
    process.stdin.on('error', () => { clearTimeout(timer); resolve(null); });
  });
}

const LINT_COMMANDS = {
  typescript: f => `npx eslint "${f}"`,
  javascript: f => `npx eslint "${f}"`,
  python:     f => `python -m flake8 "${f}"`,
  golang:     f => `go vet "${f}"`,
};

function runLint(filePath, language, cwd) {
  const cmd = LINT_COMMANDS[language]?.(filePath);
  if (!cmd) return { passed: true };
  try {
    execSync(cmd, { stdio: 'pipe', timeout: 15000, cwd });
    return { passed: true };
  } catch (e) {
    const out = ((e.stdout || '') + (e.stderr || '')).toString().trim().slice(0, 500);
    return { passed: false, output: out };
  }
}

async function main() {
  let filePath = null;
  let toolName = null;

  const stdinRaw = await readStdin();
  if (stdinRaw) {
    try {
      const data = JSON.parse(stdinRaw);
      toolName = data.tool_name;
      filePath = data.tool_input?.file_path;
    } catch (_) {}
  }

  if (!filePath) process.exit(0);

  const root = findProjectRoot();
  if (!fs.existsSync(path.join(root, '.ecc', 'config.json'))) process.exit(0);

  const session = readSession(root);
  const language = languageFromPath(filePath);
  const entry = { path: filePath, timestamp: new Date().toISOString(), language, tool: toolName, lint: null };

  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(root, '.ecc', 'config.json'), 'utf8'));
    if (cfg.runLint) {
      const result = runLint(filePath, language, root);
      entry.lint = result.passed ? 'passed' : 'failed';
      if (!result.passed) {
        session.lintIssues = (session.lintIssues || 0) + 1;
        if (result.output) process.stderr.write(`[ecc-auto] lint: ${result.output}\n`);
      } else {
        session.lintPassed = (session.lintPassed || 0) + 1;
      }
    }
  } catch (_) {}

  // upsert by path — avoid duplicates for files edited multiple times
  const idx = session.filesChanged.findIndex(e => e.path === filePath);
  if (idx !== -1) {
    session.filesChanged[idx] = entry;
  } else {
    session.filesChanged.push(entry);
  }

  writeSession(root, session);
  process.exit(0);
}

main().catch(() => process.exit(0));
