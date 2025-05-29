import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

import JSExecutor from "./components/js-executor";

const root = createRoot(document.getElementById("root")!);

root.render(
  <StrictMode>
    <div className="container">
      <div className="header">
        <h2>NPM Package Fiddler</h2>
      </div>
      <JSExecutor />
    </div>
  </StrictMode>
);
