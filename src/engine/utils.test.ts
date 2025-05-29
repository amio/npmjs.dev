import assert from 'node:assert';
import { test, describe } from 'node:test';
import { parseModuleDeps } from './utils';

describe('parseModuleDeps', () => {
  describe('import statements', () => {
    test('should parse basic named imports', () => {
      const code = `import { foo, bar } from 'module-name';`;
      const result = parseModuleDeps(code);
      assert.deepStrictEqual(result, ['module-name']);
    });

    test('should parse default imports', () => {
      const code = `import React from 'react';`;
      const result = parseModuleDeps(code);
      assert.deepStrictEqual(result, ['react']);
    });

    test('should parse namespace imports', () => {
      const code = `import * as utils from './utils';`;
      const result = parseModuleDeps(code);
      assert.deepStrictEqual(result, ['./utils']);
    });

    test('should parse namespace imports with alias', () => {
      const code = `import * as lodash from 'lodash';`;
      const result = parseModuleDeps(code);
      assert.deepStrictEqual(result, ['lodash']);
    });

    test('should parse side-effect imports', () => {
      const code = `import 'polyfill';`;
      const result = parseModuleDeps(code);
      assert.deepStrictEqual(result, ['polyfill']);
    });

    test('should parse mixed import styles', () => {
      const code = `import React, { useState, useEffect } from 'react';`;
      const result = parseModuleDeps(code);
      assert.deepStrictEqual(result, ['react']);
    });

    test('should handle different quote types for imports', () => {
      const code = `
        import { foo } from "double-quotes";
        import { bar } from 'single-quotes';
        import { baz } from \`template-quotes\`;
      `;
      const result = parseModuleDeps(code);
      assert.deepStrictEqual(result.sort(), ['double-quotes', 'single-quotes', 'template-quotes']);
    });
  });

  describe('export statements', () => {
    test('should parse export from statements', () => {
      const code = `export { foo, bar } from 'source-module';`;
      const result = parseModuleDeps(code);
      assert.deepStrictEqual(result, ['source-module']);
    });

    test('should parse export all from statements', () => {
      const code = `export * from 'utils';`;
      const result = parseModuleDeps(code);
      assert.deepStrictEqual(result, ['utils']);
    });

    test('should parse export all with alias from statements', () => {
      const code = `export * as helpers from './helpers';`;
      const result = parseModuleDeps(code);
      assert.deepStrictEqual(result, ['./helpers']);
    });

    test('should ignore regular exports without from clause', () => {
      const code = `
        export const foo = 'bar';
        export function baz() {}
        export default something;
      `;
      const result = parseModuleDeps(code);
      assert.deepStrictEqual(result, []);
    });

    test('should handle different quote types for exports', () => {
      const code = `
        export { foo } from "double-quotes";
        export * from 'single-quotes';
        export { bar } from \`template-quotes\`;
      `;
      const result = parseModuleDeps(code);
      assert.deepStrictEqual(result.sort(), ['double-quotes', 'single-quotes', 'template-quotes']);
    });
  });

  describe('mixed imports and exports', () => {
    test('should parse both imports and exports', () => {
      const code = `
        import React from 'react';
        import { useState } from 'react';
        export { utils } from './utils';
        export * from './helpers';
      `;
      const result = parseModuleDeps(code);
      assert.deepStrictEqual(result.sort(), ['./helpers', './utils', 'react']);
    });

    test('should deduplicate module names', () => {
      const code = `
        import { foo } from 'lodash';
        import { bar } from 'lodash';
        export { baz } from 'lodash';
      `;
      const result = parseModuleDeps(code);
      assert.deepStrictEqual(result, ['lodash']);
    });
  });

  describe('edge cases', () => {
    test('should handle empty code', () => {
      const result = parseModuleDeps('');
      assert.deepStrictEqual(result, []);
    });

    test('should handle code without imports or exports', () => {
      const code = `
        const foo = 'bar';
        function baz() {
          return 'hello world';
        }
      `;
      const result = parseModuleDeps(code);
      assert.deepStrictEqual(result, []);
    });

    test('should handle multiline imports', () => {
      const code = `
        import {
          foo,
          bar,
          baz
        } from 'multi-line-module';
      `;
      const result = parseModuleDeps(code);
      assert.deepStrictEqual(result, ['multi-line-module']);
    });

    test('should handle imports with comments', () => {
      const code = `
        // This is a comment
        import { foo } from 'commented-module'; // Another comment
        /* Block comment */
        export { bar } from 'another-module';
      `;
      const result = parseModuleDeps(code);
      assert.deepStrictEqual(result.sort(), ['another-module', 'commented-module']);
    });

    test('should handle relative paths', () => {
      const code = `
        import { foo } from './relative';
        import { bar } from '../parent';
        import { baz } from '../../grandparent';
        export * from './sibling';
      `;
      const result = parseModuleDeps(code);
      assert.deepStrictEqual(result.sort(), ['../../grandparent', '../parent', './relative', './sibling']);
    });

    test('should handle scoped packages', () => {
      const code = `
        import { Component } from '@company/ui-kit';
        export { utils } from '@org/utils';
      `;
      const result = parseModuleDeps(code);
      assert.deepStrictEqual(result.sort(), ['@company/ui-kit', '@org/utils']);
    });

    test('should handle complex mixed scenario', () => {
      const code = `
        import React, { useState, useEffect } from 'react';
        import * as lodash from 'lodash';
        import { debounce } from 'lodash';
        import './styles.css';
        import api from '../api/client';
        
        export { formatDate } from './date-utils';
        export * as validators from './validators';
        export * from '@shared/constants';
        
        const component = () => {
          // Component code here
        };
        
        export default component;
      `;
      const result = parseModuleDeps(code);
      assert.deepStrictEqual(result.sort(), [
        '../api/client',
        './date-utils',
        './styles.css',
        './validators',
        '@shared/constants',
        'lodash',
        'react'
      ]);
    });
  });

  describe('invalid or malformed code', () => {
    test('should handle incomplete import statements gracefully', () => {
      const code = `
        import { foo from 'incomplete';
        import from 'also-incomplete';
      `;
      const result = parseModuleDeps(code);
      assert.deepStrictEqual(result, []);
    });

    test('should handle mixed valid and invalid statements', () => {
      const code = `
        import { valid } from 'valid-module';
        import { invalid from 'invalid-syntax';
        export { another } from 'another-valid';
      `;
      const result = parseModuleDeps(code);
      assert.deepStrictEqual(result.sort(), ['another-valid', 'valid-module']);
    });
  });
});
