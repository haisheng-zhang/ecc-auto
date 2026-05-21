# ecc-auto

> Automatic code quality automation for [ECC (Everything Claude Code)](https://github.com/affaan-m/everything-claude-code) — code review, security scan, test coverage, build error resolution, and more, triggered automatically on every file change.

[![npm version](https://img.shields.io/npm/v/ecc-auto.svg)](https://www.npmjs.com/package/ecc-auto)
[![license](https://img.shields.io/npm/l/ecc-auto.svg)](LICENSE)

## What it does

ecc-auto installs itself as a Claude Code plugin. After setup, every time Claude edits a file in your project, it automatically runs a configurable quality gate:

| Check | Agent | Default |
|---|---|---|
| Code review | Language-specific ECC reviewer | ✅ on |
| Security scan | `ecc:security-reviewer` | ✅ on |
| Test coverage + generation | `ecc:tdd-guide` | ✅ on |
| Build error resolution | Language-specific build resolver | ✅ on |
| E2E tests | `ecc:e2e-runner` | ⬜ off (auto-on for frontend) |
| Dead code detection | `ecc:refactor-cleaner` | ⬜ off |

## Prerequisites

- [ECC](https://github.com/affaan-m/everything-claude-code) installed
- Node.js 16+

## Installation

```bash
# 1. Install the npm package globally
npm install -g ecc-auto

# 2. Install the Claude Code plugin (one-time, global)
ecc-auto install

# 3. Configure your project
cd your-project
ecc-auto init

# 4. Restart Claude Code
```

After restart, Claude will automatically run `/ecc-auto` after every file edit.

## Commands

### Setup

| Command | Description |
|---|---|
| `ecc-auto install` | Install plugin into Claude Code (global, one-time) |
| `ecc-auto uninstall` | Remove plugin from Claude Code |
| `ecc-auto init` | Configure current project |
| `ecc-auto remove` | Remove configuration from current project |

### Feature management

```bash
ecc-auto features              # show all features and their status
ecc-auto enable  <feature>     # turn a feature on
ecc-auto disable <feature>     # turn a feature off
```

Available features: `codeReview`, `securityScan`, `testCoverage`, `buildResolver`, `e2eTests`, `refactorClean`

### Reports

| Command | Description |
|---|---|
| `ecc-auto report` | Show latest session report |
| `ecc-auto status` | Show current config and status |
| `ecc-auto log` | View session history |

## How it works

```
Claude edits a file
        ↓
PostToolUse hook fires (shell)
  → check.js tracks file to .ecc/session-current.json
        ↓
Claude reads CLAUDE.md instruction:
  "After every Write/Edit, run /ecc-auto"
        ↓
/ecc-auto command runs (Claude Code)
  → reads .ecc/config.json (which features are on)
  → reads .ecc/session-current.json (which files changed)
  → invokes ECC reviewer agents based on language
  → invokes security-reviewer
  → invokes optional agents per config
  → outputs consolidated review summary
        ↓
Session ends (Stop hook)
  → summarize.js writes report to .ecc/reports/
```

## Project structure after `ecc-auto init`

```
your-project/
  .ecc/
    config.json              ← feature configuration
    reports/                 ← per-session reports (gitignored)
  .claude/
    commands/
      ecc-auto.md            ← /ecc-auto quality gate command
    rules/
      common/                ← ECC common coding rules
      typescript/            ← language-specific rules (if found)
  CLAUDE.md                  ← auto-trigger instruction
```

> **Adding a new language mid-project?** Re-run `ecc-auto init` — it will detect the new language and install the corresponding rules into `.claude/rules/`. The `/ecc-auto` command already covers all languages automatically, so no command update is needed.

## Configuration

`.ecc/config.json` is created automatically. Edit it directly or use the CLI:

```json
{
  "version": "1.0",
  "runLint": false,
  "generateReport": true,
  "features": {
    "codeReview":    true,
    "securityScan":  true,
    "testCoverage":  true,
    "buildResolver": true,
    "e2eTests":      false,
    "refactorClean": false
  }
}
```

```bash
# CLI equivalents
ecc-auto enable  e2eTests
ecc-auto disable testCoverage
```

## Supported languages

| Language | Reviewer | Build Resolver |
|---|---|---|
| TypeScript | `ecc:typescript-reviewer` | `ecc:build-error-resolver` |
| JavaScript | `ecc:typescript-reviewer` | `ecc:build-error-resolver` |
| Python | `ecc:python-reviewer` | `ecc:build-error-resolver` |
| Go | `ecc:go-reviewer` | `ecc:go-build-resolver` |
| Java | `ecc:java-reviewer` | `ecc:java-build-resolver` |
| Kotlin | `ecc:kotlin-reviewer` | `ecc:kotlin-build-resolver` |
| Rust | `ecc:rust-reviewer` | `ecc:rust-build-resolver` |
| C++ | `ecc:cpp-reviewer` | `ecc:cpp-build-resolver` |
| Swift | `ecc:swift-reviewer` | `ecc:build-error-resolver` |
| C# | `ecc:csharp-reviewer` | `ecc:build-error-resolver` |
| PHP | `ecc:code-reviewer` | `ecc:build-error-resolver` |

## Architecture

ecc-auto is a Claude Code plugin with two layers:

**Shell layer** (runs as OS process via hooks):
- Tracks changed files to `.ecc/session-current.json`
- Writes session reports on session end
- Registers globally — works in all projects that have run `ecc-auto init`

**Claude Code layer** (runs inside Claude's conversation):
- `/ecc-auto` custom command orchestrates ECC agent invocations
- CLAUDE.md instructs Claude to run `/ecc-auto` automatically after every edit
- ECC agents handle code review, security, tests, and build errors

```
~/.claude/plugins/ecc-auto/
  agents/ecc-auto.md         ← agent definition
  hooks/hooks.json           ← hook config
  scripts/check.js           ← PostToolUse: file tracking
  scripts/summarize.js       ← Stop: session report
```

## License

MIT License — Copyright (c) 2026 Haisheng Zhang
