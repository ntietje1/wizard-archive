import { spawnSync } from 'node:child_process'

const result = spawnSync('vp', ['exec', 'playwright', 'test', ...process.argv.slice(2)], {
  stdio: 'inherit',
})

if (result.error) throw result.error
process.exitCode = result.status ?? 1
