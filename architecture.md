# Net Sniffer 项目架构说明

本项目采用 Chrome Extension Manifest v3 架构，利用事件驱动模型实现低功耗、高性能的请求嗅探。

## 🏗 核心组件划分

### 1. Background (Service Worker) - 核心中枢
- **职责**: 负责监听 `chrome.webRequest` 事件，过滤并存储目标请求。
- **逻辑**: 
    - 仅拦截 `status === 200` 的请求。
    - 根据用户设置的关键词（从 `chrome.storage.local` 同步）进行路径匹配。
    - 维护一个内存队列，并在请求完成后写入本地存储。

### 2. Popup - 快捷交互
- **职责**: 提供实时的过滤开关和快速关键词选择。
- **同步**: 通过监听 `input` 和 `change` 事件，将筛选条件实时同步给 Background 脚本。

### 3. Details Page - 数据中心
- **职责**: 全量展示捕获到的请求快照。
- **核心逻辑**: 
    - 动态解析 JSON 响应结构。
    - 提供 Markdown 生成算法，将请求元数据转化为 AI 可读的结构化文档。

### 4. Options Page - 配置中心
- **职责**: 持久化管理「常用关键词」列表。
- **存储**: 使用 `chrome.storage.local` (Key: `netSnifferSearchHistory`) 作为全局配置源。

## 💾 数据流转

1. **用户输入**: `Options` -> `chrome.storage.local`。
2. **流量拦截**: `chrome.webRequest` -> `Background` (基于 Storage 过滤)。
3. **消费展示**: `Details/Popup` <- `chrome.storage.local`。

## 🔒 安全性说明
- 扩展仅请求 `storage` 和 `<all_urls>` 权限。
- 所有数据均存储在本地浏览器中，不经过任何外部服务器。
