import { ExecutionResult, ExecutionStatusCallback } from './types'
import { addCodeDependenciesToImportMap, addSpecifierToImportMap, stringifyImportMap } from './module-resolution'

export class BrowserExecutorEngine {
  private iframe: HTMLIFrameElement | null = null
  private isInitialized = false
  private packageImportMap: Record<string, string> = {}
  private importMapSnapshot = stringifyImportMap({})

  /**
   * Add a package to the import map
   * @param packageName - The package name (e.g., 'lodash', '@babel/core')
   * @param version - Optional version (defaults to latest)
   */
  addPackage(packageName: string, version?: string): void {
    if (addSpecifierToImportMap(this.packageImportMap, packageName, version)) {
      this.importMapSnapshot = this.generateImportMap()
    }
  }

  /**
   * Generate import map JSON for the iframe
   */
  private generateImportMap(): string {
    return stringifyImportMap(this.packageImportMap)
  }

  /**
   * Parse import statements from code and automatically add packages to import map
   * @param code - The code to analyze
   */
  private parseAndAddImports(code: string): void {
    addCodeDependenciesToImportMap(this.packageImportMap, code)
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
                parent.postMessage({ type: 'execution-status', message: 'Creating browser module...' }, '*');

                // Create a blob URL for the module
                const blob = new Blob([code], { type: 'application/javascript' });
                const moduleUrl = URL.createObjectURL(blob);

                try {
                  // Import the module
                  parent.postMessage({ type: 'execution-status', message: 'Loading and building npm modules...' }, '*');
                  const module = await import(moduleUrl);
                  parent.postMessage({ type: 'execution-status', message: 'Collecting execution result...' }, '*');

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
      throw new Error(
        `Browser executor initialization failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  async execute(code: string, onStatus?: ExecutionStatusCallback): Promise<ExecutionResult> {
    try {
      const previousImportMapSnapshot = this.importMapSnapshot

      // Parse imports and update import map
      onStatus?.('Resolving npm imports...')
      this.parseAndAddImports(code)
      this.importMapSnapshot = this.generateImportMap()

      // Reinitialize iframe with updated import map if new packages were added
      if (!this.isInitialized || this.importMapSnapshot !== previousImportMapSnapshot) {
        onStatus?.('Preparing browser sandbox...')
        await this.reinitializeIframe()
      }

      if (!this.iframe || !this.isInitialized) {
        throw new Error('Browser executor is not initialized yet')
      }

      // Use postMessage to communicate with iframe
      return new Promise<ExecutionResult>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          window.removeEventListener('message', handleMessage)
          reject(new Error('Execution timeout'))
        }, 30000)

        const handleMessage = (event: MessageEvent) => {
          if (!event.data) {
            return
          }

          if (event.data.type === 'execution-status') {
            onStatus?.(event.data.message)
            return
          }

          if (event.data.type !== 'execution-result') {
            return
          }

          clearTimeout(timeoutId)
          window.removeEventListener('message', handleMessage)
          resolve({
            logs: event.data.result.logs || [],
            returnValue: event.data.result.returnValue,
            error: event.data.result.error,
          })
        }

        window.addEventListener('message', handleMessage)

        // Send execution request
        this.iframe!.contentWindow?.postMessage(
          {
            type: 'execute-code',
            code: code,
          },
          '*'
        )
      })
    } catch (error) {
      return {
        logs: [],
        error: `Browser execution error: ${error instanceof Error ? error.message : String(error)}`,
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
    this.importMapSnapshot = this.generateImportMap()
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
    this.importMapSnapshot = this.generateImportMap()
  }
}
