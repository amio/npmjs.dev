/**
 * Simple test script for the Cloudflare Dynamic Workers host.
 * This script expects the worker to be running (e.g., via wrangler dev).
 */

async function testBackend() {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:8787'
  console.log(`Testing backend at ${backendUrl}...`)

  const testCode = `
    const message = "Hello from Cloudflare Dynamic Workers!";
    console.log(message);
    export default message;
  `

  try {
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: testCode })
    })

    if (!response.ok) {
      console.error(`Backend returned ${response.status}: ${await response.text()}`)
      process.exit(1)
    }

    const result = await response.json()
    console.log('Result:', JSON.stringify(result, null, 2))

    if (result.returnValue === '"Hello from Cloudflare Dynamic Workers!"' &&
        result.logs && result.logs.length > 0 &&
        result.logs[0].content === 'Hello from Cloudflare Dynamic Workers!') {
      console.log('✅ Backend test passed!')
    } else {
      console.error('❌ Backend test failed: unexpected result')
      process.exit(1)
    }
  } catch (err) {
    console.error('❌ Backend test failed with error:', err)
    process.exit(1)
  }
}

testBackend()
