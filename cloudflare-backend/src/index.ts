import { WorkerEntrypoint } from "cloudflare:workers";

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      const { code } = await request.json();
      if (!code) {
        return new Response(JSON.stringify({ error: "Code is required" }), { status: 400 });
      }

      // Implementation using bridge module to capture logs and return result
      const bridgeCode = `
        import * as userModule from './user.js';

        export default {
          async fetch(request, env, ctx) {
            const logs = [];

            // Capture console output
            const capture = (type) => (...args) => {
              logs.push({
                type,
                content: args.map(arg =>
                  typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                ).join(' '),
                timestamp: Date.now()
              });
            };

            globalThis.console.log = capture('log');
            globalThis.console.error = capture('error');
            globalThis.console.warn = capture('warn');
            globalThis.console.info = capture('info');

            try {
              // The user code is imported as a module.
              // We check if it has a default export, or use the entire module.
              const result = userModule.default !== undefined ? userModule.default : userModule;

              // If it's a function, we might want to call it?
              // But for the current playground, we just return the exported value.

              return new Response(JSON.stringify({
                logs,
                returnValue: result !== undefined ?
                  (typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)) :
                  undefined
              }), {
                headers: { "Content-Type": "application/json" }
              });
            } catch (err) {
              return new Response(JSON.stringify({
                logs,
                error: err.stack || err.message || String(err)
              }), {
                headers: { "Content-Type": "application/json" }
              });
            }
          }
        };
      `;

      const dynamicWorker = env.LOADER.load({
        compatibilityDate: "2025-01-01",
        mainModule: "bridge.js",
        modules: {
          "bridge.js": bridgeCode,
          "user.js": code
        },
        globalOutbound: env.OUTBOUND || null,
      });

      return await dynamicWorker.getEntrypoint().fetch(request);
    } catch (err) {
      return new Response(JSON.stringify({
        error: "Host execution error: " + (err.stack || err.message || String(err))
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};
