import { getQuickJS, QuickJSRuntime, QuickJSContext } from 'quickjs-emscripten';

let runtime: QuickJSRuntime | null = null;
let context: QuickJSContext | null = null;

// Module cache to avoid re-fetching
const moduleCache = new Map<string, string>();

// Simple in-memory module loader
const builtinModules = new Map<string, string>();

// Initialize builtin modules
builtinModules.set('lodash', `
const chunk = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

const uniq = (arr) => [...new Set(arr)];

const sortBy = (arr, key) => {
  if (typeof key === 'string') {
    return arr.sort((a, b) => a[key] - b[key]);
  }
  return arr.sort((a, b) => key(a) - key(b));
};

const groupBy = (arr, key) => {
  return arr.reduce((groups, item) => {
    const groupKey = typeof key === 'string' ? item[key] : key(item);
    groups[groupKey] = groups[groupKey] || [];
    groups[groupKey].push(item);
    return groups;
  }, {});
};

const _ = { chunk, uniq, sortBy, groupBy };
export default _;
export { chunk, uniq, sortBy, groupBy };
`);

builtinModules.set('date-fns', `
const format = (date, formatStr) => {
  // Simple date formatting
  const d = new Date(date);
  return formatStr
    .replace('yyyy', d.getFullYear())
    .replace('MM', String(d.getMonth() + 1).padStart(2, '0'))
    .replace('dd', String(d.getDate()).padStart(2, '0'));
};

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export { format, addDays };
export default { format, addDays };
`);

// Initialize QuickJS with runtime and module loader
async function initQuickJS(): Promise<QuickJSContext> {
  if (!runtime || !context) {
    const QuickJS = await getQuickJS();
    
    // Create runtime with limits
    runtime = QuickJS.newRuntime();
    runtime.setMemoryLimit(1024 * 640); // 640KB should be enough for everyone
    runtime.setMaxStackSize(1024 * 320); // 320KB stack
    
    // Interrupt handler to prevent infinite loops
    let interruptCycles = 0;
    runtime.setInterruptHandler(() => ++interruptCycles > 1024);
    
    // Set up synchronous module loader
    runtime.setModuleLoader((moduleName) => {
      self.postMessage({
        type: 'log',
        level: 'info',
        message: `Module loader called for: ${moduleName}`
      });

      // Check builtin modules first
      if (builtinModules.has(moduleName)) {
        return builtinModules.get(moduleName)!;
      }
      
      // Check cache
      if (moduleCache.has(moduleName)) {
        return moduleCache.get(moduleName)!;
      }
      
      // For relative imports, return error
      if (moduleName.startsWith('./') || moduleName.startsWith('../')) {
        return `throw new Error('Relative imports not supported: ${moduleName}');`;
      }
      
      // Return a basic mock module for unknown packages
      const mockCode = `
console.log('Loading mock module: ${moduleName}');
const mockModule = {
  name: '${moduleName}',
  version: '1.0.0',
  description: 'Mock module for ${moduleName}',
  mock: true
};
export default mockModule;
export const name = '${moduleName}';
export const version = '1.0.0';
      `;
      return mockCode;
    });
    
    // Create context
    context = runtime.newContext();
    
    // Set up console.log and console.error in QuickJS context
    const logHandle = context.newFunction("log", (...args) => {
      const messages: string[] = [];
      for (const arg of args) {
        try {
          const str = context!.dump(arg);
          messages.push(str);
        } catch (e) {
          messages.push('[object]');
        }
        arg.dispose();
      }
      self.postMessage({
        type: 'log',
        level: 'info',
        message: `console.log: ${messages.join(' ')}`
      });
    });
    
    const errorHandle = context.newFunction("error", (...args) => {
      const messages: string[] = [];
      for (const arg of args) {
        try {
          const str = context!.dump(arg);
          messages.push(str);
        } catch (e) {
          messages.push('[object]');
        }
        arg.dispose();
      }
      self.postMessage({
        type: 'log',
        level: 'error',
        message: `console.error: ${messages.join(' ')}`
      });
    });

    const consoleHandle = context.newObject();
    context.setProp(consoleHandle, "log", logHandle);
    context.setProp(consoleHandle, "error", errorHandle);
    context.setProp(context.global, "console", consoleHandle);
    
    // Clean up handles
    logHandle.dispose();
    errorHandle.dispose();
    consoleHandle.dispose();
  }
  return context;
}

// Code execution handler
self.addEventListener('message', async (event) => {
  const { code, packageName } = event.data;
  
  try {
    // Post loading message
    self.postMessage({
      type: 'log',
      level: 'info',
      message: `Initializing QuickJS for package: ${packageName}`
    });

    // Initialize QuickJS context
    const vm = await initQuickJS();

    // Execute the code
    self.postMessage({
      type: 'log',
      level: 'info',
      message: 'Code execution started...'
    });

    // Check if code contains import statements
    const hasImports = /import\s+.*?\s+from\s+['""].*?['""]\s*;?\s*/g.test(code);
    
    let result;
    if (hasImports) {
      self.postMessage({
        type: 'log',
        level: 'info',
        message: 'Executing as ES module...'
      });
      // Evaluate as module
      result = vm.evalCode(code, 'user-code.js', { type: 'module' });
    } else {
      self.postMessage({
        type: 'log',
        level: 'info',
        message: 'Executing as regular script...'
      });
      // Set up the package as a global variable for non-module code
      const mockPackageObj = vm.newObject();
      vm.setProp(mockPackageObj, "name", vm.newString(packageName || 'unknown'));
      vm.setProp(mockPackageObj, "version", vm.newString("1.0.0"));
      vm.setProp(mockPackageObj, "description", vm.newString(`Mock package for ${packageName || 'unknown'}`));
      vm.setProp(mockPackageObj, "author", vm.newString("Demo User"));
      
      // Set the package as a global variable (only if packageName is provided)
      if (packageName) {
        vm.setProp(vm.global, packageName, mockPackageObj);
      }
      mockPackageObj.dispose();
      
      // Evaluate as regular script
      result = vm.evalCode(code);
    }
    
    if (result.error) {
      const errorString = vm.dump(result.error);
      result.error.dispose();
      self.postMessage({
        type: 'log',
        level: 'error',
        message: `Execution error: ${errorString}`
      });
    } else {
      // If there's a result, show it
      if (result.value) {
        const resultStr = vm.dump(result.value);
        if (resultStr && resultStr !== 'undefined') {
          self.postMessage({
            type: 'result',
            message: resultStr
          });
        }
        result.value.dispose();
      }

      self.postMessage({
        type: 'log',
        level: 'info',
        message: 'Code execution completed successfully'
      });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    self.postMessage({
      type: 'log',
      level: 'error',
      message: `Runtime error: ${errorMessage}`
    });
  }
});
