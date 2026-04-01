import assert from 'node:assert'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Output } from './output'

test('shows an empty-state placeholder after a successful execution with no logs', () => {
  const html = renderToStaticMarkup(
    React.createElement(Output, { logs: [], hasExecuted: true, error: undefined, isLoading: false })
  )

  assert.match(html, /No output/)
  assert.match(html, /Execution finished without console logs or errors\./)
})

test('does not show the empty-state placeholder before the first execution', () => {
  const html = renderToStaticMarkup(
    React.createElement(Output, { logs: [], hasExecuted: false, error: undefined, isLoading: false })
  )

  assert.doesNotMatch(html, /No output/)
})
