import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)
if (args[0] === '--') args.shift()

const result = spawnSync('vp', ['exec', 'playwright', 'test', ...args], {
  stdio: 'inherit',
})

if (result.error) throw result.error
process.exitCode = result.status ?? 1
