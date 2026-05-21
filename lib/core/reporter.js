'use strict';

const fs = require('fs');
const path = require('path');

class Reporter {
  constructor(rootPath = '.') {
    this.rootPath = path.resolve(rootPath);
    this.reportsDir = path.join(this.rootPath, '.ecc', 'reports');
  }

  async show() {
    console.log('\n📊 ecc-auto Report\n');
    const reports = this.getReports();
    if (reports.length === 0) {
      console.log('No reports yet. Reports are generated at the end of each session.\n');
      return;
    }
    const data = JSON.parse(fs.readFileSync(reports[0], 'utf8'));
    console.log(`📅 Date:           ${data.timestamp}`);
    console.log(`📁 Project:        ${data.project || 'Unknown'}`);
    console.log(`📝 Files changed:  ${data.filesChanged || 0}`);
    console.log(`✅ Lint passed:    ${data.lintPassed || 0}`);
    console.log(`⚠️  Lint issues:   ${data.lintIssues || 0}`);
    console.log('\n💡 Run `ecc-auto log` for full history\n');
  }

  async status() {
    console.log('\n🔍 ecc-auto Status\n');
    const config = this.getConfig();
    const reports = this.getReports();
    console.log(`Status:  ${config ? 'Configured' : 'Not configured'}`);
    console.log(`Reports: ${reports.length} session(s)`);
    if (config) {
      console.log('\nSettings:');
      console.log(`  Lint:         ${config.runLint ? 'ON' : 'OFF'}`);
      console.log(`  Silent mode:  ${config.silent ? 'ON' : 'OFF'}`);
    }
    console.log('');
  }

  async log() {
    console.log('\n📜 ecc-auto History\n');
    const reports = this.getReports();
    if (reports.length === 0) {
      console.log('No history yet.\n');
      return;
    }
    reports.forEach((report, i) => {
      try {
        const data = JSON.parse(fs.readFileSync(report, 'utf8'));
        console.log(`${i + 1}. ${data.timestamp}  ${data.filesChanged || 0} files  lint: ${data.lintPassed || 0} passed / ${data.lintIssues || 0} issues`);
      } catch (_) {}
    });
    console.log('');
  }

  getReports() {
    if (!fs.existsSync(this.reportsDir)) return [];
    return fs.readdirSync(this.reportsDir)
      .filter(f => f.endsWith('.json'))
      .map(f => path.join(this.reportsDir, f))
      .sort((a, b) => fs.statSync(b).mtime.getTime() - fs.statSync(a).mtime.getTime());
  }

  getConfig() {
    const configPath = path.join(this.rootPath, '.ecc', 'config.json');
    if (!fs.existsSync(configPath)) return null;
    try { return JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch (_) { return null; }
  }
}

module.exports = { Reporter };
