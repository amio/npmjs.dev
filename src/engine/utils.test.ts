import assert from 'node:assert'
import { test, describe } from 'node:test'
import { parseModuleDeps } from './utils'

describe('parseModuleDeps', () => {
  test('should parse all import syntax variations', () => {
    const code = `
      import { foo, bar } from 'module-name';
      import React from 'react';
      import * as utils from './utils';
      import 'polyfill';
      import React2, { useState, useEffect } from 'react2';
      import { baz } from "double-quotes";
      import { qux } from \`template-quotes\`;
    `
    const result = parseModuleDeps(code)
    assert.deepStrictEqual(result.sort(), [
      './utils',
      'double-quotes',
      'module-name',
      'polyfill',
      'react',
      'react2',
      'template-quotes',
    ])
  })

  test('should parse all export syntax variations', () => {
    const code = `
      export { foo, bar } from 'source-module';
      export * from 'utils';
      export * as helpers from './helpers';
      export { baz } from "double-quotes";
      export * from \`template-quotes\`;
      
      // These should be ignored (no 'from' clause)
      export const foo = 'bar';
      export function baz() {}
      export default something;
    `
    const result = parseModuleDeps(code)
    assert.deepStrictEqual(result.sort(), ['./helpers', 'double-quotes', 'source-module', 'template-quotes', 'utils'])
  })

  test('should handle mixed imports/exports and deduplication', () => {
    const code = `
      import React from 'react';
      import { useState } from 'react';
      import { foo } from 'lodash';
      export { utils } from './utils';
      export * from './helpers';
      export { bar } from 'lodash';
    `
    const result = parseModuleDeps(code)
    assert.deepStrictEqual(result.sort(), ['./helpers', './utils', 'lodash', 'react'])
  })

  test('should handle edge cases and special scenarios', () => {
    const code = `
      // Multiline import
      import {
        foo,
        bar,
        baz
      } from 'multi-line-module';
      
      // Comments should not interfere
      import { foo } from 'commented-module'; // Comment
      /* Block comment */ export { bar } from 'another-module';
      
      // Relative paths
      import { foo } from './relative';
      import { bar } from '../parent';
      export * from '../../grandparent';
      
      // Scoped packages
      import { Component } from '@company/ui-kit';
      export { utils } from '@org/utils';
    `
    const result = parseModuleDeps(code)
    assert.deepStrictEqual(result.sort(), [
      '../../grandparent',
      '../parent',
      './relative',
      '@company/ui-kit',
      '@org/utils',
      'another-module',
      'commented-module',
      'multi-line-module',
    ])
  })

  test('should handle empty and invalid code gracefully', () => {
    // Empty code
    assert.deepStrictEqual(parseModuleDeps(''), [])

    // Code without imports/exports
    const noImports = `
      const foo = 'bar';
      function baz() { return 'hello'; }
    `
    assert.deepStrictEqual(parseModuleDeps(noImports), [])

    // Mixed valid and invalid syntax
    const mixedCode = `
      import { valid } from 'valid-module';
      import { invalid from 'invalid-syntax';
      export { another } from 'another-valid';
    `
    assert.deepStrictEqual(parseModuleDeps(mixedCode).sort(), ['another-valid', 'valid-module'])
  })

  test('should handle comprehensive real-world scenario', () => {
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
    `
    const result = parseModuleDeps(code)
    assert.deepStrictEqual(result.sort(), [
      '../api/client',
      './date-utils',
      './styles.css',
      './validators',
      '@shared/constants',
      'lodash',
      'react',
    ])
  })
})
