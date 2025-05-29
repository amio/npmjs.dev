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
      throw new Error(`QuickJS 初始化失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async execute(code: string): Promise<ExecutionResult> {
    if (!this.quickJSModule || !this.isInitialized) {
      throw new Error('执行引擎尚未初始化');
    }

    try {
      const runtime = this.quickJSModule.newRuntime();
      
      // 设置运行时限制
      runtime.setMemoryLimit(1024 * 640);
      runtime.setMaxStackSize(1024 * 320);
      
      // 设置中断处理器防止无限循环
      let interruptCycles = 0;
      runtime.setInterruptHandler(() => ++interruptCycles > 1024);
      
      // 简单的模块加载器
      runtime.setModuleLoader(async (moduleName) => `export default 'module-${moduleName}'`);

      const vm = runtime.newContext();
      const logs: string[] = [];

      // 设置 console.log 捕获
      const consoleLogHandle = vm.newFunction('log', (...args) => {
        const nativeArgs = args.map(arg => vm.dump(arg));
        logs.push(nativeArgs.join(' '));
      });
      
      const consoleHandle = vm.newObject();
      vm.setProp(consoleHandle, 'log', consoleLogHandle);
      vm.setProp(vm.global, 'console', consoleHandle);

      // 执行代码
      const result = await vm.evalCodeAsync(code);
      
      let output = '';
      
      // 添加 console.log 输出
      if (logs.length > 0) {
        output += '=== Console 输出 ===\n';
        output += logs.join('\n') + '\n\n';
      }

      // 处理执行结果
      if (result.error) {
        const errorMessage = vm.dump(result.error);
        
        // 清理资源
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
          output += '=== 返回值 ===\n';
          output += typeof returnValue === 'object' 
            ? JSON.stringify(returnValue, null, 2)
            : String(returnValue);
        }
        
        // 清理资源
        this.cleanup([consoleLogHandle, consoleHandle]);
        result.value.dispose();
        vm.dispose();
        
        return {
          output: output || '代码执行完成，无输出'
        };
      }
    } catch (error) {
      return {
        output: '',
        error: `执行错误: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private cleanup(handles: any[]): void {
    handles.forEach(handle => {
      try {
        handle?.dispose?.();
      } catch (e) {
        // 忽略清理错误
      }
    });
  }

  isReady(): boolean {
    return this.isInitialized && this.quickJSModule !== null;
  }

  dispose(): void {
    // QuickJS WASM 模块的清理是自动的
    this.quickJSModule = null;
    this.isInitialized = false;
  }
}
