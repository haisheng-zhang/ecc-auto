'use strict';

const fs = require('fs');
const path = require('path');

const FEATURES = {
  codeReview:    { required: true,  default: true,  desc: 'Language-specific code review' },
  securityScan:  { required: true,  default: true,  desc: 'Security vulnerability scan' },
  testCoverage:  { required: false, default: true,  desc: 'Test coverage check + generate missing tests' },
  buildResolver: { required: false, default: true,  desc: 'Auto-fix build errors' },
  e2eTests:      { required: false, default: false, desc: 'E2E tests (frontend projects only)' },
  refactorClean: { required: false, default: false, desc: 'Dead code detection (slower)' },
};

function findConfigPath(rootPath = '.') {
  return path.join(path.resolve(rootPath), '.ecc', 'config.json');
}

function readConfig(rootPath = '.') {
  const p = findConfigPath(rootPath);
  if (!fs.existsSync(p)) {
    console.error('No .ecc/config.json found in this directory.\nRun `ecc-auto init` first.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeConfig(rootPath, config) {
  fs.writeFileSync(findConfigPath(rootPath), JSON.stringify(config, null, 2));
}

function isEnabled(config, featureName) {
  const features = config.features || {};
  if (featureName in features) return features[featureName];
  return FEATURES[featureName]?.default ?? false;
}

function showFeatures() {
  const config = readConfig();
  console.log('\n📋 ecc-auto features\n');
  for (const [name, meta] of Object.entries(FEATURES)) {
    const on = isEnabled(config, name);
    const icon   = on ? '✅' : '⬜';
    const status = on ? 'on ' : 'off';
    const req    = meta.required ? ' (required)' : '';
    console.log(`  ${icon} ${name.padEnd(14)} ${status}  ${meta.desc}${req}`);
  }
  console.log('\nUsage: ecc-auto enable <feature>  |  ecc-auto disable <feature>\n');
}

function enableFeature(name) {
  if (!FEATURES[name]) {
    console.error(`Unknown feature: ${name}\nAvailable: ${Object.keys(FEATURES).join(', ')}`);
    process.exit(1);
  }
  const config = readConfig();
  if (!config.features) config.features = {};
  config.features[name] = true;
  writeConfig('.', config);
  console.log(`✅ Enabled: ${name}`);
}

function disableFeature(name) {
  if (!FEATURES[name]) {
    console.error(`Unknown feature: ${name}\nAvailable: ${Object.keys(FEATURES).join(', ')}`);
    process.exit(1);
  }
  if (FEATURES[name].required) {
    console.error(`Cannot disable required feature: ${name}`);
    process.exit(1);
  }
  const config = readConfig();
  if (!config.features) config.features = {};
  config.features[name] = false;
  writeConfig('.', config);
  console.log(`⬜ Disabled: ${name}`);
}

module.exports = { FEATURES, isEnabled, showFeatures, enableFeature, disableFeature };
