import { execFileSync, spawn } from 'node:child_process'

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const workerHealthUrl = 'http://127.0.0.1:8787/api/engines/cloudflare'

async function hasHealthyWorker() {
  try {
    const response = await fetch(workerHealthUrl)
    return response.ok
  } catch {
    return false
  }
}

if (await hasHealthyWorker()) {
  console.log(`Reusing existing Cloudflare worker at ${workerHealthUrl}`)
  process.exit(0)
}

execFileSync(npmCommand, ['run', 'build'], {
  stdio: 'inherit',
})

if (await hasHealthyWorker()) {
  console.log(`Cloudflare worker became available during startup at ${workerHealthUrl}`)
  process.exit(0)
}

const wranglerProcess = spawn(npxCommand, ['wrangler', 'dev', '--port', '8787'], {
  stdio: 'inherit',
})

wranglerProcess.on('exit', code => {
  process.exit(code ?? 0)
})
