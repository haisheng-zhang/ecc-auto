'use strict';

const fs = require('fs');
const path = require('path');

class ProjectDetector {
  constructor(rootPath = '.') {
    this.rootPath = path.resolve(rootPath);
    this._cache = null;
  }

  detect() {
    if (!this._cache) {
      this._cache = this._detectUncached();
    }
    return this._cache;
  }

  _detectUncached() {
    const language = this.detectLanguage();
    const framework = this.detectFramework(language);
    const packageManager = this.detectPackageManager();
    const buildTool = this.detectBuildTool(language);

    return {
      language,
      framework,
      packageManager,
      buildTool,
      hasClaudeDir: fs.existsSync(path.join(this.rootPath, '.claude')),
      hasEccConfig: fs.existsSync(path.join(this.rootPath, '.ecc', 'config.json')),
    };
  }

  detectLanguage() {
    if (fs.existsSync(path.join(this.rootPath, 'package.json'))) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(this.rootPath, 'package.json'), 'utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        const hasTs = deps.typescript ||
          fs.existsSync(path.join(this.rootPath, 'tsconfig.json')) ||
          ['frontend', 'src', 'app', 'client'].some(d =>
            fs.existsSync(path.join(this.rootPath, d, 'tsconfig.json')));
        if (hasTs) {
          return 'typescript';
        }
        return 'javascript';
      } catch (_) {
        return 'javascript';
      }
    }

    if (fs.existsSync(path.join(this.rootPath, 'requirements.txt')) ||
        fs.existsSync(path.join(this.rootPath, 'pyproject.toml')) ||
        fs.existsSync(path.join(this.rootPath, 'setup.py'))) {
      return 'python';
    }

    if (fs.existsSync(path.join(this.rootPath, 'go.mod'))) return 'golang';

    // build.gradle.kts is Kotlin-specific; check before generic build.gradle
    if (fs.existsSync(path.join(this.rootPath, 'build.gradle.kts'))) return 'kotlin';

    if (fs.existsSync(path.join(this.rootPath, 'pom.xml')) ||
        fs.existsSync(path.join(this.rootPath, 'build.gradle'))) {
      return 'java';
    }

    if (fs.existsSync(path.join(this.rootPath, 'Cargo.toml'))) return 'rust';

    if (fs.existsSync(path.join(this.rootPath, 'composer.json'))) return 'php';

    if (fs.existsSync(path.join(this.rootPath, 'Package.swift'))) return 'swift';

    if (this._hasFilesWithExtension(['.csproj', '.sln'])) return 'csharp';

    if (fs.existsSync(path.join(this.rootPath, 'CMakeLists.txt')) ||
        this._hasFilesWithExtension(['.cpp', '.cc', '.cxx'])) {
      return 'cpp';
    }

    return 'unknown';
  }

  detectFramework(language) {
    if (language === 'typescript' || language === 'javascript') return this.detectJSFramework();
    if (language === 'python') return this.detectPythonFramework();
    if (language === 'java') return this.detectJavaFramework();
    if (language === 'php') return this.detectPhpFramework();
    return null;
  }

  detectJSFramework() {
    if (!fs.existsSync(path.join(this.rootPath, 'package.json'))) return null;
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(this.rootPath, 'package.json'), 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps.next) return 'next';
      if (deps.react) return 'react';
      if (deps.vue) return 'vue';
      if (deps.express) return 'express';
      if (deps['@nestjs/core']) return 'nestjs';
      return 'node';
    } catch (_) {
      return null;
    }
  }

  detectPythonFramework() {
    const sources = [
      path.join(this.rootPath, 'requirements.txt'),
      path.join(this.rootPath, 'pyproject.toml'),
    ];
    for (const src of sources) {
      if (!fs.existsSync(src)) continue;
      try {
        const content = fs.readFileSync(src, 'utf8').toLowerCase();
        if (content.includes('django')) return 'django';
        if (content.includes('flask')) return 'flask';
        if (content.includes('fastapi')) return 'fastapi';
      } catch (_) {}
    }
    return null;
  }

  detectJavaFramework() {
    const sources = [
      path.join(this.rootPath, 'pom.xml'),
      path.join(this.rootPath, 'build.gradle'),
    ];
    for (const src of sources) {
      if (!fs.existsSync(src)) continue;
      try {
        const content = fs.readFileSync(src, 'utf8');
        if (content.includes('spring-boot')) return 'spring-boot';
        if (content.includes('quarkus')) return 'quarkus';
      } catch (_) {}
    }
    return 'java';
  }

  detectPhpFramework() {
    const composerPath = path.join(this.rootPath, 'composer.json');
    if (!fs.existsSync(composerPath)) return null;
    try {
      const pkg = JSON.parse(fs.readFileSync(composerPath, 'utf8'));
      const deps = { ...pkg.require, ...pkg['require-dev'] };
      if (deps['laravel/framework']) return 'laravel';
      if (deps['symfony/symfony'] || deps['symfony/framework-bundle']) return 'symfony';
    } catch (_) {}
    return null;
  }

  detectBuildTool(language) {
    if (language === 'java' || language === 'kotlin') {
      if (fs.existsSync(path.join(this.rootPath, 'pom.xml'))) return 'maven';
      if (fs.existsSync(path.join(this.rootPath, 'build.gradle')) ||
          fs.existsSync(path.join(this.rootPath, 'build.gradle.kts'))) return 'gradle';
    }
    return null;
  }

  detectPackageManager() {
    if (fs.existsSync(path.join(this.rootPath, 'package-lock.json'))) return 'npm';
    if (fs.existsSync(path.join(this.rootPath, 'yarn.lock'))) return 'yarn';
    if (fs.existsSync(path.join(this.rootPath, 'pnpm-lock.yaml'))) return 'pnpm';
    if (fs.existsSync(path.join(this.rootPath, 'bun.lockb'))) return 'bun';
    if (fs.existsSync(path.join(this.rootPath, 'poetry.lock'))) return 'poetry';
    if (fs.existsSync(path.join(this.rootPath, 'Cargo.lock'))) return 'cargo';
    return null;
  }

  getBuildResolverAgent() {
    const { language } = this.detect();
    const map = {
      typescript: 'ecc:build-error-resolver',
      javascript: 'ecc:build-error-resolver',
      python:     'ecc:build-error-resolver',
      golang:     'ecc:go-build-resolver',
      java:       'ecc:java-build-resolver',
      kotlin:     'ecc:kotlin-build-resolver',
      rust:       'ecc:rust-build-resolver',
      cpp:        'ecc:cpp-build-resolver',
      swift:      'ecc:build-error-resolver',
      csharp:     'ecc:build-error-resolver',
      php:        'ecc:build-error-resolver',
    };
    return map[language] || 'ecc:build-error-resolver';
  }

  getBuildCommand() {
    const { language, packageManager, buildTool } = this.detect();
    if (language === 'typescript' || language === 'javascript') {
      const pm = packageManager || 'npm';
      return `${pm} run build`;
    }
    if (language === 'golang')  return 'go build ./...';
    if (language === 'rust')    return 'cargo build';
    if (language === 'cpp')     return 'cmake --build build';
    if (language === 'python')  return null;
    if (language === 'java' || language === 'kotlin') {
      if (buildTool === 'maven')  return 'mvn compile -q';
      if (buildTool === 'gradle') return './gradlew build';
    }
    return null;
  }

  isE2EApplicable() {
    const { language, framework } = this.detect();
    if (language !== 'typescript' && language !== 'javascript') return false;
    return ['react', 'next', 'vue', 'nuxt'].includes(framework);
  }

  getECCAgents() {
    const language = this.detect().language;
    const agentMap = {
      typescript: ['typescript-reviewer', 'code-reviewer', 'security-reviewer'],
      javascript: ['code-reviewer', 'security-reviewer'],
      python: ['python-reviewer', 'code-reviewer', 'security-reviewer'],
      golang: ['go-reviewer', 'code-reviewer', 'security-reviewer'],
      java: ['java-reviewer', 'code-reviewer', 'security-reviewer', 'java-build-resolver'],
      rust: ['rust-reviewer', 'code-reviewer', 'security-reviewer', 'rust-build-resolver'],
      cpp: ['cpp-reviewer', 'code-reviewer', 'security-reviewer', 'cpp-build-resolver'],
      php: ['code-reviewer', 'security-reviewer'],
      swift: ['swift-reviewer', 'code-reviewer', 'security-reviewer'],
      kotlin: ['kotlin-reviewer', 'code-reviewer', 'security-reviewer', 'kotlin-build-resolver'],
      csharp: ['code-reviewer', 'security-reviewer'],
      unknown: ['code-reviewer', 'security-reviewer'],
    };
    return agentMap[language] || agentMap.unknown;
  }

  _hasFilesWithExtension(extensions) {
    try {
      return fs.readdirSync(this.rootPath).some(f =>
        extensions.some(ext => f.endsWith(ext))
      );
    } catch (_) {
      return false;
    }
  }
}

module.exports = { ProjectDetector };
