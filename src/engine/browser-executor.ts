import { ExecutionResult } from './types'

export class BrowserExecutorEngine {
  private iframe: HTMLIFrameElement | null = null
  private isInitialized = false
  private packageImportMap: Record<string, string> = {}

  /**
   * Add a package to the import map
   * @param packageName - The package name (e.g., 'lodash', '@babel/core')
   * @param version - Optional version (defaults to latest)
   */
  addPackage(packageName: string, version?: string): void {
    const versionSuffix = version ? `@${version}` : ''
    this.packageImportMap[packageName] = `https://esm.sh/${packageName}${versionSuffix}`
    
    // Add support for submodules (e.g., 'lodash/debounce')
    if (!packageName.endsWith('/')) {
      this.packageImportMap[`${packageName}/`] = `https://esm.sh/${packageName}${versionSuffix}/`
    }
  }

  /**
   * Generate import map JSON for the iframe
   */
  private generateImportMap(): string {
    const importMap = {
      imports: {
        ...this.packageImportMap
      }
    }
    
    return JSON.stringify(importMap, null, 2)
  }

  /**
   * Parse import statements from code and automatically add packages to import map
   * @param code - The code to analyze
   */
  private parseAndAddImports(code: string): void {
    // Match import statements: import ... from 'package-name'
    const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"];?/g
    let match

    while ((match = importRegex.exec(code)) !== null) {
      const packageName = match[1]
      
      // Skip relative imports and URLs
      if (packageName.startsWith('./') || packageName.startsWith('../') || packageName.startsWith('http')) {
        continue
      }

      // Extract base package name (handle scoped packages and submodules)
      let basePackage = packageName
      if (packageName.startsWith('@')) {
        // Scoped package: @scope/package or @scope/package/submodule
        const parts = packageName.split('/')
        if (parts.length >= 2) {
          basePackage = `${parts[0]}/${parts[1]}`
        }
      } else {
        // Regular package: package or package/submodule
        basePackage = packageName.split('/')[0]
      }

      // Add the full import path to the import map
      if (!this.packageImportMap[packageName]) {
        this.packageImportMap[packageName] = `https://esm.sh/${packageName}`
      }

      // Also add the base package if different
      if (basePackage !== packageName && !this.packageImportMap[basePackage]) {
        this.packageImportMap[basePackage] = `https://esm.sh/${basePackage}`
        this.packageImportMap[`${basePackage}/`] = `https://esm.sh/${basePackage}/`
      }
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // Create sandbox iframe with inline content to avoid cross-origin issues
      this.iframe = document.createElement('iframe')
      this.iframe.style.display = 'none'
      this.iframe.setAttribute('sandbox', 'allow-scripts')
      
      // Use srcdoc to avoid cross-origin issues
      const iframeDocument = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Browser Executor</title>
          <script type="importmap">
            ${this.generateImportMap()}
          </script>
        </head>
        <body>
          <script type="module">
            // Store console messages and errors
            window.executionLogs = [];
            window.executionError = null;
            window.executionResult = undefined;

            // Override console methods to capture output
            const originalConsole = {
              log: console.log,
              error: console.error,
              warn: console.warn,
              info: console.info
            };

            function createConsoleMethod(type) {
              return function(...args) {
                const content = args
                  .map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg))
                  .join(' ');
                
                window.executionLogs.push({
                  type: type,
                  content: content,
                  timestamp: Date.now()
                });

                // Still call original console method
                originalConsole[type].apply(console, args);
              };
            }

            console.log = createConsoleMethod('log');
            console.error = createConsoleMethod('error');
            console.warn = createConsoleMethod('warn');
            console.info = createConsoleMethod('info');

            // Handle uncaught errors
            window.addEventListener('error', function(event) {
              window.executionError = event.error ? event.error.toString() : event.message;
            });

            // Handle unhandled promise rejections
            window.addEventListener('unhandledrejection', function(event) {
              window.executionError = event.reason ? String(event.reason) : 'Unhandled promise rejection';
            });

