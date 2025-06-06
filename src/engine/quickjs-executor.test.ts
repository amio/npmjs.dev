import assert from 'node:assert'
import { test, describe, beforeEach, afterEach } from 'node:test'
import { JSExecutorEngine } from './quickjs-executor'

describe('JSExecutorEngine', () => {
  let engine: JSExecutorEngine

  beforeEach(async () => {
    engine = new JSExecutorEngine()
    await engine.initialize()
  })

  afterEach(() => {
    engine.dispose()
  })

  describe('Initialization and State Management', () => {
    test('should initialize successfully', async () => {
      const newEngine = new JSExecutorEngine()
      await newEngine.initialize()
      assert.strictEqual(newEngine.isReady(), true)
      newEngine.dispose()
    })

    test('should handle multiple initialize calls', async () => {
      const newEngine = new JSExecutorEngine()
      await newEngine.initialize()
      await newEngine.initialize() // Should not throw
      assert.strictEqual(newEngine.isReady(), true)
      newEngine.dispose()
    })

    test('should reject execution before initialization', async () => {
      const uninitializedEngine = new JSExecutorEngine()
      await assert.rejects(
        () => uninitializedEngine.execute('console.log("test")'),
        /Execution engine is not initialized yet/
      )
    })

    test('should handle dispose and reinitialize cycle', async () => {
      const newEngine = new JSExecutorEngine()
      await newEngine.initialize()

      newEngine.dispose()
      assert.strictEqual(newEngine.isReady(), false)

      await assert.rejects(() => newEngine.execute('1 + 1'), /Execution engine is not initialized yet/)

      await newEngine.initialize()
      assert.strictEqual(newEngine.isReady(), true)
      const result = await newEngine.execute('3 + 3')
      assert.strictEqual(result.returnValue, '6')

      newEngine.dispose()
    })
  })

  describe('JavaScript Execution', () => {
    test('should execute basic expressions', async () => {
      const result = await engine.execute('1 + 1')
      assert.strictEqual(result.error, undefined)
      assert.strictEqual(result.returnValue, '2')
    })

    test('should handle string operations', async () => {
      const result = await engine.execute('"hello" + " " + "world"')
      assert.strictEqual(result.returnValue, 'hello world')
    })

    test('should execute function declarations and calls', async () => {
      const result = await engine.execute(`
        function add(a, b) { return a + b; }
        add(5, 3);
      `)
      assert.strictEqual(result.returnValue, '8')
    })

    test('should handle variable declarations', async () => {
      const result = await engine.execute(`
        const x = 10;
        const y = 20;
        x * y;
      `)
      assert.strictEqual(result.returnValue, '200')
    })

    test('should execute loops and control flow', async () => {
      const result = await engine.execute(`
        let sum = 0;
        for (let i = 1; i <= 5; i++) {
          sum += i;
        }
        sum;
      `)
      assert.strictEqual(result.returnValue, '15')
    })

    test('should handle closures', async () => {
      const result = await engine.execute(`
        function createCounter() {
          let count = 0;
          return function() { return ++count; };
        }
        const counter = createCounter();
        counter() + counter();
      `)
      assert.strictEqual(result.returnValue, '3')
    })

    test('should support array methods and functional programming', async () => {
      const result = await engine.execute(`
        [1, 2, 3, 4, 5]
          .filter(x => x % 2 === 0)
          .map(x => x * 2)
          .reduce((a, b) => a + b, 0);
      `)
      assert.strictEqual(result.returnValue, '12')
    })

    test('should handle JSON operations', async () => {
      const result = await engine.execute(`
        const obj = {name: "test", value: 123};
        const json = JSON.stringify(obj);
        const parsed = JSON.parse(json);
        parsed.value;
      `)
      assert.strictEqual(result.returnValue, '123')
    })

    test('should support async function syntax', async () => {
      const result = await engine.execute(`
        async function test() { return 42; }
        typeof test;
      `)
      assert.strictEqual(result.returnValue, 'function')
    })
  })

  describe('Console Logging', () => {
    test('should handle basic console.log', async () => {
      const result = await engine.execute('console.log("Hello, World!")')
      assert.strictEqual(result.error, undefined)
      assert.strictEqual(result.logs.length, 1)
      assert.strictEqual(result.logs[0].type, 'log')
      assert.strictEqual(result.logs[0].content, 'Hello, World!')
      assert.ok(result.logs[0].timestamp > 0)
    })

    test('should support multiple console methods', async () => {
      const result = await engine.execute(`
        console.log("Log message");
        console.error("Error message");
        console.warn("Warning message");
        console.info("Info message");
      `)
      assert.strictEqual(result.logs.length, 4)
      assert.strictEqual(result.logs[0].type, 'log')
      assert.strictEqual(result.logs[1].type, 'error')
      assert.strictEqual(result.logs[2].type, 'warn')
      assert.strictEqual(result.logs[3].type, 'info')
    })

    test('should handle multiple arguments', async () => {
      const result = await engine.execute('console.log("Number:", 42, "Boolean:", true)')
      assert.strictEqual(result.logs[0].content, 'Number: 42 Boolean: true')
    })

    test('should log objects', async () => {
      const result = await engine.execute('console.log({name: "test", value: 123})')
      assert.ok(result.logs[0].content.includes('"name": "test"'))
      assert.ok(result.logs[0].content.includes('"value": 123'))
    })

    test('should log arrays', async () => {
      const result = await engine.execute('console.log([1, 2, 3, "test"])')
      assert.ok(result.logs[0].content.includes('1'))
      assert.ok(result.logs[0].content.includes('test'))
    })

    test('should handle circular references', async () => {
      const result = await engine.execute(`
        const obj = {};
        obj.self = obj;
        try {
          console.log(obj);
        } catch (e) {
          console.log("Circular reference handled");
        }
      `)
      assert.strictEqual(result.logs.length, 1)
      assert.ok(result.logs[0].content.length > 0)
    })

    test('should handle import statements with console output', async () => {
      const result = await engine.execute(`
        import moo from 'moo';
        console.log("This is a log");
        const parser = moo.compile({word: /[a-z]+/});
        const result = parser.reset("hello world").next().value;
        123;
      `)
      assert.strictEqual(result.logs.length, 1)
      assert.strictEqual(result.logs[0].content, 'This is a log')
    })
  })

  describe('Error Handling', () => {
    test('should handle syntax errors', async () => {
      const result = await engine.execute('const x = ;')
      assert.ok(result.error)
      assert.ok(result.error!.includes('SyntaxError') || result.error!.includes('syntax'))
    })

    test('should handle runtime errors', async () => {
      const result = await engine.execute('throw new Error("Custom error message")')
      assert.ok(result.error!.includes('Custom error message'))
    })

    test('should handle reference errors', async () => {
      const result = await engine.execute('console.log(undefinedVariable)')
      assert.ok(result.error!.includes('ReferenceError') || result.error!.includes('not defined'))
    })

    test('should handle type errors', async () => {
      const result = await engine.execute('null.someProperty')
      assert.ok(result.error!.includes('TypeError') || result.error!.includes('null'))
    })

    test('should handle errors with stack traces', async () => {
      const result = await engine.execute(`
        function throwError() { throw new Error("Test error"); }
        throwError();
      `)
      assert.ok(result.error!.includes('Test error'))
    })

    test('should handle string errors', async () => {
      const result = await engine.execute('throw "Simple string error"')
      assert.strictEqual(result.error, 'Simple string error')
    })

    test('should handle range errors', async () => {
      const result = await engine.execute('throw new RangeError("Value out of range")')
      assert.ok(result.error!.includes('RangeError'))
      assert.ok(result.error!.includes('Value out of range'))
    })

    test('should handle custom error objects', async () => {
      const result = await engine.execute(`
        const customError = { 
          name: "CustomError", 
          message: "Custom message",
          customField: "extra data"
        };
        throw customError;
      `)
      assert.ok(result.error!.includes('CustomError'))
      assert.ok(result.error!.includes('Custom message'))
    })
  })

  describe('Edge Cases and Special Values', () => {
    test('should handle empty code', async () => {
      const result = await engine.execute('')
      assert.strictEqual(result.error, undefined)
      assert.strictEqual(result.returnValue, undefined)
      assert.strictEqual(result.logs.length, 0)
    })

    test('should handle whitespace-only code', async () => {
      const result = await engine.execute('   \n\t  ')
      assert.strictEqual(result.returnValue, undefined)
    })

    test('should handle comments-only code', async () => {
      const result = await engine.execute(`
        // This is a comment
        /* This is also a comment */
      `)
      assert.strictEqual(result.returnValue, undefined)
    })

    test('should handle null return value', async () => {
      const result = await engine.execute('null')
      assert.strictEqual(result.returnValue, 'null')
    })

    test('should handle boolean return values', async () => {
      let result = await engine.execute('true')
      assert.strictEqual(result.returnValue, 'true')

      result = await engine.execute('false')
      assert.strictEqual(result.returnValue, 'false')
    })

    test('should handle undefined return value', async () => {
      const result = await engine.execute('undefined')
      assert.strictEqual(result.returnValue, undefined)
    })

    test('should format complex object return values', async () => {
      const result = await engine.execute('({name: "test", value: 42})')
      assert.ok(result.returnValue?.includes('"name": "test"'))
      assert.ok(result.returnValue?.includes('"value": 42'))
    })

    test('should format array return values', async () => {
      const result = await engine.execute('[1, "two", {three: 3}]')
      assert.ok(result.returnValue?.includes('1'))
      assert.ok(result.returnValue?.includes('"two"'))
      assert.ok(result.returnValue?.includes('"three": 3'))
    })

    test('should handle string return values', async () => {
      const result = await engine.execute('"hello world"')
      assert.strictEqual(result.returnValue, 'hello world')
    })

    test('should handle number return values', async () => {
      const result = await engine.execute('3.14159')
      assert.strictEqual(result.returnValue, '3.14159')
    })
  })

  describe('Module URL Resolution', () => {
    test('should resolve package names to esm.sh', () => {
      const resolveModuleUrl = (engine as any).resolveModuleUrl.bind(engine)

      assert.strictEqual(resolveModuleUrl('react'), 'https://esm.sh/react')
      assert.strictEqual(resolveModuleUrl('lodash@4.17.21'), 'https://esm.sh/lodash@4.17.21')
      assert.strictEqual(resolveModuleUrl('@types/node'), 'https://esm.sh/@types/node')
    })

    test('should pass through HTTP/HTTPS URLs unchanged', () => {
      const resolveModuleUrl = (engine as any).resolveModuleUrl.bind(engine)

      assert.strictEqual(
        resolveModuleUrl('https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js'),
        'https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js'
      )
      assert.strictEqual(
        resolveModuleUrl('http://localhost:3000/dist/bundle.js'),
        'http://localhost:3000/dist/bundle.js'
      )
    })

    test('should handle paths starting with slash', () => {
      const resolveModuleUrl = (engine as any).resolveModuleUrl.bind(engine)

      assert.strictEqual(resolveModuleUrl('/lodash'), 'https://esm.sh/lodash')
      assert.strictEqual(resolveModuleUrl('/@types/node'), 'https://esm.sh/@types/node')
      assert.strictEqual(resolveModuleUrl('/@angular/core@15.2.0'), 'https://esm.sh/@angular/core@15.2.0')
      assert.strictEqual(resolveModuleUrl('/lodash/debounce'), 'https://esm.sh/lodash/debounce')
    })

    test('should handle edge cases', () => {
      const resolveModuleUrl = (engine as any).resolveModuleUrl.bind(engine)

      assert.strictEqual(resolveModuleUrl(''), 'https://esm.sh/')
      assert.strictEqual(resolveModuleUrl('lodash/debounce'), 'https://esm.sh/lodash/debounce')
    })
  })

  describe('Mixed Execution Scenarios', () => {
    test('should handle code with both logs and return value', async () => {
      const result = await engine.execute(`
        console.log("Starting calculation");
        const result = 2 + 3;
        console.log("Result is", result);
        result * 2;
      `)
      assert.strictEqual(result.error, undefined)
      assert.strictEqual(result.returnValue, '10')
      assert.strictEqual(result.logs.length, 2)
      assert.strictEqual(result.logs[0].content, 'Starting calculation')
      assert.strictEqual(result.logs[1].content, 'Result is 5')
    })

    test('should handle errors with prior console output', async () => {
      const result = await engine.execute(`
        console.log("This will be logged");
        console.log("This too");
        throw new Error("Something went wrong");
      `)
      assert.ok(result.error!.includes('Something went wrong'))
      assert.strictEqual(result.logs.length, 2)
      assert.strictEqual(result.logs[0].content, 'This will be logged')
      assert.strictEqual(result.logs[1].content, 'This too')
    })

    test('should handle multiple sequential executions', async () => {
      for (let i = 0; i < 5; i++) {
        const result = await engine.execute(`console.log("Test ${i}"); ${i * 2}`)
        assert.strictEqual(result.error, undefined)
        assert.strictEqual(result.returnValue, String(i * 2))
        assert.strictEqual(result.logs.length, 1)
      }
    })

    test('should recover after multiple errors', async () => {
      // Execute multiple failing operations
      for (let i = 0; i < 3; i++) {
        const result = await engine.execute(`console.log("Before error ${i}"); throw new Error("Test error ${i}")`)
        assert.ok(result.error!.includes(`Test error ${i}`))
        assert.strictEqual(result.logs.length, 1)
      }

      // Should still work after errors
      const result = await engine.execute('console.log("After errors"); 42')
      assert.strictEqual(result.error, undefined)
      assert.strictEqual(result.returnValue, '42')
    })
  })

  describe('Security and Performance Constraints', () => {
    test('should interrupt infinite loops', async () => {
      const result = await engine.execute(`
        let counter = 0;
        while (true) {
          counter++;
          // This should be interrupted after 1024 cycles
        }
      `)
      assert.ok(result.error, 'Infinite loop should be interrupted and produce an error')
      assert.ok(
        result.error.startsWith('InternalError') || result.error.includes('interrupted'),
        'Error should indicate interruption'
      )
    })

    test('should limit excessive memory allocation', async () => {
      const result = await engine.execute(`
        try {
          // Try to allocate a very large array that exceeds memory limit
          const largeArray = new Array(1000000).fill(0).map((_, i) => ({
            id: i,
            data: 'x'.repeat(1000), // Each object ~1KB
            moreData: new Array(100).fill(i)
          }));
          largeArray.length;
        } catch (e) {
          throw e;
        }
      `)
      assert.ok(result.error, 'Large memory allocation should be rejected')
      assert.ok(
        result.error.startsWith('InternalError') && result.error.includes('out of memory'),
        'Error should indicate memory limit exceeded'
      )
    })

    test('should limit deep recursion', async () => {
      const result = await engine.execute(`
        function deepRecursion(n) {
          if (n <= 0) return 0;
          // Create some stack frame data to consume more stack space
          const localData = new Array(100).fill(n);
          return n + deepRecursion(n - 1);
        }
        deepRecursion(10000); // This should exceed stack limit
      `)
      assert.ok(result.error, 'Deep recursion should hit stack limit')
      assert.equal(
        result.error,
        'Execution error: Maximum call stack size exceeded',
        'Error should indicate stack overflow'
      )
    })

    test('should allow normal operations within limits', async () => {
      const result = await engine.execute('Number.MAX_SAFE_INTEGER')
      assert.strictEqual(result.returnValue, String(Number.MAX_SAFE_INTEGER))
    })

    test('should allow controlled recursion within limits', async () => {
      const result = await engine.execute(`
        function factorial(n) {
          if (n <= 1) return 1;
          return n * factorial(n - 1);
        }
        factorial(10);
      `)
      assert.strictEqual(result.returnValue, '3628800')
    })

    test('should allow reasonable memory usage', async () => {
      const result = await engine.execute(`
        const arr = new Array(1000).fill(0).map((_, i) => i);
        arr.length;
      `)
      assert.strictEqual(result.returnValue, '1000')
    })

    test('should allow safe recursion', async () => {
      const result = await engine.execute(`
        function safeRecursion(n) {
          if (n <= 0) return 0;
          if (n > 50) return n; // Keep recursion shallow
          return n + safeRecursion(n - 1);
        }
        safeRecursion(10);
      `)
      assert.strictEqual(result.returnValue, '55')
    })
  })
})
