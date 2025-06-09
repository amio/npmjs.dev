# GitHub Copilot Instructions for npmjs.dev

## Project Overview

**npmjs.dev** is a browser-based JavaScript playground that allows users to explore and experiment with npm packages directly in their browser. It provides an interactive environment where developers can:

- Run JavaScript code with npm dependencies without local setup
- View package documentation and examples
- Test code snippets in real-time

## Architecture

### Tech Stack
- **Frontend**: React 19+ with TypeScript
- **Build Tool**: Vite with React plugin
- **Execution Engines**:
  - QuickJS (WASM) for lightweight JavaScript execution
  - WebContainer for full Node.js environment with npm support
- **Code Editor**: CodeMirror with JavaScript syntax highlighting
- **Styling**: CSS with custom properties
- **Deployment**: Vercel with SPA routing

### Key Components

1. **App Component** (`src/components/app.tsx`)
   - Main application orchestrator
   - Handles URL-based package routing
   - Manages execution state and code examples

2. **Code Editor** (`src/components/code-editor.tsx`)
   - CodeMirror-based editor with JavaScript syntax highlighting
   - Real-time code editing and execution triggers

3. **Output Component** (`src/components/output.tsx`)
   - Displays execution results, logs, and errors
   - Handles loading states and error formatting

4. **Execution Engines** (`src/engine/`)
   - **QuickJS Executor**: Fast, lightweight JavaScript execution
   - **WebContainer Executor**: Full Node.js environment with npm support
   - Abstracted execution interface for switching between engines

5. **Services** (`src/services/`)
   - WebContainer service integration
   - Package management and installation

## Development Guidelines

### Code Style & Patterns

1. **TypeScript First**
   ```typescript
   // Use explicit types for props and state
   interface ComponentProps {
     packageName: string
     onExecute: (code: string) => Promise<void>
   }

   // Use proper async/await patterns
   const executeCode = async (code: string): Promise<ExecutionResult> => {
     try {
       return await executor.execute(code)
     } catch (error) {
       throw new Error(`Execution failed: ${error.message}`)
     }
   }
   ```

2. **React Patterns**
   ```typescript
   // Use functional components with hooks
   const MyComponent: React.FC<Props> = ({ prop1, prop2 }) => {
     const [state, setState] = useState<StateType>(initialState)

     // Use useCallback for expensive operations
     const handleExecute = useCallback(async () => {
       // Implementation
     }, [dependencies])

     return <div>{/* JSX */}</div>
   }
   ```

3. **Error Handling**
   ```typescript
   // Always handle async errors properly
   try {
     const result = await riskyOperation()
     setResult(result)
   } catch (error) {
     setError(error instanceof Error ? error.message : String(error))
   } finally {
     setLoading(false)
   }
   ```

### File Organization

```
src/
├── components/          # React components
│   ├── app.tsx         # Main app component
│   ├── code-editor.tsx # Code editing interface
│   ├── output.tsx      # Execution results display
│   └── ui-elements.tsx # Reusable UI components
├── engine/             # JavaScript execution engines
│   ├── quickjs-executor.ts    # QuickJS WASM engine
│   ├── webcontainer-executor.ts # WebContainer engine
│   └── utils.ts        # Shared utilities
├── services/           # External service integrations
└── index.tsx          # Application entry point
```

### Naming Conventions

- **Components**: PascalCase (`CodeEditor`, `OutputPanel`)
- **Files**: kebab-case (`code-editor.tsx`, `webcontainer-service.ts`)
- **Functions**: camelCase (`executeCode`, `parsePackageName`)
- **Constants**: SCREAMING_SNAKE_CASE (`DEFAULT_TIMEOUT`, `MAX_RETRIES`)
- **Types/Interfaces**: PascalCase (`ExecutionResult`, `LogEntry`)

### Commenting Guidelines

- Use JSDoc for public APIs and complex functions
  ```typescript
  /**
   * Executes the provided JavaScript code.
   * @param code - The JavaScript code to execute.
   * @returns A promise that resolves with the execution result.
   */
  const executeCode = async (code: string): Promise<ExecutionResult> => {
    // Implementation
  }
  ```

- Use English in comments

### CSS & Styling

1. **CSS Custom Properties** for theming
   ```css
   :root {
     --primary-color: #007acc;
     --background-color: #1e1e1e;
     --text-color: #d4d4d4;
   }
   ```

### Package Management

1. **URL-based package routing**
   ```typescript
   // Support URLs like: /lodash, /@babel/core, /react@18.0.0
   const getPackageFromUrl = (url: string) => {
     const pathParts = new URL(url).pathname.split('/').filter(Boolean)

     if (pathParts[0]?.startsWith('@') && pathParts.length > 1) {
       return `${pathParts[0]}/${pathParts[1]}` // Scoped package
     }

     return pathParts[0] || 'lodash' // Default package
   }
   ```

2. **Dynamic code generation**
   ```typescript
   // Generate example code based on package name
   const generateExampleCode = (packageName: string) => {
     const variableName = packageName
       .replace(/[@\/\-\.]/g, '_')
       .replace(/^[0-9]/, '_$&')

     return `import ${variableName} from '${packageName}'`
   }
   ```

### Testing Guidelines

1. **Unit Tests** for utilities and pure functions
   ```typescript
   // Use Node.js built-in test runner
   import { test, describe } from 'node:test'
   import assert from 'node:assert'

   describe('Package URL parsing', () => {
     test('should parse scoped packages', () => {
       const result = getPackageFromUrl('/@babel/core')
       assert.strictEqual(result, '@babel/core')
     })
   })
   ```

2. **Component Testing** for React components
   ```typescript
   // Test user interactions and state changes
   test('should execute code when button is clicked', async () => {
     // Setup component with mocked executor
     // Simulate user input and button click
     // Assert expected behavior
   })
   ```

## Resources

When in doubt, refer to the following resources for latest documentation and best practices:
- [QuickJS Documentation](https://github.com/justjake/quickjs-emscripten)
- [WebContainer API](https://webcontainers.io/api)
- [React 19 Documentation](https://react.dev/)
- [Vite Configuration](https://vitejs.dev/config/)
