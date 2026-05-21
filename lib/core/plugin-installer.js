'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const PLUGIN_NAME = 'ecc-auto';
const PLUGIN_SRC = path.join(__dirname, '..', '..', 'plugin');

function getPluginDir() {
  return path.join(os.homedir(), '.claude', 'plugins', PLUGIN_NAME);
}

function getGlobalSettingsPath() {
  return path.join(os.homedir(), '.claude', 'settings.json');
}

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

function deduplicateHooks(hooks) {
  const seen = new Set();
  return hooks.filter(h => {
    const k = JSON.stringify(h);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function registerHooks(pluginDir) {
  const hooksDefPath = path.join(pluginDir, 'hooks', 'hooks.json');
  const hooksDef = JSON.parse(fs.readFileSync(hooksDefPath, 'utf8'));

  const settingsPath = getGlobalSettingsPath();
  let settings = {};
  if (fs.existsSync(settingsPath)) {
    try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch (_) {}
  }
  if (!settings.hooks) settings.hooks = {};

  for (const [event, entries] of Object.entries(hooksDef.hooks)) {
    if (!settings.hooks[event]) settings.hooks[event] = [];
    for (const entry of entries) {
      const resolved = {
        ...entry,
        hooks: entry.hooks.map(h => ({
          ...h,
          command: h.command.replace(/\$PLUGIN_DIR/g, pluginDir),
        })),
      };
      settings.hooks[event].push(resolved);
    }
    settings.hooks[event] = deduplicateHooks(settings.hooks[event]);
  }

  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

function deregisterHooks(pluginDir) {
  const settingsPath = getGlobalSettingsPath();
  if (!fs.existsSync(settingsPath)) return;
  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    if (!settings.hooks) return;
    const scriptsDir = path.join(pluginDir, 'scripts');
    const isEccAuto = h => h.hooks?.some(cmd =>
      cmd.command?.includes(scriptsDir) ||
      cmd.command?.includes('ecc-auto/scripts/check.js') ||
      cmd.command?.includes('ecc-auto/scripts/summarize.js')
    );
    if (settings.hooks.PostToolUse) {
      settings.hooks.PostToolUse = settings.hooks.PostToolUse.filter(h => !isEccAuto(h));
    }
    if (settings.hooks.Stop) {
      settings.hooks.Stop = settings.hooks.Stop.filter(h => !isEccAuto(h));
    }
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  } catch (_) {}
}

async function install() {
  console.log('\n🔌 Installing ecc-auto plugin...\n');

  const pluginDir = getPluginDir();
  if (fs.existsSync(pluginDir)) fs.rmSync(pluginDir, { recursive: true, force: true });

  copyDir(PLUGIN_SRC, pluginDir);
  console.log(`✓ Copied plugin to ${pluginDir}`);

  registerHooks(pluginDir);
  console.log('✓ Registered hooks in ~/.claude/settings.json');

  console.log('\n✅ ecc-auto plugin installed!\n');
  console.log('   Next steps:');
  console.log('   1. cd your-project && ecc-auto init');
  console.log('   2. Restart Claude Code\n');
}

async function uninstall() {
  console.log('\n🗑️  Uninstalling ecc-auto plugin...\n');

  const pluginDir = getPluginDir();
  deregisterHooks(pluginDir);
  console.log('✓ Removed hooks from ~/.claude/settings.json');

  if (fs.existsSync(pluginDir)) {
    fs.rmSync(pluginDir, { recursive: true, force: true });
    console.log('✓ Removed plugin directory');
  }

  console.log('\n✅ ecc-auto plugin uninstalled!\n');
}

module.exports = { install, uninstall, getPluginDir };
