# 部署与配置指南：Cloudflare Dynamic Workers 执行引擎

本指南介绍了如何部署后端 Host Worker 并配置前端，以将 Cloudflare Dynamic Workers 集成到您的生产环境中。

## 1. 部署后端 (Host Worker)

### 1.1 前置条件
- 已安装 [Wrangler](https://developers.cloudflare.com/workers/wrangler/install-setup/)（Cloudflare Workers CLI）。
- 已登录 Cloudflare 账号：`npx wrangler login`。

### 1.2 部署步骤
1. 进入 backend 目录：
   ```bash
   cd cloudflare-backend
   ```
2. 检查 `wrangler.jsonc` 配置文件，确保包含 `worker_loaders` 绑定：
   ```json
   "worker_loaders": [
     {
       "binding": "LOADER"
     }
   ]
   ```
3. 部署 Worker：
   ```bash
   npx wrangler deploy
   ```
4. 部署成功后，记录输出的 URL（例如：`https://dynamic-worker-host.your-subdomain.workers.dev`）。

## 2. 配置前端 (npmjs.dev)

### 2.1 环境变量配置
在前端项目中，您需要将后端的 URL 设置为 API 路径。

1. 修改 `src/engine/cloudflare-executor.ts` 中的 `backendUrl` 或通过环境变量注入。
2. 如果您使用 Vite，可以在 `.env` 文件中设置：
   ```env
   VITE_CLOUDFLARE_BACKEND_URL=https://dynamic-worker-host.your-subdomain.workers.dev
   ```
3. 在 `src/engine/cloudflare-executor.ts` 中读取该变量：
   ```typescript
   private backendUrl = import.meta.env.VITE_CLOUDFLARE_BACKEND_URL || '/api/execute'
   ```

### 2.2 开发环境代理
在本地开发时，可以在 `vite.config.ts` 中配置代理，以避免跨域问题：

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api/execute': {
        target: 'https://dynamic-worker-host.your-subdomain.workers.dev',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/execute/, '')
      }
    }
  }
})
```

## 3. 验证部署

1. 运行前端应用：`npm run dev`。
2. 在执行引擎下拉菜单中选择 "Cloudflare"。
3. 输入一段简单的代码：
   ```javascript
   console.log("Hello from CF");
   export default "Success";
   ```
4. 点击 "Run" 并观察 Output 区域。如果能看到日志和返回值，说明部署成功。

## 4. 注意事项
- **配额与限制**: 请参考 [Cloudflare Dynamic Workers Limits](https://developers.cloudflare.com/dynamic-workers/platform/limits/)。
- **安全性**: 默认情况下，沙盒已禁用网络访问（`globalOutbound: null`）。如果需要网络访问，需在 `wrangler.jsonc` 中配置服务绑定，并在 `src/index.ts` 中传递给 `load()` 方法。
