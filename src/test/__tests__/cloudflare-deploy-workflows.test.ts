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

  it('deploys preview Workers on a custom domain instead of an origin-backed route', () => {
    const previewWorkflow = readRepoFile('.github/workflows/preview.yml')

    expect(previewWorkflow).toContain(
      '--domain "preview-${{ github.event.pull_request.number }}.wizardarchive.com"',
    )
    expect(previewWorkflow).not.toContain(
      '--route "preview-${{ github.event.pull_request.number }}.wizardarchive.com/*"',
    )
  })

  it('retries preview health checks after transient Cloudflare HTTP errors', () => {
    const previewWorkflow = readRepoFile('.github/workflows/preview.yml')

    expect(previewWorkflow).toContain(
      'curl --fail --show-error --silent --retry 10 --retry-delay 12 --retry-all-errors',
    )
  })
})
