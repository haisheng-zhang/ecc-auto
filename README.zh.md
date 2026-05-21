# ecc-auto

> [ECC (Everything Claude Code)](https://github.com/affaan-m/everything-claude-code) 的自动化代码质量工具 —— 每次文件变更后自动触发代码审查、安全扫描、测试覆盖检测、构建错误修复等功能。

[![npm version](https://img.shields.io/npm/v/ecc-auto.svg)](https://www.npmjs.com/package/ecc-auto)
[![license](https://img.shields.io/npm/l/ecc-auto.svg)](LICENSE)

## 功能概览

ecc-auto 以 Claude Code 插件的形式安装。配置完成后，每当 Claude 编辑项目文件，都会自动运行可配置的质量检测流程：

| 检测项 | 使用的 ECC Agent | 默认状态 |
|---|---|---|
| 代码审查 | 语言专属 ECC reviewer | ✅ 开启 |
| 安全扫描 | `ecc:security-reviewer` | ✅ 开启 |
| 测试覆盖 + 生成缺失测试 | `ecc:tdd-guide` | ✅ 开启 |
| 构建错误自动修复 | 语言专属 build resolver | ✅ 开启 |
| E2E 测试 | `ecc:e2e-runner` | ⬜ 关闭（前端项目自动开启） |
| 死代码检测 | `ecc:refactor-cleaner` | ⬜ 关闭 |

## 前置条件

- 已安装 [ECC](https://github.com/affaan-m/everything-claude-code)
- Node.js 16+

## 安装

```bash
# 1. 全局安装 npm 包
npm install -g ecc-auto

# 2. 安装 Claude Code 插件（全局，只需一次）
ecc-auto install

# 3. 配置当前项目
cd your-project
ecc-auto init

# 4. 重启 Claude Code
```

重启后，Claude 会在每次文件编辑后自动运行 `/ecc-auto`。

## 命令说明

### 安装与配置

| 命令 | 说明 |
|---|---|
| `ecc-auto install` | 安装插件到 Claude Code（全局，一次性） |
| `ecc-auto uninstall` | 从 Claude Code 移除插件 |
| `ecc-auto init` | 配置当前项目 |
| `ecc-auto remove` | 移除当前项目的 ecc-auto 配置 |

### 功能开关

```bash
ecc-auto features              # 查看所有功能及其状态
ecc-auto enable  <feature>     # 开启某个功能
ecc-auto disable <feature>     # 关闭某个功能
```

可配置的功能名称：`codeReview`、`securityScan`、`testCoverage`、`buildResolver`、`e2eTests`、`refactorClean`

### 报告查看

| 命令 | 说明 |
|---|---|
| `ecc-auto report` | 查看最近一次 session 的报告 |
| `ecc-auto status` | 查看当前配置与状态 |
| `ecc-auto log` | 查看历史 session 记录 |

## 工作原理

```
Claude 编辑文件
        ↓
PostToolUse Hook 触发（Shell 层）
  → check.js 将变更文件记录到 .ecc/session-current.json
        ↓
Claude 读取 CLAUDE.md 指令：
  "每次 Write/Edit 后立即运行 /ecc-auto"
        ↓
/ecc-auto 命令执行（Claude Code 层）
  → 读取 .ecc/config.json（哪些功能已开启）
  → 读取 .ecc/session-current.json（哪些文件发生了变更）
  → 根据语言调用对应的 ECC reviewer agent
  → 调用 security-reviewer
  → 根据配置调用可选 agent
  → 输出汇总的审查结果
        ↓
Session 结束（Stop Hook）
  → summarize.js 将报告写入 .ecc/reports/
```

## `ecc-auto init` 后的项目结构

```
your-project/
  .ecc/
    config.json              ← 功能配置文件
    reports/                 ← 按 session 保存的报告（已加入 .gitignore）
  .claude/
    commands/
      ecc-auto.md            ← /ecc-auto 质量检测命令
    rules/
      common/                ← ECC 通用代码规范
      typescript/            ← 语言专属规范（如果 ECC 中存在）
  CLAUDE.md                  ← 自动触发指令
```

> **中途新增语言？** 重新运行 `ecc-auto init` 即可 —— 工具会自动检测新语言并将对应的规则安装到 `.claude/rules/`。`/ecc-auto` 命令本身已涵盖所有语言，无需额外更新。

## 配置说明

`.ecc/config.json` 在 `ecc-auto init` 时自动创建，可直接编辑或使用 CLI 命令修改：

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
# 等效的 CLI 命令
ecc-auto enable  e2eTests
ecc-auto disable testCoverage
```

## 支持的语言

| 语言 | 代码审查 Agent | 构建修复 Agent |
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

## 架构说明

ecc-auto 是一个 Claude Code 插件，分为两个层次：

**Shell 层**（通过 Hook 作为操作系统进程运行）：
- 将变更文件记录到 `.ecc/session-current.json`
- Session 结束时写入报告
- 全局注册 —— 对所有运行过 `ecc-auto init` 的项目生效

**Claude Code 层**（运行在 Claude 的对话上下文中）：
- `/ecc-auto` 自定义命令负责编排 ECC agent 调用
- `CLAUDE.md` 指令告知 Claude 在每次编辑后自动运行 `/ecc-auto`
- ECC agents 负责代码审查、安全检测、测试生成和构建修复

```
~/.claude/plugins/ecc-auto/
  agents/ecc-auto.md         ← Agent 定义
  hooks/hooks.json           ← Hook 配置
  scripts/check.js           ← PostToolUse：文件追踪
  scripts/summarize.js       ← Stop：生成 session 报告
```

## 开源协议

MIT License — Copyright (c) 2026 Haisheng Zhang
