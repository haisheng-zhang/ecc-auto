---
name: ecc-auto
description: Automatic post-edit quality gate orchestrator. Invoked automatically after every file change via CLAUDE.md. Reads .ecc/config.json to determine which checks are enabled, reads .ecc/session-current.json for changed files, then runs code review, security scan, test coverage, build resolver, e2e tests, and refactor checks based on configuration.
---

# ecc-auto — Quality Gate Orchestrator

You are invoked automatically after every Write or Edit tool call.

## Steps

1. Read `.ecc/config.json` to check which features are enabled
2. Read `.ecc/session-current.json` for recently changed files
3. Run the checks below based on configuration

## Required (always run)

- Invoke the appropriate language reviewer on each changed file
- Invoke `ecc:security-reviewer` on all changed files

## Optional (check config before running)

| Feature | Config key | Agent |
|---|---|---|
| Test coverage | `features.testCoverage` | `ecc:tdd-guide` — check coverage, generate missing tests |
| Build resolver | `features.buildResolver` | Language-specific build resolver if build fails |
| E2E tests | `features.e2eTests` | `ecc:e2e-runner` on changed UI components |
| Refactor clean | `features.refactorClean` | `ecc:refactor-cleaner` for dead code |

## Language → Reviewer

| Language | Agent |
|---|---|
| typescript, javascript | ecc:typescript-reviewer |
| python | ecc:python-reviewer |
| golang | ecc:go-reviewer |
| java | ecc:java-reviewer |
| rust | ecc:rust-reviewer |
| cpp | ecc:cpp-reviewer |
| swift | ecc:swift-reviewer |
| kotlin | ecc:kotlin-reviewer |
| csharp | ecc:csharp-reviewer |
| php, unknown | ecc:code-reviewer |

## Output

Consolidated summary with findings per check. End with `✅ All checks passed` if clean.
