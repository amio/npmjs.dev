import { QuickJSAsyncWASMModule, newQuickJSAsyncWASMModule } from 'quickjs-emscripten';

export interface ExecutionResult {
  output: string;
  error?: string;
}

export class JSExecutorEngine {
  private quickJSModule: QuickJSAsyncWASMModule | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      this.quickJSModule = await newQuickJSAsyncWASMModule();
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`QuickJS initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async execute(code: string): Promise<ExecutionResult> {
    if (!this.quickJSModule || !this.isInitialized) {
      throw new Error('Execution engine is not initialized yet');
    }

    try {
      const runtime = this.quickJSModule.newRuntime();
      
      // Set runtime limits
      runtime.setMemoryLimit(1024 * 640);
      runtime.setMaxStackSize(1024 * 320);
      
      // Set interrupt handler to prevent infinite loops
      let interruptCycles = 0;
      runtime.setInterruptHandler(() => ++interruptCycles > 1024);
      
      // Simple module loader
      runtime.setModuleLoader(async (moduleName) => `export default 'module-${moduleName}'`);

      const vm = runtime.newContext();
      const logs: string[] = [];

      // Set up console.log capture
      const consoleLogHandle = vm.newFunction('log', (...args) => {
        const nativeArgs = args.map(arg => vm.dump(arg));
        logs.push(nativeArgs.join(' '));
      });
      
      const consoleHandle = vm.newObject();
      vm.setProp(consoleHandle, 'log', consoleLogHandle);
      vm.setProp(vm.global, 'console', consoleHandle);

      // Execute code
      const result = await vm.evalCodeAsync(code);
      
      let output = '';
      
      // Add console.log output
      if (logs.length > 0) {
        output += '=== Console Output ===\n';
        output += logs.join('\n') + '\n\n';
      }

      // Handle execution result
      if (result.error) {
        const errorMessage = vm.dump(result.error);
        
        // Clean up resources
        this.cleanup([consoleLogHandle, consoleHandle]);
        result.error.dispose();
        vm.dispose();
        
        return {
          output: output || '',
          error: errorMessage
        };
      } else {
        const returnValue = vm.dump(result.value);
        if (returnValue !== undefined) {
          output += '=== Return Value ===\n';
          output += typeof returnValue === 'object' 
            ? JSON.stringify(returnValue, null, 2)
            : String(returnValue);
        }
        
        // Clean up resources
        this.cleanup([consoleLogHandle, consoleHandle]);
        result.value.dispose();
        vm.dispose();
        
        return {
          output: output || 'Code executed successfully, no output'
        };
      }
    } catch (error) {
      return {
        output: '',
        error: `Execution error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private cleanup(handles: any[]): void {
    handles.forEach(handle => {
      try {
        handle?.dispose?.();
      } catch (e) {
        // Ignore cleanup errors
      }
    });
  }

  isReady(): boolean {
    return this.isInitialized && this.quickJSModule !== null;
  }

  dispose(): void {
    // QuickJS WASM module cleanup is automatic
    this.quickJSModule = null;
    this.isInitialized = false;
  }
}
