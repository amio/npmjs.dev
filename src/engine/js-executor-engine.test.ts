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

  test('should handle initialization and state management', async () => {
    // Test successful initialization
    const newEngine = new JSExecutorEngine();
    await newEngine.initialize();
    assert.strictEqual(newEngine.isReady(), true);
    
    // Test multiple initialize calls (should not throw)
    await newEngine.initialize();
    assert.strictEqual(newEngine.isReady(), true);
    
    // Test execution before initialization
    const uninitializedEngine = new JSExecutorEngine();
    await assert.rejects(
      () => uninitializedEngine.execute('console.log("test")'),
      /Execution engine is not initialized yet/
    );
    
    // Test dispose and reinitialize
    newEngine.dispose();
    assert.strictEqual(newEngine.isReady(), false);
    await assert.rejects(
      () => newEngine.execute('1 + 1'),
      /Execution engine is not initialized yet/
    );
    
    await newEngine.initialize();
    assert.strictEqual(newEngine.isReady(), true);
    const result = await newEngine.execute('3 + 3');
    assert.strictEqual(result.returnValue, '6');
    
    newEngine.dispose();
  });

  test('should execute various JavaScript syntax and operations', async () => {
    // Basic expressions
    let result = await engine.execute('1 + 1');
    assert.strictEqual(result.error, undefined);
    assert.strictEqual(result.returnValue, '2');

    // String operations
    result = await engine.execute('"hello" + " " + "world"');
    assert.strictEqual(result.returnValue, 'hello world');

    // Function declarations and calls
    result = await engine.execute(`
      function add(a, b) { return a + b; }
      add(5, 3);
    `);
    assert.strictEqual(result.returnValue, '8');

    // Variable declarations
    result = await engine.execute(`
      const x = 10;
      const y = 20;
      x * y;
    `);
    assert.strictEqual(result.returnValue, '200');

    // Loops and control flow
    result = await engine.execute(`
      let sum = 0;
      for (let i = 1; i <= 5; i++) {
        sum += i;
      }
      sum;
    `);
    assert.strictEqual(result.returnValue, '15');

    // Closures
    result = await engine.execute(`
      function createCounter() {
        let count = 0;
        return function() { return ++count; };
      }
      const counter = createCounter();
      counter() + counter();
    `);
    assert.strictEqual(result.returnValue, '3');

    // Array methods and functional programming
    result = await engine.execute(`
      [1, 2, 3, 4, 5]
        .filter(x => x % 2 === 0)
        .map(x => x * 2)
        .reduce((a, b) => a + b, 0);
    `);
    assert.strictEqual(result.returnValue, '12');

    // JSON operations
    result = await engine.execute(`
      const obj = {name: "test", value: 123};
      const json = JSON.stringify(obj);
      const parsed = JSON.parse(json);
      parsed.value;
    `);
    assert.strictEqual(result.returnValue, '123');

    // Async function syntax (definition only)
    result = await engine.execute(`
      async function test() { return 42; }
      typeof test;
    `);
    assert.strictEqual(result.returnValue, 'function');
  });

  test('should handle console logging with various data types', async () => {
    // Basic console.log
    let result = await engine.execute('console.log("Hello, World!")');
    assert.strictEqual(result.error, undefined);
    assert.strictEqual(result.logs.length, 1);
    assert.strictEqual(result.logs[0].type, 'log');
    assert.strictEqual(result.logs[0].content, 'Hello, World!');
    assert.ok(result.logs[0].timestamp > 0);

    // Multiple console methods
    result = await engine.execute(`
      console.log("Log message");
      console.error("Error message");
      console.warn("Warning message");
      console.info("Info message");
    `);
    assert.strictEqual(result.logs.length, 4);
    assert.strictEqual(result.logs[0].type, 'log');
    assert.strictEqual(result.logs[1].type, 'error');
    assert.strictEqual(result.logs[2].type, 'warn');
    assert.strictEqual(result.logs[3].type, 'info');

    // Multiple arguments
    result = await engine.execute('console.log("Number:", 42, "Boolean:", true)');
    assert.strictEqual(result.logs[0].content, 'Number: 42 Boolean: true');

    // Objects and arrays
    result = await engine.execute('console.log({name: "test", value: 123})');
    assert.ok(result.logs[0].content.includes('"name": "test"'));
    assert.ok(result.logs[0].content.includes('"value": 123'));

    result = await engine.execute('console.log([1, 2, 3, "test"])');
    assert.ok(result.logs[0].content.includes('1'));
    assert.ok(result.logs[0].content.includes('test'));

    // Complex objects with circular references
    result = await engine.execute(`
      const obj = {};
      obj.self = obj;
      try {
        console.log(obj);
      } catch (e) {
        console.log("Circular reference handled");
      }
    `);
    assert.strictEqual(result.logs.length, 1);
    assert.ok(result.logs[0].content.length > 0);
  });

  test('should handle all types of errors gracefully', async () => {
    // Syntax errors
    let result = await engine.execute('const x = ;');
    assert.ok(result.error);
    assert.ok(result.error!.includes('SyntaxError') || result.error!.includes('syntax'));

    // Runtime errors
    result = await engine.execute('throw new Error("Custom error message")');
    assert.ok(result.error!.includes('Custom error message'));

    // Reference errors
    result = await engine.execute('console.log(undefinedVariable)');
    assert.ok(result.error!.includes('ReferenceError') || result.error!.includes('not defined'));

    // Type errors
    result = await engine.execute('null.someProperty');
    assert.ok(result.error!.includes('TypeError') || result.error!.includes('null'));

    // Errors with stack traces
    result = await engine.execute(`
      function throwError() { throw new Error("Test error"); }
      throwError();
    `);
    assert.ok(result.error!.includes('Test error'));

    // Different error formats
    result = await engine.execute('throw "Simple string error"');
    assert.strictEqual(result.error, 'Simple string error');

    result = await engine.execute('throw new RangeError("Value out of range")');
    assert.ok(result.error!.includes('RangeError'));
    assert.ok(result.error!.includes('Value out of range'));

    // Custom error objects
    result = await engine.execute(`
      const customError = { 
        name: "CustomError", 
        message: "Custom message",
        customField: "extra data"
      };
      throw customError;
    `);
    assert.ok(result.error!.includes('CustomError'));
    assert.ok(result.error!.includes('Custom message'));
  });

  test('should handle edge cases and special values', async () => {
    // Empty and whitespace code
    let result = await engine.execute('');
    assert.strictEqual(result.error, undefined);
    assert.strictEqual(result.returnValue, undefined);
    assert.strictEqual(result.logs.length, 0);

    result = await engine.execute('   \n\t  ');
    assert.strictEqual(result.returnValue, undefined);

    // Comments only
    result = await engine.execute(`
      // This is a comment
      /* This is also a comment */
    `);
    assert.strictEqual(result.returnValue, undefined);

    // Various primitive types
    result = await engine.execute('null');
    assert.strictEqual(result.returnValue, 'null');

    result = await engine.execute('true');
    assert.strictEqual(result.returnValue, 'true');

    result = await engine.execute('false');
    assert.strictEqual(result.returnValue, 'false');

    result = await engine.execute('undefined');
    assert.strictEqual(result.returnValue, undefined);

    // Complex return value formatting
    result = await engine.execute('({name: "test", value: 42})');
    assert.ok(result.returnValue?.includes('"name": "test"'));
    assert.ok(result.returnValue?.includes('"value": 42'));

    result = await engine.execute('[1, "two", {three: 3}]');
    assert.ok(result.returnValue?.includes('1'));
    assert.ok(result.returnValue?.includes('"two"'));
    assert.ok(result.returnValue?.includes('"three": 3'));

    // Primitive return values
    result = await engine.execute('"hello world"');
    assert.strictEqual(result.returnValue, 'hello world');

    result = await engine.execute('3.14159');
    assert.strictEqual(result.returnValue, '3.14159');
  });

  test('should handle module URL resolution', () => {
    const resolveModuleUrl = (engine as any).resolveModuleUrl.bind(engine);
    
    // Package names
    assert.strictEqual(resolveModuleUrl('react'), 'https://esm.sh/react');
    assert.strictEqual(resolveModuleUrl('lodash@4.17.21'), 'https://esm.sh/lodash@4.17.21');
    assert.strictEqual(resolveModuleUrl('@types/node'), 'https://esm.sh/@types/node');
    
    // HTTP/HTTPS URLs (pass through unchanged)
    assert.strictEqual(
      resolveModuleUrl('https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js'),
      'https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js'
    );
    assert.strictEqual(
      resolveModuleUrl('http://localhost:3000/dist/bundle.js'),
      'http://localhost:3000/dist/bundle.js'
    );
    
    // Paths starting with slash
    assert.strictEqual(resolveModuleUrl('/lodash'), 'https://esm.sh/lodash');
    assert.strictEqual(resolveModuleUrl('/@types/node'), 'https://esm.sh/@types/node');
    assert.strictEqual(resolveModuleUrl('/@angular/core@15.2.0'), 'https://esm.sh/@angular/core@15.2.0');
    assert.strictEqual(resolveModuleUrl('/lodash/debounce'), 'https://esm.sh/lodash/debounce');
    
    // Edge cases
    assert.strictEqual(resolveModuleUrl(''), 'https://esm.sh/');
    assert.strictEqual(resolveModuleUrl('lodash/debounce'), 'https://esm.sh/lodash/debounce');
  });

  test('should handle mixed execution scenarios and resource management', async () => {
    // Code with both logs and return value
    let result = await engine.execute(`
      console.log("Starting calculation");
      const result = 2 + 3;
      console.log("Result is", result);
      result * 2;
    `);
    assert.strictEqual(result.error, undefined);
    assert.strictEqual(result.returnValue, '10');
    assert.strictEqual(result.logs.length, 2);
    assert.strictEqual(result.logs[0].content, 'Starting calculation');
    assert.strictEqual(result.logs[1].content, 'Result is 5');

    // Errors with prior console output
    result = await engine.execute(`
      console.log("This will be logged");
      console.log("This too");
      throw new Error("Something went wrong");
    `);
    assert.ok(result.error!.includes('Something went wrong'));
    assert.strictEqual(result.logs.length, 2);
    assert.strictEqual(result.logs[0].content, 'This will be logged');
    assert.strictEqual(result.logs[1].content, 'This too');

    // Resource cleanup after multiple executions
    for (let i = 0; i < 5; i++) {
      result = await engine.execute(`console.log("Test ${i}"); ${i * 2}`);
      assert.strictEqual(result.error, undefined);
      assert.strictEqual(result.returnValue, String(i * 2));
      assert.strictEqual(result.logs.length, 1);
    }

    // Resource cleanup after errors
    for (let i = 0; i < 3; i++) {
      result = await engine.execute(`console.log("Before error ${i}"); throw new Error("Test error ${i}")`);
      assert.ok(result.error!.includes(`Test error ${i}`));
      assert.strictEqual(result.logs.length, 1);
    }
    
    // Should still work after errors
    result = await engine.execute('console.log("After errors"); 42');
    assert.strictEqual(result.error, undefined);
    assert.strictEqual(result.returnValue, '42');
  });

  test('should handle security limits and performance constraints', async () => {
    // Infinite loops should be interrupted
    let result = await engine.execute(`
      while (true) {
        // This should be interrupted
      }
    `);
    assert.ok(result.error, 'Infinite loop should be interrupted and produce an error');

    // Large numbers
    result = await engine.execute('Number.MAX_SAFE_INTEGER');
    assert.strictEqual(result.returnValue, String(Number.MAX_SAFE_INTEGER));

    // Controlled recursion
    result = await engine.execute(`
      function factorial(n) {
        if (n <= 1) return 1;
        return n * factorial(n - 1);
      }
      factorial(5);
    `);
    assert.strictEqual(result.returnValue, '120');

    // Memory operations within limits
    result = await engine.execute(`
      const arr = new Array(1000).fill(0).map((_, i) => i);
      arr.length;
    `);
    assert.strictEqual(result.returnValue, '1000');

    // Stack operations within limits
    result = await engine.execute(`
      function deepRecursion(n) {
        if (n <= 0) return 0;
        if (n > 100) return n; // Prevent too deep recursion
        return n + deepRecursion(n - 1);
      }
      deepRecursion(10);
    `);
    assert.strictEqual(result.returnValue, '55');

    // Module loading mechanism (basic test)
    result = await engine.execute(`
      try {
        1 + 1; // Basic test that doesn't crash the engine
      } catch (e) {
        console.log("Module loading test");
      }
    `);
    assert.strictEqual(result.returnValue, '2');
  });
});
