'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { ProjectDetector } = require('./detector');
const { FEATURES } = require('./features');

const ECC_AUTO_START = '<!-- ecc-auto:start -->';
const ECC_AUTO_END = '<!-- ecc-auto:end -->';

const LANG_RULE_DIRS = {
  typescript: 'typescript', javascript: 'typescript',
  python: 'python', golang: 'golang', swift: 'swift', php: 'php',
};

class Installer {
  constructor(rootPath = '.') {
    this.rootPath = path.resolve(rootPath);
    this.detector = new ProjectDetector(this.rootPath);
  }

  async install() {
    console.log('\n🚀 ecc-auto init - Configuring project...\n');

    const config = this.detector.detect();
    console.log(`📊 Detected: ${config.language}${config.framework ? ` (${config.framework})` : ''}`);

    const eccDir = path.join(this.rootPath, '.ecc');
    if (!fs.existsSync(eccDir)) fs.mkdirSync(eccDir, { recursive: true });
    const reportsDir = path.join(eccDir, 'reports');
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

    await this.createUserConfig(eccDir, config);
    await this.installCommand();
    await this.installClaudeMd();
    await this.installRules(config);
    await this.updateGitignore();

    console.log('\n✅ Project configured!\n');
    console.log('   Restart Claude Code to activate ecc-auto.\n');
  }

