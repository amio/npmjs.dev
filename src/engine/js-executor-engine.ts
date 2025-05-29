import { QuickJSAsyncWASMModule, newQuickJSAsyncWASMModule } from 'quickjs-emscripten';

export interface LogEntry {
  type: 'log' | 'error' | 'warn' | 'info';
  content: string;
  timestamp: number;
}

export interface ExecutionResult {
  logs: LogEntry[];
  returnValue?: string;
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
      const logs: LogEntry[] = [];

      // Set up console methods capture
      const createConsoleMethod = (type: 'log' | 'error' | 'warn' | 'info') => {
        return vm.newFunction(type, (...args) => {
          const nativeArgs = args.map(arg => vm.dump(arg));
          const content = nativeArgs.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' ');
          
          logs.push({
            type,
            content,
            timestamp: Date.now()
          });
        });
      };

      const consoleLogHandle = createConsoleMethod('log');
      const consoleErrorHandle = createConsoleMethod('error');
      const consoleWarnHandle = createConsoleMethod('warn');
      const consoleInfoHandle = createConsoleMethod('info');
      
      const consoleHandle = vm.newObject();
      vm.setProp(consoleHandle, 'log', consoleLogHandle);
      vm.setProp(consoleHandle, 'error', consoleErrorHandle);
      vm.setProp(consoleHandle, 'warn', consoleWarnHandle);
      vm.setProp(consoleHandle, 'info', consoleInfoHandle);
      vm.setProp(vm.global, 'console', consoleHandle);

      // Execute code
      const result = await vm.evalCodeAsync(code);
      
      // Handle execution result
      if (result.error) {
        const errorData = vm.dump(result.error);
        let errorMessage: string;
        
        // Ensure error is properly formatted as string
        if (typeof errorData === 'string') {
          errorMessage = errorData;
        } else if (typeof errorData === 'object' && errorData !== null) {
          // Construct a complete error message with name, message, and stack
          let errorParts: string[] = [];
          
          // Add error name and message
          if (errorData.name && errorData.message) {
            errorParts.push(`${errorData.name}: ${errorData.message}`);
          } else if (errorData.name) {
            errorParts.push(errorData.name);
          } else if (errorData.message) {
            errorParts.push(errorData.message);
          }
          
          // Add stack trace if available
          if (errorData.stack) {
            errorParts.push(errorData.stack);
          }
          
          if (errorParts.length > 0) {
            errorMessage = errorParts.join('\n');
          } else {
            errorMessage = JSON.stringify(errorData, null, 2);
          }
        } else {
          errorMessage = String(errorData);
        }
        
        // Clean up resources
        this.cleanup([consoleLogHandle, consoleErrorHandle, consoleWarnHandle, consoleInfoHandle, consoleHandle]);
        result.error.dispose();
        vm.dispose();
        
        return {
          logs,
          error: errorMessage
        };
      } else {
        const returnValue = vm.dump(result.value);
        let returnValueString: string | undefined;
        
        if (returnValue !== undefined) {
          returnValueString = typeof returnValue === 'object' 
            ? JSON.stringify(returnValue, null, 2)
            : String(returnValue);
        }
        
        // Clean up resources
        this.cleanup([consoleLogHandle, consoleErrorHandle, consoleWarnHandle, consoleInfoHandle, consoleHandle]);
        result.value.dispose();
        vm.dispose();
        
        return {
          logs,
          returnValue: returnValueString
        };
      }
    } catch (error) {
      return {
        logs: [],
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
