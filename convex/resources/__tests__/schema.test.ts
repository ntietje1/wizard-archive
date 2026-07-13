import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vite-plus/test'
import { RESOURCE_COMMAND_PROTOCOL_VERSION } from '@wizard-archive/editor/resources/command-protocol'
import { VERSION_SCHEME } from '@wizard-archive/editor/resources/component-version'
import { resourceCommandReceiptValidator, resourceTables, versionStampValidator } from '../schema'

describe('canonical resource schema', () => {
  it('defines one UUID catalog with retained versions, receipts, tombstones, aliases, and roles', () => {
    expect(resourceTables).toEqual(
      expect.objectContaining({
        resources: expect.anything(),
        resourceTombstones: expect.anything(),
        resourceSourcePathAliases: expect.anything(),
        resourceRoles: expect.anything(),
        resourceOperations: expect.anything(),
        resourceContentVersions: expect.anything(),
      }),
    )
    expect(versionStampValidator).toBeTruthy()
    expect(resourceCommandReceiptValidator).toBeTruthy()
    expect(VERSION_SCHEME).toBe('authoritative-revision-v1')
    expect(RESOURCE_COMMAND_PROTOCOL_VERSION).toBe('resource-command-v1')
  })

  it('keeps provider identity and superseded protocol fields outside canonical rows', () => {
    const source = readFileSync('convex/resources/schema.ts', 'utf8')
    expect(source).not.toMatch(
      /v\.id\(|providerCursor|clientFingerprint|ifMatch|inverse|undoable|campaignSequence|slug/,
    )
  })
})
