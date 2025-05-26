import { 
  SandpackProvider, 
  SandpackLayout, 
  SandpackCodeEditor, 
  SandpackConsole,
  SandpackPreview
} from "@codesandbox/sandpack-react";

interface CustomSetup {
  dependencies: {
    [key: string]: string;
  };
}

const customSetup: CustomSetup = {
  dependencies: {
    "moo": "latest"
  },
};

interface Files {
  [key: string]: string;
}

const files: Files = {
  "add.ts": `export function add(a: number, b: number): number {
  return a + b;
}`,
}

const App = () => (
  <SandpackProvider template="node" files={files} customSetup={customSetup}>
    <SandpackLayout>
      <SandpackCodeEditor />
      <SandpackPreview />
      <SandpackConsole />
      {/* <SandpackTests /> */}
    </SandpackLayout>
  </SandpackProvider>
);

export default App;