            // Function to execute code as module
            window.executeCode = async function(code) {
              try {
                // Reset state
                window.executionLogs = [];
                window.executionError = null;
                window.executionResult = undefined;

                // Create a blob URL for the module
                const blob = new Blob([code], { type: 'application/javascript' });
                const moduleUrl = URL.createObjectURL(blob);
                
                try {
                  // Import the module
                  const module = await import(moduleUrl);
                  
                  // Store the default export or the entire module as result
                  window.executionResult = module.default !== undefined ? module.default : module;
                  
                  return {
                    logs: window.executionLogs,
                    returnValue: window.executionResult !== undefined ? 
                      (typeof window.executionResult === 'object' ? JSON.stringify(window.executionResult, null, 2) : String(window.executionResult)) : 
                      undefined,
                    error: window.executionError
                  };
                } finally {
                  // Clean up the blob URL
                  URL.revokeObjectURL(moduleUrl);
                }
              } catch (error) {
                return {
                  logs: window.executionLogs,
                  error: error.toString()
                };
              }
            };

            // Post message to parent when ready
            window.addEventListener('load', function() {
              parent.postMessage({ type: 'iframe-ready' }, '*');
            });

            // Listen for execution requests
            window.addEventListener('message', async function(event) {
              if (event.data && event.data.type === 'execute-code') {
                const result = await window.executeCode(event.data.code);
                parent.postMessage({ type: 'execution-result', result: result }, '*');
              }
            });
          </script>
        </body>
        </html>
      `
      
      this.iframe.srcdoc = iframeDocument
      document.body.appendChild(this.iframe)

      // Wait for iframe to be ready
      await new Promise<void>((resolve, reject) => {
        if (!this.iframe) {
          reject(new Error('Iframe not created'))
          return
        }

        const handleMessage = (event: MessageEvent) => {
          if (event.data && event.data.type === 'iframe-ready') {
            window.removeEventListener('message', handleMessage)
            resolve()
          }
        }

        window.addEventListener('message', handleMessage)
        
        // Fallback timeout
        setTimeout(() => {
          window.removeEventListener('message', handleMessage)
          resolve()
        }, 3000)
      })

      this.isInitialized = true
    } catch (error) {
      throw new Error(`Browser executor initialization failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async execute(code: string): Promise<ExecutionResult> {
    try {
      // Parse imports and update import map
      this.parseAndAddImports(code)
      
      // Reinitialize iframe with updated import map if new packages were added
      if (!this.isInitialized || Object.keys(this.packageImportMap).length > 0) {
        await this.reinitializeIframe()
      }

      if (!this.iframe || !this.isInitialized) {
        throw new Error('Browser executor is not initialized yet')
      }

      // Use postMessage to communicate with iframe
      return new Promise<ExecutionResult>((resolve, reject) => {
        const handleMessage = (event: MessageEvent) => {
          if (event.data && event.data.type === 'execution-result') {
            window.removeEventListener('message', handleMessage)
            resolve({
              logs: event.data.result.logs || [],
              returnValue: event.data.result.returnValue,
              error: event.data.result.error
            })
          }
        }

        window.addEventListener('message', handleMessage)

        // Send execution request
        this.iframe!.contentWindow?.postMessage({
          type: 'execute-code',
          code: code
        }, '*')

        // Timeout after 30 seconds
        setTimeout(() => {
          window.removeEventListener('message', handleMessage)
          reject(new Error('Execution timeout'))
        }, 30000)
      })
    } catch (error) {
      return {
        logs: [],
        error: `Browser execution error: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }

  /**
   * Reinitialize the iframe with updated import map
   */
  private async reinitializeIframe(): Promise<void> {
    // Dispose existing iframe
    if (this.iframe && this.iframe.parentNode) {
      this.iframe.parentNode.removeChild(this.iframe)
    }
    
    this.iframe = null
    this.isInitialized = false
    
    // Initialize with new import map
    await this.initialize()
  }

  /**
   * Set packages from URL-based package routing
   * @param packages - Array of package names from URL routing
   */
  setPackagesFromUrl(packages: string[]): void {
    packages.forEach(packageName => {
      this.addPackage(packageName)
    })
  }

  /**
   * Clear all packages from import map
   */
  clearPackages(): void {
    this.packageImportMap = {}
  }

  isReady(): boolean {
    return this.isInitialized && this.iframe !== null
  }

  dispose(): void {
    if (this.iframe && this.iframe.parentNode) {
      this.iframe.parentNode.removeChild(this.iframe)
    }
    this.iframe = null
    this.isInitialized = false
  }
}
