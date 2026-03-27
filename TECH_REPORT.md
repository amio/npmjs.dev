# 技术报告：集成 Cloudflare Dynamic Workers 作为执行引擎

## 1. 概述

本报告描述了如何将 Cloudflare 新发布的 [Dynamic Workers](https://developers.cloudflare.com/dynamic-workers/) 集成到我们的 NPM 包浏览器（npmjs.dev）中。Dynamic Workers 允许在运行时动态创建和执行 Worker，为处理不可信代码提供了一个安全、隔离且高性能的沙盒环境。

## 2. 架构设计

集成采用三层架构，以确保前端与沙盒环境的有效通信：

### 2.1 Frontend (React Application)
- **CloudflareExecutorEngine**: 一个新的执行类，实现了标准执行接口。
- **通信机制**: 通过 `fetch` 向后端 Host Worker 发送 POST 请求。

### 2.2 Host Worker (Cloudflare Worker)
- **职责**: 接收用户代码，使用 `env.LOADER.load()` 创建 Dynamic Worker。
- **模块管理**: 将用户代码封装为 `user.js` 模块，并注入一个 `bridge.js` 模块。
- **日志捕获**: 在 `bridge.js` 中拦截 `console` 对象的方法，捕获执行过程中的所有日志，并处理异步返回结果。

### 2.3 Dynamic Worker (Sandbox)
- **隔离环境**: 由 Cloudflare 运行时提供的物理隔离沙盒。
- **安全性**: 默认禁用网络访问（`globalOutbound: null`），防止代码外泄或发起攻击。

## 3. 实现细节

### 3.1 桥接模块 (bridge.js)
为了捕获日志和返回值，我们设计了一个桥接模块：
```javascript
import * as userModule from './user.js';
// ... 拦截 console.log ...
const result = userModule.default || userModule;
// ... 返回 JSON 结果 ...
```

### 3.2 动态加载
Host Worker 使用 `Worker Loader` 绑定：
```javascript
const dynamicWorker = env.LOADER.load({
  compatibilityDate: "2025-01-01",
  mainModule: "bridge.js",
  modules: {
    "bridge.js": bridgeCode,
    "user.js": code
  }
});
```

## 4. 优势分析

- **安全性**: 相比 Browser `iframe`，Cloudflare 提供了更强的内核级隔离。
- **API 支持**: 支持 Node.js 兼容性 API（如 `nodejs_compat`），可以运行更复杂的包。
- **多语言**: 未来可轻松扩展以支持 Python。
- **可观测性**: 原生支持 Tail Workers，可进行大规模日志分析。

## 5. 测试验证

- **单元测试**: 模拟 fetch 调用，验证 `CloudflareExecutorEngine` 的请求构造和响应解析。
- **集成测试**: 编写了后端验证脚本，确保 Host Worker 能正确分发并执行代码。
- **回归测试**: 确保 QuickJS 和 Browser 引擎依然工作正常。

## 6. 结论

集成 Cloudflare Dynamic Workers 为项目带来了服务器端执行的能力，极大地增强了安全性并扩展了支持的 NPM 包范围。该引擎现已作为 UI 中的可选选项。
