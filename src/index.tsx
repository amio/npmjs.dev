import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import JSExecutor from "./js-executor";

const root = createRoot(document.getElementById("root")!);
root.render(
  <StrictMode>
      <div className="header">
        <h2>JavaScript 代码执行器</h2>
        <p>基于 QuickJS-Emscripten 的在线 JavaScript 执行环境</p>
      </div>
    <JSExecutor />
  </StrictMode>
);
