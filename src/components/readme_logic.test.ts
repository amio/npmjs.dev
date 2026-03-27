import assert from 'node:assert'
import { test } from 'node:test'

test('markdownContent regex correctly replaces <br> tags with two spaces and \\n', () => {
  const content = 'Line 1<br>Line 2<br />Line 3 <BR> Line 4 <br  /> Line 5'
  const expected = 'Line 1  \nLine 2  \nLine 3   \n Line 4   \n Line 5'
  const result = content.replace(/<br\s*\/?>/gi, '  \n')
  assert.strictEqual(result, expected)
})