  async createUserConfig(eccDir, config) {
    const configPath = path.join(eccDir, 'config.json');

    const defaultFeatures = {};
    for (const [name, meta] of Object.entries(FEATURES)) {
      defaultFeatures[name] = (name === 'e2eTests')
        ? this.detector.isE2EApplicable()
        : meta.default;
    }

    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, JSON.stringify({
        version: '1.0',
        autoDetect: true,
        silent: true,
        runLint: false,
        generateReport: true,
        features: defaultFeatures,
      }, null, 2));
      console.log('✓ Created .ecc/config.json');
    } else {
      // migrate: add missing features to existing config
      const existing = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (!existing.features) {
        existing.features = defaultFeatures;
        fs.writeFileSync(configPath, JSON.stringify(existing, null, 2));
        console.log('✓ Migrated .ecc/config.json (added features)');
      } else {
        console.log('✓ .ecc/config.json already exists');
      }
    }
  }

  async installCommand() {
    const commandsDir = path.join(this.rootPath, '.claude', 'commands');
    if (!fs.existsSync(commandsDir)) fs.mkdirSync(commandsDir, { recursive: true });

    fs.writeFileSync(path.join(commandsDir, 'ecc-auto.md'), `# ecc-auto — Quality Gate

Read \`.ecc/config.json\` to check which features are enabled.
Read \`.ecc/session-current.json\` for the list of recently changed files.
If the session file is missing or empty, review the file(s) from the most recent tool output.

## Step 1 — Code review (always run)

Group changed files by language. For each group invoke the appropriate reviewer:

| Language | Agent |
|---|---|
| .ts, .tsx | ecc:typescript-reviewer |
| .js, .jsx, .mjs | ecc:typescript-reviewer |
| .py | ecc:python-reviewer |
| .go | ecc:go-reviewer |
| .java | ecc:java-reviewer |
| .kt, .kts | ecc:kotlin-reviewer |
| .rs | ecc:rust-reviewer |
| .cpp, .cc, .cxx, .h, .hpp | ecc:cpp-reviewer |
| .swift | ecc:swift-reviewer |
| .cs | ecc:csharp-reviewer |
| .php | ecc:code-reviewer |
| other | ecc:code-reviewer |

## Step 2 — Security scan (always run)

Invoke **ecc:security-reviewer** on all changed files.

## Step 3 — Optional checks (only if enabled in .ecc/config.json)

**If \`features.testCoverage\` is true:**
For each changed source file, check if a corresponding test file exists.
If tests are missing or incomplete, invoke **ecc:tdd-guide** to generate them.

**If \`features.buildResolver\` is true:**
Run the project build command. If it fails, invoke the appropriate build resolver:
- TypeScript/JS: ecc:build-error-resolver
- Go: ecc:go-build-resolver
- Java: ecc:java-build-resolver
- Kotlin: ecc:kotlin-build-resolver
- Rust: ecc:rust-build-resolver
- C++: ecc:cpp-build-resolver
- Other: ecc:build-error-resolver

**If \`features.e2eTests\` is true:**
Invoke **ecc:e2e-runner** on any changed UI components.

**If \`features.refactorClean\` is true:**
Invoke **ecc:refactor-cleaner** to identify dead code in the changed files.

## Output

Print a consolidated summary with sections for each check that ran.
End with \`✅ All checks passed\` if nothing needs attention.
`);
    console.log('✓ Installed .claude/commands/ecc-auto.md');
  }

  async installClaudeMd() {
    const claudeMdPath = path.join(this.rootPath, 'CLAUDE.md');
    const section = `${ECC_AUTO_START}
# ecc-auto

After every Write or Edit tool call, immediately run \`/ecc-auto\`. Do not wait. Do not ask.
${ECC_AUTO_END}`;

    if (fs.existsSync(claudeMdPath)) {
      const existing = fs.readFileSync(claudeMdPath, 'utf8');
      const hasStart = existing.includes(ECC_AUTO_START);
      const hasEnd   = existing.includes(ECC_AUTO_END);
      if (hasStart && hasEnd) {
        const startIdx = existing.indexOf(ECC_AUTO_START);
        const endIdx   = existing.indexOf(ECC_AUTO_END) + ECC_AUTO_END.length;
        fs.writeFileSync(claudeMdPath, existing.slice(0, startIdx) + section + existing.slice(endIdx));
        console.log('✓ Updated CLAUDE.md');
      } else if (hasStart && !hasEnd) {
        console.log('⚠️  CLAUDE.md has corrupted ecc-auto block — re-appending');
        fs.appendFileSync(claudeMdPath, '\n\n' + section + '\n');
      } else {
        fs.appendFileSync(claudeMdPath, '\n\n' + section + '\n');
        console.log('✓ Appended ecc-auto section to CLAUDE.md');
      }
    } else {
      fs.writeFileSync(claudeMdPath, section + '\n');
      console.log('✓ Created CLAUDE.md');
    }
  }

  async installRules(config) {
    const ruleDirName = LANG_RULE_DIRS[config.language];

    const eccPluginDirs = [
      path.join(os.homedir(), '.claude', 'plugins', 'ecc'),
      path.join(os.homedir(), '.claude', 'plugins', 'everything-claude-code'),
      path.join(os.homedir(), '.claude', 'plugins', 'marketplaces', 'ecc'),
      path.join(os.homedir(), '.claude', 'plugins', 'marketplaces', 'everything-claude-code'),
    ];
    const eccDir = eccPluginDirs.find(d => fs.existsSync(path.join(d, 'rules')));

    if (!eccDir) {
      console.log('⚠️  ECC plugin not found — skipping rules installation');
      return;
    }

    const rulesDestDir = path.join(this.rootPath, '.claude', 'rules');
    if (!fs.existsSync(rulesDestDir)) fs.mkdirSync(rulesDestDir, { recursive: true });

    const commonSrc = path.join(eccDir, 'rules', 'common');
    if (fs.existsSync(commonSrc)) {
      this._copyDir(commonSrc, path.join(rulesDestDir, 'common'));
      console.log('✓ Installed common rules → .claude/rules/common/');
    }

    if (ruleDirName) {
      const langSrc = path.join(eccDir, 'rules', ruleDirName);
      if (fs.existsSync(langSrc)) {
        this._copyDir(langSrc, path.join(rulesDestDir, ruleDirName));
        console.log(`✓ Installed ${ruleDirName} rules → .claude/rules/${ruleDirName}/`);
      }
    }
  }

  async updateGitignore() {
    const gitignorePath = path.join(this.rootPath, '.gitignore');
    const entry = '.ecc/reports/';
    if (fs.existsSync(gitignorePath)) {
      const content = fs.readFileSync(gitignorePath, 'utf8');
      if (!content.includes(entry)) {
        fs.appendFileSync(gitignorePath, `\n# ecc-auto\n${entry}\n.ecc/session-current.json\n`);
        console.log('✓ Updated .gitignore');
      }
    } else {
      fs.writeFileSync(gitignorePath, `# ecc-auto\n${entry}\n.ecc/session-current.json\n`);
      console.log('✓ Created .gitignore');
    }
  }

  async remove() {
    console.log('\n🗑️  Removing ecc-auto from project...\n');

    const eccDir = path.join(this.rootPath, '.ecc');
    if (fs.existsSync(eccDir)) {
      fs.rmSync(eccDir, { recursive: true, force: true });
      console.log('✓ Removed .ecc/ directory');
    }

    const commandPath = path.join(this.rootPath, '.claude', 'commands', 'ecc-auto.md');
    if (fs.existsSync(commandPath)) {
      fs.unlinkSync(commandPath);
      console.log('✓ Removed .claude/commands/ecc-auto.md');
    }

    const claudeMdPath = path.join(this.rootPath, 'CLAUDE.md');
    if (fs.existsSync(claudeMdPath)) {
      const content = fs.readFileSync(claudeMdPath, 'utf8');
      const startIdx = content.indexOf(ECC_AUTO_START);
      const endIdx   = content.indexOf(ECC_AUTO_END);
      if (startIdx !== -1 && endIdx !== -1) {
        const before = content.slice(0, startIdx).trimEnd();
        const after  = content.slice(endIdx + ECC_AUTO_END.length).trimStart();
        const newContent = (before + (after ? '\n\n' + after : '')).trim();
        if (newContent) {
          fs.writeFileSync(claudeMdPath, newContent + '\n');
        } else {
          fs.unlinkSync(claudeMdPath);
        }
        console.log('✓ Cleaned CLAUDE.md');
      }
    }

    console.log('\n✅ Project configuration removed.\n');
  }

  _copyDir(src, dest) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const s = path.join(src, entry.name);
      const d = path.join(dest, entry.name);
      if (entry.isDirectory()) this._copyDir(s, d);
      else fs.copyFileSync(s, d);
    }
  }
}

module.exports = { Installer };
