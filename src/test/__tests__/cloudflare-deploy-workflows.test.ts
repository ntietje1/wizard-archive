import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vite-plus/test'

const repoRoot = resolve(import.meta.dirname, '../../..')

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), 'utf8')
}

describe('Cloudflare deployment workflows', () => {
  it('deploys the generated Worker build artifact instead of the source config', () => {
    const deployWorkflow = readRepoFile('.github/workflows/deploy.yml')
    const previewWorkflow = readRepoFile('.github/workflows/preview.yml')

    expect(deployWorkflow).toMatch(/wrangler deploy[\s\S]*--config dist\/server\/wrangler\.json/)
    expect(previewWorkflow).toMatch(/wrangler deploy[\s\S]*--config dist\/server\/wrangler\.json/)
  })

  it('health checks production and rolls back failed deploys', () => {
    const deployWorkflow = readRepoFile('.github/workflows/deploy.yml')

    expect(deployWorkflow).toContain('curl --fail')
    expect(deployWorkflow).toContain('wrangler rollback --name wizard-archive')
  })
})
