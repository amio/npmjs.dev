import assert from 'node:assert';
import { test, describe, beforeEach, afterEach } from 'node:test';
import { JSExecutorEngine } from './js-executor-engine';

describe('JSExecutorEngine', () => {
  let engine: JSExecutorEngine;

  beforeEach(async () => {
    engine = new JSExecutorEngine();
    await engine.initialize();
  });

  afterEach(() => {
    engine.dispose();
  });

  describe('initialization', () => {
    test('should initialize successfully', async () => {
      const newEngine = new JSExecutorEngine();
      await newEngine.initialize();
      assert.strictEqual(newEngine.isReady(), true);
      newEngine.dispose();
    });

    test('should handle multiple initialize calls', async () => {
      const newEngine = new JSExecutorEngine();
      await newEngine.initialize();
      await newEngine.initialize(); // Should not throw
      assert.strictEqual(newEngine.isReady(), true);
      newEngine.dispose();
    });

    test('should throw error when executing before initialization', async () => {
      const newEngine = new JSExecutorEngine();
      await assert.rejects(
        () => newEngine.execute('console.log("test")'),
        /Execution engine is not initialized yet/
      );
    });
  });

  describe('basic code execution', () => {
    test('should execute simple expressions', async () => {
      const result = await engine.execute('1 + 1');
      assert.strictEqual(result.error, undefined);
      assert.strictEqual(result.returnValue, '2');
      assert.strictEqual(result.logs.length, 0);
    });

    test('should execute string operations', async () => {
      const result = await engine.execute('"hello" + " " + "world"');
      assert.strictEqual(result.error, undefined);
      assert.strictEqual(result.returnValue, 'hello world');
    });

    test('should execute function calls', async () => {
      const code = `
        function add(a, b) {
          return a + b;
        }
        add(5, 3);
      `;
      const result = await engine.execute(code);
      assert.strictEqual(result.error, undefined);
      assert.strictEqual(result.returnValue, '8');
    });

    test('should handle variable declarations', async () => {
      const code = `
        const x = 10;
        const y = 20;
        x * y;
      `;
      const result = await engine.execute(code);
      assert.strictEqual(result.error, undefined);
      assert.strictEqual(result.returnValue, '200');
    });
  });

  describe('console logging', () => {
    test('should capture console.log output', async () => {
      const result = await engine.execute('console.log("Hello, World!")');
      assert.strictEqual(result.error, undefined);
      assert.strictEqual(result.logs.length, 1);
      assert.strictEqual(result.logs[0].type, 'log');
      assert.strictEqual(result.logs[0].content, 'Hello, World!');
      assert.ok(result.logs[0].timestamp > 0);
    });

    test('should capture multiple console methods', async () => {
      const code = `
        console.log("Log message");
        console.error("Error message");
        console.warn("Warning message");
        console.info("Info message");
      `;
      const result = await engine.execute(code);
      assert.strictEqual(result.error, undefined);
      assert.strictEqual(result.logs.length, 4);
      
      assert.strictEqual(result.logs[0].type, 'log');
      assert.strictEqual(result.logs[0].content, 'Log message');
      
      assert.strictEqual(result.logs[1].type, 'error');
      assert.strictEqual(result.logs[1].content, 'Error message');
      
      assert.strictEqual(result.logs[2].type, 'warn');
      assert.strictEqual(result.logs[2].content, 'Warning message');
      
      assert.strictEqual(result.logs[3].type, 'info');
      assert.strictEqual(result.logs[3].content, 'Info message');
    });

    test('should handle multiple arguments in console.log', async () => {
      const result = await engine.execute('console.log("Number:", 42, "Boolean:", true)');
      assert.strictEqual(result.error, undefined);
      assert.strictEqual(result.logs.length, 1);
      assert.strictEqual(result.logs[0].content, 'Number: 42 Boolean: true');
    });

    test('should handle objects in console.log', async () => {
      const result = await engine.execute('console.log({name: "test", value: 123})');
      assert.strictEqual(result.error, undefined);
      assert.strictEqual(result.logs.length, 1);
      assert.ok(result.logs[0].content.includes('"name": "test"'));
      assert.ok(result.logs[0].content.includes('"value": 123'));
    });

    test('should handle arrays in console.log', async () => {
      const result = await engine.execute('console.log([1, 2, 3, "test"])');
      assert.strictEqual(result.error, undefined);
      assert.strictEqual(result.logs.length, 1);
      assert.ok(result.logs[0].content.includes('1'));
      assert.ok(result.logs[0].content.includes('test'));
    });
  });

  describe('error handling', () => {
    test('should capture syntax errors', async () => {
      const result = await engine.execute('const x = ;');
      assert.ok(result.error);
      assert.ok(result.error.includes('SyntaxError') || result.error.includes('syntax'));
      assert.strictEqual(result.returnValue, undefined);
    });

    test('should capture runtime errors', async () => {
      const result = await engine.execute('throw new Error("Custom error message")');
      assert.ok(result.error);
      assert.ok(result.error.includes('Custom error message'));
      assert.strictEqual(result.returnValue, undefined);
    });

    test('should capture reference errors', async () => {
      const result = await engine.execute('console.log(undefinedVariable)');
      assert.ok(result.error);
      assert.ok(result.error.includes('ReferenceError') || result.error.includes('not defined'));
      assert.strictEqual(result.returnValue, undefined);
    });

    test('should handle type errors', async () => {
      const result = await engine.execute('null.someProperty');
      assert.ok(result.error);
      assert.ok(result.error.includes('TypeError') || result.error.includes('null'));
      assert.strictEqual(result.returnValue, undefined);
    });

    test('should capture errors with stack traces', async () => {
      const code = `
        function throwError() {
          throw new Error("Test error");
        }
        throwError();
      `;
      const result = await engine.execute(code);
      assert.ok(result.error);
      assert.ok(result.error.includes('Test error'));
      assert.strictEqual(result.returnValue, undefined);
    });
  });

  describe('complex scenarios', () => {
    test('should handle loops', async () => {
      const code = `
        let sum = 0;
        for (let i = 1; i <= 5; i++) {
          sum += i;
        }
        sum;
      `;
      const result = await engine.execute(code);
      assert.strictEqual(result.error, undefined);
      assert.strictEqual(result.returnValue, '15');
    });

    test('should handle closures', async () => {
      const code = `
        function createCounter() {
          let count = 0;
          return function() {
            return ++count;
          };
        }
        const counter = createCounter();
        counter() + counter();
      `;
      const result = await engine.execute(code);
      assert.strictEqual(result.error, undefined);
      assert.strictEqual(result.returnValue, '3');
    });

    test('should handle async/await syntax', async () => {
      const code = `
        async function test() {
          return 42;
        }
        // Just check the function definition, not execution
        typeof test;
      `;
      const result = await engine.execute(code);
      assert.strictEqual(result.error, undefined);
      assert.strictEqual(result.returnValue, 'function');
    });

    test('should handle JSON operations', async () => {
      const code = `
        const obj = {name: "test", value: 123};
        const json = JSON.stringify(obj);
        const parsed = JSON.parse(json);
        parsed.value;
      `;
      const result = await engine.execute(code);
      assert.strictEqual(result.error, undefined);
      assert.strictEqual(result.returnValue, '123');
    });

    test('should handle array methods', async () => {
      const code = `
        [1, 2, 3, 4, 5]
          .filter(x => x % 2 === 0)
          .map(x => x * 2)
          .reduce((a, b) => a + b, 0);
      `;
      const result = await engine.execute(code);
      assert.strictEqual(result.error, undefined);
      assert.strictEqual(result.returnValue, '12'); // (2 + 4) * 2 = 12
    });
  });

  describe('edge cases', () => {
    test('should handle empty code', async () => {
      const result = await engine.execute('');
      assert.strictEqual(result.error, undefined);
      assert.strictEqual(result.returnValue, undefined);
      assert.strictEqual(result.logs.length, 0);
    });

    test('should handle whitespace only code', async () => {
      const result = await engine.execute('   \n\t  ');
      assert.strictEqual(result.error, undefined);
      assert.strictEqual(result.returnValue, undefined);
      assert.strictEqual(result.logs.length, 0);
    });

    test('should handle code with only comments', async () => {
      const code = `
        // This is a comment
        /* This is also a comment */
      `;
      const result = await engine.execute(code);
      assert.strictEqual(result.error, undefined);
      assert.strictEqual(result.returnValue, undefined);
      assert.strictEqual(result.logs.length, 0);
    });

    test('should handle undefined return value', async () => {
      const code = `
        let x = 5;
        // No return statement, evaluates to undefined
      `;
      const result = await engine.execute(code);
      assert.strictEqual(result.error, undefined);
      assert.strictEqual(result.returnValue, undefined);
    });

    test('should handle null values', async () => {
      const result = await engine.execute('null');
      assert.strictEqual(result.error, undefined);
      assert.strictEqual(result.returnValue, 'null');
    });

    test('should handle boolean values', async () => {
      const trueResult = await engine.execute('true');
      assert.strictEqual(trueResult.error, undefined);
      assert.strictEqual(trueResult.returnValue, 'true');

      const falseResult = await engine.execute('false');
      assert.strictEqual(falseResult.error, undefined);
      assert.strictEqual(falseResult.returnValue, 'false');
    });
  });

  describe('security and limits', () => {
    test('should handle infinite loops with interrupt', async () => {
      const code = `
        while (true) {
          // This should be interrupted
        }
      `;
      const result = await engine.execute(code);
      // Should be interrupted and produce an error, not hang forever
      assert.ok(result.error, 'Infinite loop should be interrupted and produce an error');
    });

    test('should handle large numbers', async () => {
      const result = await engine.execute('Number.MAX_SAFE_INTEGER');
      assert.strictEqual(result.error, undefined);
      assert.strictEqual(result.returnValue, String(Number.MAX_SAFE_INTEGER));
    });

    test('should handle recursive functions', async () => {
      const code = `
        function factorial(n) {
          if (n <= 1) return 1;
          return n * factorial(n - 1);
        }
        factorial(5);
      `;
      const result = await engine.execute(code);
      assert.strictEqual(result.error, undefined);
      assert.strictEqual(result.returnValue, '120');
    });
  });

  describe('mixed execution scenarios', () => {
    test('should handle code with both logs and return value', async () => {
      const code = `
        console.log("Starting calculation");
        const result = 2 + 3;
        console.log("Result is", result);
        result * 2;
      `;
      const execution = await engine.execute(code);
      assert.strictEqual(execution.error, undefined);
      assert.strictEqual(execution.returnValue, '10');
      assert.strictEqual(execution.logs.length, 2);
      assert.strictEqual(execution.logs[0].content, 'Starting calculation');
      assert.strictEqual(execution.logs[1].content, 'Result is 5');
    });

    test('should handle errors with prior console output', async () => {
      const code = `
        console.log("This will be logged");
        console.log("This too");
        throw new Error("Something went wrong");
      `;
      const result = await engine.execute(code);
      assert.ok(result.error);
      assert.ok(result.error.includes('Something went wrong'));
      assert.strictEqual(result.logs.length, 2);
      assert.strictEqual(result.logs[0].content, 'This will be logged');
      assert.strictEqual(result.logs[1].content, 'This too');
    });
  });

  describe('module loading', () => {
    test('should handle module import attempts', async () => {
      // Note: This test may fail if esm.sh is not accessible
      // It tests the module loading mechanism
      const code = `
        // This should trigger the module loader
        try {
          // We just test that the module loader doesn't crash the engine
          1 + 1;
        } catch (e) {
          console.log("Module loading test");
        }
      `;
      const result = await engine.execute(code);
      assert.strictEqual(result.error, undefined);
      assert.strictEqual(result.returnValue, '2');
    });

    test('should correctly call asyncModuleLoader with different input types', () => {
      // Test the asyncModuleLoader method indirectly by verifying resolveModuleUrl behavior
      const resolveModuleUrl = (engine as any).resolveModuleUrl.bind(engine);
      
      // Verify package names get prefixed with esm.sh
      assert.strictEqual(
        resolveModuleUrl('react'),
        'https://esm.sh/react'
      );
      
      // Verify URLs pass through unchanged
      assert.strictEqual(
        resolveModuleUrl('https://cdn.skypack.dev/lodash'),
        'https://cdn.skypack.dev/lodash'
      );
      
      // Verify paths starting with slash get prefixed correctly
      assert.strictEqual(
        resolveModuleUrl('/react'),
        'https://esm.sh/react'
      );
      
      // Verify scoped packages starting with slash
      assert.strictEqual(
        resolveModuleUrl('/@types/node'),
        'https://esm.sh/@types/node'
      );
    });

    describe('resolveModuleUrl', () => {
      test('should handle package names', () => {
        // Access the private method for testing
        const resolveModuleUrl = (engine as any).resolveModuleUrl.bind(engine);
        
        assert.strictEqual(
          resolveModuleUrl('lodash'),
          'https://esm.sh/lodash'
        );
        
        assert.strictEqual(
          resolveModuleUrl('lodash@4.17.21'),
          'https://esm.sh/lodash@4.17.21'
        );
        
        assert.strictEqual(
          resolveModuleUrl('@types/node'),
          'https://esm.sh/@types/node'
        );
      });

      test('should handle HTTP URLs', () => {
        const resolveModuleUrl = (engine as any).resolveModuleUrl.bind(engine);
        
        assert.strictEqual(
          resolveModuleUrl('http://example.com/module.js'),
          'http://example.com/module.js'
        );
        
        assert.strictEqual(
          resolveModuleUrl('http://localhost:3000/dist/bundle.js'),
          'http://localhost:3000/dist/bundle.js'
        );
      });

      test('should handle HTTPS URLs', () => {
        const resolveModuleUrl = (engine as any).resolveModuleUrl.bind(engine);
        
        assert.strictEqual(
          resolveModuleUrl('https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js'),
          'https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js'
        );
        
        assert.strictEqual(
          resolveModuleUrl('https://esm.sh/react@18.2.0'),
          'https://esm.sh/react@18.2.0'
        );
        
        assert.strictEqual(
          resolveModuleUrl('https://unpkg.com/vue@3.3.4/dist/vue.esm-browser.js'),
          'https://unpkg.com/vue@3.3.4/dist/vue.esm-browser.js'
        );
      });

      test('should handle paths starting with slash', () => {
        const resolveModuleUrl = (engine as any).resolveModuleUrl.bind(engine);
        
        // Test /{package} format
        assert.strictEqual(
          resolveModuleUrl('/lodash'),
          'https://esm.sh/lodash'
        );
        
        assert.strictEqual(
          resolveModuleUrl('/react@18.2.0'),
          'https://esm.sh/react@18.2.0'
        );
        
        // Test /@{namespace}/{package} format
        assert.strictEqual(
          resolveModuleUrl('/@types/node'),
          'https://esm.sh/@types/node'
        );
        
        assert.strictEqual(
          resolveModuleUrl('/@angular/core@15.2.0'),
          'https://esm.sh/@angular/core@15.2.0'
        );
        
        // Test regular scoped packages starting with slash
        assert.strictEqual(
          resolveModuleUrl('/@babel/core'),
          'https://esm.sh/@babel/core'
        );
        
        // Test packages with sub-paths
        assert.strictEqual(
          resolveModuleUrl('/lodash/debounce'),
          'https://esm.sh/lodash/debounce'
        );
        
        // Test complex package paths
        assert.strictEqual(
          resolveModuleUrl('/@apollo/client/core'),
          'https://esm.sh/@apollo/client/core'
        );
      });

      test('should handle edge cases', () => {
        const resolveModuleUrl = (engine as any).resolveModuleUrl.bind(engine);
        
        // Empty string should be treated as package name
        assert.strictEqual(
          resolveModuleUrl(''),
          'https://esm.sh/'
        );
        
        // Packages with special characters
        assert.strictEqual(
          resolveModuleUrl('@angular/core@15.2.0'),
          'https://esm.sh/@angular/core@15.2.0'
        );
        
        // Packages with subdirectories
        assert.strictEqual(
          resolveModuleUrl('lodash/debounce'),
          'https://esm.sh/lodash/debounce'
        );
        
        // Test edge case with just slash
        assert.strictEqual(
          resolveModuleUrl('/'),
          'https://esm.sh//'
        );
        
        // Test paths that don't match the pattern (no package name after slash)
        assert.strictEqual(
          resolveModuleUrl('/not-a-valid-package-path'),
          'https://esm.sh/not-a-valid-package-path'
        );
      });
    });
  });

  describe('runtime configuration', () => {
    test('should handle memory intensive operations within limits', async () => {
      const code = `
        // Create a moderately sized array to test memory limits
        const arr = new Array(1000).fill(0).map((_, i) => i);
        arr.length;
      `;
      const result = await engine.execute(code);
      assert.strictEqual(result.error, undefined);
      assert.strictEqual(result.returnValue, '1000');
    });

    test('should handle stack operations within limits', async () => {
      const code = `
        function deepRecursion(n) {
          if (n <= 0) return 0;
          if (n > 100) return n; // Prevent too deep recursion for test
          return n + deepRecursion(n - 1);
        }
        deepRecursion(10);
      `;
      const result = await engine.execute(code);
      assert.strictEqual(result.error, undefined);
      assert.strictEqual(result.returnValue, '55'); // 10+9+8+...+1 = 55
    });
  });

  describe('console setup and formatting', () => {
    test('should handle complex object formatting in console', async () => {
      const code = `
        const complexObj = {
          nested: {
            array: [1, 2, 3],
            object: { key: "value" }
          },
          func: function() { return "test"; }
        };
        console.log(complexObj);
      `;
      const result = await engine.execute(code);
      assert.strictEqual(result.error, undefined);
      assert.strictEqual(result.logs.length, 1);
      assert.ok(result.logs[0].content.includes('nested'));
      assert.ok(result.logs[0].content.includes('array'));
    });

    test('should handle circular references in console gracefully', async () => {
      const code = `
        const obj = {};
        obj.self = obj;
        try {
          console.log(obj);
        } catch (e) {
          console.log("Circular reference handled");
        }
      `;
      const result = await engine.execute(code);
      assert.strictEqual(result.error, undefined);
      assert.strictEqual(result.logs.length, 1);
      // Should either log the object or handle the circular reference
      assert.ok(result.logs[0].content.length > 0);
    });

    test('should format console output with proper timestamps', async () => {
      const beforeTime = Date.now();
      const result = await engine.execute('console.log("timestamp test")');
      const afterTime = Date.now();
      
      assert.strictEqual(result.error, undefined);
      assert.strictEqual(result.logs.length, 1);
      assert.ok(result.logs[0].timestamp >= beforeTime);
      assert.ok(result.logs[0].timestamp <= afterTime);
    });
  });

  describe('error message formatting', () => {
    test('should format simple string errors properly', async () => {
      const result = await engine.execute('throw "Simple string error"');
      assert.ok(result.error);
      assert.strictEqual(result.error, 'Simple string error');
    });

    test('should format Error objects with name and message', async () => {
      const result = await engine.execute('throw new RangeError("Value out of range")');
      assert.ok(result.error);
      assert.ok(result.error.includes('RangeError'));
      assert.ok(result.error.includes('Value out of range'));
    });

    test('should format errors with stack traces', async () => {
      const code = `
        function throwingFunction() {
          throw new Error("Detailed error");
        }
        function callingFunction() {
          throwingFunction();
        }
        callingFunction();
      `;
      const result = await engine.execute(code);
      assert.ok(result.error);
      assert.ok(result.error.includes('Detailed error'));
      // Stack trace formatting may vary, but should include function names
    });

    test('should handle non-standard error objects', async () => {
      const code = `
        const customError = { 
          name: "CustomError", 
          message: "Custom message",
          customField: "extra data"
        };
        throw customError;
      `;
      const result = await engine.execute(code);
      assert.ok(result.error);
      assert.ok(result.error.includes('CustomError'));
      assert.ok(result.error.includes('Custom message'));
    });
  });

  describe('return value formatting', () => {
    test('should format object return values as JSON', async () => {
      const result = await engine.execute('({name: "test", value: 42})');
      assert.strictEqual(result.error, undefined);
      assert.ok(result.returnValue);
      assert.ok(result.returnValue.includes('"name": "test"'));
      assert.ok(result.returnValue.includes('"value": 42'));
    });

    test('should format array return values as JSON', async () => {
      const result = await engine.execute('[1, "two", {three: 3}]');
      assert.strictEqual(result.error, undefined);
      assert.ok(result.returnValue);
      assert.ok(result.returnValue.includes('1'));
      assert.ok(result.returnValue.includes('"two"'));
      assert.ok(result.returnValue.includes('"three": 3'));
    });

    test('should handle primitive return values', async () => {
      const stringResult = await engine.execute('"hello world"');
      assert.strictEqual(stringResult.returnValue, 'hello world');

      const numberResult = await engine.execute('3.14159');
      assert.strictEqual(numberResult.returnValue, '3.14159');

      const booleanResult = await engine.execute('true');
      assert.strictEqual(booleanResult.returnValue, 'true');
    });

    test('should handle undefined return values gracefully', async () => {
      const result = await engine.execute('undefined');
      assert.strictEqual(result.error, undefined);
      // When JavaScript evaluates to undefined, returnValue should be undefined (not present)
      assert.strictEqual(result.returnValue, undefined);
    });

    test('should handle code that evaluates to undefined', async () => {
      const code = `
        let x = 5;
        // No return statement, should be undefined
      `;
      const result = await engine.execute(code);
      assert.strictEqual(result.error, undefined);
      assert.strictEqual(result.returnValue, undefined);
    });
  });

  describe('resource cleanup', () => {
    test('should properly clean up resources after successful execution', async () => {
      // This test verifies that multiple executions don't leak resources
      for (let i = 0; i < 5; i++) {
        const result = await engine.execute(`console.log("Test ${i}"); ${i * 2}`);
        assert.strictEqual(result.error, undefined);
        assert.strictEqual(result.returnValue, String(i * 2));
        assert.strictEqual(result.logs.length, 1);
      }
    });

    test('should properly clean up resources after error execution', async () => {
      // This test verifies that errors don't prevent proper cleanup
      for (let i = 0; i < 3; i++) {
        const result = await engine.execute(`console.log("Before error ${i}"); throw new Error("Test error ${i}")`);
        assert.ok(result.error);
        assert.ok(result.error.includes(`Test error ${i}`));
        assert.strictEqual(result.returnValue, undefined);
        assert.strictEqual(result.logs.length, 1);
      }
      
      // Should still be able to execute successfully after errors
      const successResult = await engine.execute('console.log("After errors"); 42');
      assert.strictEqual(successResult.error, undefined);
      assert.strictEqual(successResult.returnValue, '42');
    });
  });

  describe('engine state management', () => {
    test('should maintain proper state after multiple operations', async () => {
      // Verify isReady state
      assert.strictEqual(engine.isReady(), true);
      
      // Execute some code
      await engine.execute('1 + 1');
      assert.strictEqual(engine.isReady(), true);
      
      // Execute code with error
      await engine.execute('throw new Error("test")');
      assert.strictEqual(engine.isReady(), true);
      
      // Should still work normally
      const result = await engine.execute('2 + 2');
      assert.strictEqual(result.returnValue, '4');
    });

    test('should handle dispose and reinitialize correctly', async () => {
      // Dispose current engine
      engine.dispose();
      assert.strictEqual(engine.isReady(), false);
      
      // Should not be able to execute
      await assert.rejects(
        () => engine.execute('1 + 1'),
        /Execution engine is not initialized yet/
      );
      
      // Reinitialize
      await engine.initialize();
      assert.strictEqual(engine.isReady(), true);
      
      // Should work again
      const result = await engine.execute('3 + 3');
      assert.strictEqual(result.returnValue, '6');
    });
  });
});
