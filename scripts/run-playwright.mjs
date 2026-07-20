import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)
if (args[0] === '--') args.shift()
const productCanvasPerformanceIndex = args.indexOf('--product-canvas-performance')
const isProductCanvasPerformance = productCanvasPerformanceIndex !== -1
if (isProductCanvasPerformance) args.splice(productCanvasPerformanceIndex, 1)

const playwrightArgs = isProductCanvasPerformance
  ? ['e2e/editor-canvas-performance.spec.ts', ...args, '--workers=1']
  : args
const result = spawnSync('vp', ['exec', 'playwright', 'test', ...playwrightArgs], {
  env: isProductCanvasPerformance
    ? { ...process.env, WA_CANVAS_PERFORMANCE_TARGET: 'product' }
    : process.env,
  stdio: 'inherit',
})

if (result.error) throw result.error
process.exitCode = result.status ?? 1
