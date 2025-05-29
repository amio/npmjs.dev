import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import JSExecutor from "./js-runner";

const root = createRoot(document.getElementById("root")!);
root.render(
  <StrictMode>
    <JSExecutor />
  </StrictMode>
);
