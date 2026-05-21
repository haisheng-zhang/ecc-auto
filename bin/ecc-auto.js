#!/usr/bin/env node
'use strict';

const command = process.argv[2];
const arg     = process.argv[3];

function showHelp() {
  console.log(`
ecc-auto - Automatic code review automation powered by ECC

Setup (one-time, global):
  ecc-auto install            Install ecc-auto plugin into Claude Code
  ecc-auto uninstall          Remove ecc-auto plugin from Claude Code

Per-project:
  ecc-auto init               Configure current project
  ecc-auto remove             Remove ecc-auto config from current project

Feature management:
  ecc-auto features           Show all features and their status
  ecc-auto enable  <feature>  Enable a feature
  ecc-auto disable <feature>  Disable a feature

Reports:
  ecc-auto report             Show latest session report
  ecc-auto status             Show current status
  ecc-auto log                View history

  ecc-auto help               Show this help
  `);
}

switch (command) {
  case 'install':
    require('../lib/core/plugin-installer').install().catch(console.error);
    break;
  case 'uninstall':
    require('../lib/core/plugin-installer').uninstall().catch(console.error);
    break;
  case 'init':
    new (require('../lib/core/installer').Installer)().install().catch(console.error);
    break;
  case 'remove':
    new (require('../lib/core/installer').Installer)().remove().catch(console.error);
    break;
  case 'features':
    require('../lib/core/features').showFeatures();
    break;
  case 'enable':
    if (!arg) { console.error('Usage: ecc-auto enable <feature>'); process.exit(1); }
    require('../lib/core/features').enableFeature(arg);
    break;
  case 'disable':
    if (!arg) { console.error('Usage: ecc-auto disable <feature>'); process.exit(1); }
    require('../lib/core/features').disableFeature(arg);
    break;
  case 'report':
    new (require('../lib/core/reporter').Reporter)().show().catch(console.error);
    break;
  case 'status':
    new (require('../lib/core/reporter').Reporter)().status().catch(console.error);
    break;
  case 'log':
    new (require('../lib/core/reporter').Reporter)().log().catch(console.error);
    break;
  case 'help':
  case '--help':
  case '-h':
  case undefined:
    showHelp();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    showHelp();
    process.exit(1);
}
