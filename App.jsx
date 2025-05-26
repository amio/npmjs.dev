import { 
  SandpackProvider, 
  SandpackLayout, 
  SandpackCodeEditor, 
  SandpackTests, 
  SandpackConsole,
  SandpackPreview,
  Sandpack
} from "@codesandbox/sandpack-react";

const customSetup = {
  dependencies: {
    "moo": "latest"
  },
};

const files = {
  "add.ts": `export function add(a, b) {
  return a + b;
}`,
}

export default () => (
  <SandpackProvider template="node" files={files} customSetup={customSetup}>
    <SandpackLayout>
      <SandpackCodeEditor />
      <SandpackPreview />
      <SandpackConsole />
      {/* <SandpackTests /> */}
    </SandpackLayout>
  </SandpackProvider>
);
