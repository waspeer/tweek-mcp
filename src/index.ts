import process from 'node:process'

async function start(): Promise<void> {
  const nodeVersion = process.version
  const now = new Date().toISOString()
  // Minimal stub; real bootstrap comes later in Task 5
  console.warn(`[tweek-mcp] dev stub started at ${now} (node ${nodeVersion})`)
}

start().catch((error) => {
  console.error('[tweek-mcp] fatal error during startup', error)
  process.exitCode = 1
})
