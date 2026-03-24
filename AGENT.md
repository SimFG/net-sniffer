# Agent Development Guide

本项目作为 AI 辅助开发的嗅探工具，其自身开发流程也遵循高度自动化的规范。

## 🛠 技术栈

- **运行时 (Runtime)**: [Bun](https://bun.sh/) (1.0.0+)
- **包管理器**: Bun (严格禁止使用 npm/pnpm)
- **扩展规范**: Chrome Extension Manifest v3
- **前端技术**: Vanilla JS, CSS3, HTML5
- **进程管理**: PM2 + Makefile

## 📦 打包与管理指令

所有服务管理与构建操作均通过 `Makefile` 实现：

- `make install`: 安装 Bun 依赖环境。
- `make dev`: 启动开发调试模式（结合 PM2 运行 `dev-server.js`）。
- `make stop`: 停止开发服务。
- `make logs`: 查看 PM2 实时日志。
- `make package`: 将项目打包为可以直接发布的插件 zip 包（剔除开发相关文件）。

## 🔗 架构说明

关于项目内部组件间的通信逻辑、存储结构及详细模块划分，请参考：
- [项目架构文档](./architecture.md)
