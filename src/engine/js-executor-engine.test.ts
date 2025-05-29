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
    });

    test('should handle type errors', async () => {
      const result = await engine.execute('null.someProperty');
      assert.ok(result.error);
      assert.ok(result.error.includes('TypeError') || result.error.includes('null'));
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
      assert.strictEqual(result.logs.length, 0);
    });

    test('should handle whitespace only code', async () => {
      const result = await engine.execute('   \n\t  ');
      assert.strictEqual(result.error, undefined);
      assert.strictEqual(result.logs.length, 0);
    });

    test('should handle code with only comments', async () => {
      const code = `
        // This is a comment
        /* This is also a comment */
      `;
      const result = await engine.execute(code);
      assert.strictEqual(result.error, undefined);
      assert.strictEqual(result.logs.length, 0);
    });

    test('should handle undefined return value', async () => {
      const code = `
        let x = 5;
        // No return statement
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
      // Should either timeout or be interrupted, not hang forever
      assert.ok(result.error || result.returnValue !== undefined);
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
});
