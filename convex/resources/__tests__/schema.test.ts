import { describe, expect, it } from 'vite-plus/test'
import { RESOURCE_COMMAND_PROTOCOL_VERSION } from '@wizard-archive/editor/resources/command-protocol'
import { VERSION_SCHEME } from '@wizard-archive/editor/resources/component-version'
import { resourceCommandReceiptValidator, resourceTables, versionStampValidator } from '../schema'

describe('canonical resource schema', () => {
  it('defines one UUID catalog with retained versions, receipts, tombstones, aliases, and assets', () => {
    expect(resourceTables).toEqual(
      expect.objectContaining({
        resources: expect.anything(),
        resourceTombstones: expect.anything(),
        resourceTransferEntries: expect.anything(),
        resourceTransferJobs: expect.anything(),
        resourceSourcePathAliases: expect.anything(),
        resourceAssetsFolders: expect.anything(),
        resourceOperations: expect.anything(),
        resourceCanvasContents: expect.anything(),
        resourceFileContents: expect.anything(),
        resourceMapContents: expect.anything(),
        resourceMapPins: expect.anything(),
        resourceNoteContents: expect.anything(),
      }),
    )
    expect(versionStampValidator).toBeTruthy()
    expect(resourceCommandReceiptValidator).toBeTruthy()
    expect(VERSION_SCHEME).toBe('authoritative-revision-v1')
    expect(RESOURCE_COMMAND_PROTOCOL_VERSION).toBe('resource-command-v1')
  })
})
