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

  private async asyncModuleLoader(moduleName: string, context?: any): Promise<string> {
    console.log(333, `Loading module: ${moduleName}`, context);
    try {
      const response = await fetch(`https://esm.sh/${moduleName}`);
      if (!response.ok) {
        throw new Error(`Failed to load module ${moduleName}: ${response.status} ${response.statusText}`);
      }
      const moduleCode = await response.text();
      return moduleCode;
    } catch (error) {
      throw new Error(`Error loading module ${moduleName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private configureRuntime(runtime: any): void {
    // Set runtime limits
    runtime.setMemoryLimit(1024 * 640);
    runtime.setMaxStackSize(1024 * 320);
    
    // Set interrupt handler to prevent infinite loops
    let interruptCycles = 0;
    runtime.setInterruptHandler(() => ++interruptCycles > 1024);
    
    // ESM module loader from esm.sh
    runtime.setModuleLoader(this.asyncModuleLoader.bind(this));
  }

  private setupConsole(vm: any, logs: LogEntry[]): any[] {
    // Set up console methods capture
    const createConsoleMethod = (type: 'log' | 'error' | 'warn' | 'info') => {
      return vm.newFunction(type, (...args: any[]) => {
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

    return [consoleLogHandle, consoleErrorHandle, consoleWarnHandle, consoleInfoHandle, consoleHandle];
  }

  private formatErrorMessage(vm: any, errorHandle: any): string {
    const errorData = vm.dump(errorHandle);
    
    // Ensure error is properly formatted as string
    if (typeof errorData === 'string') {
      return errorData;
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
        return errorParts.join('\n');
      } else {
        return JSON.stringify(errorData, null, 2);
      }
    } else {
      return String(errorData);
    }
  }

  private formatReturnValue(vm: any, valueHandle: any): string | undefined {
    const returnValue = vm.dump(valueHandle);
    
    // If the execution result is undefined, return undefined (no returnValue field)
    if (returnValue === undefined) {
      return undefined;
    }
    
    // For all other values (including null, false, 0, etc.), convert to string
    return typeof returnValue === 'object' && returnValue !== null
      ? JSON.stringify(returnValue, null, 2)
      : String(returnValue);
  }

  async execute(code: string): Promise<ExecutionResult> {
    if (!this.quickJSModule || !this.isInitialized) {
      throw new Error('Execution engine is not initialized yet');
    }

    try {
      const runtime = this.quickJSModule.newRuntime();
      this.configureRuntime(runtime);

      const vm = runtime.newContext();
      const logs: LogEntry[] = [];
      const consoleHandles = this.setupConsole(vm, logs);

      // Execute code
      const result = await vm.evalCodeAsync(code);
      
      // Handle execution result
      if (result.error) {
        const errorMessage = this.formatErrorMessage(vm, result.error);
        
        // Clean up resources
        this.cleanup(consoleHandles);
        result.error.dispose();
        vm.dispose();
        
        return {
          logs,
          error: errorMessage
        };
      } else {
        const returnValueString = this.formatReturnValue(vm, result.value);
        
        // Clean up resources
        this.cleanup(consoleHandles);
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
