import { describe, expect, it } from 'vite-plus/test'
import { initialVersion } from '../component-version'
import {
  advanceFileContentVersion,
  advanceNoteContentVersion,
  fileContentDigest,
  initialFileContentVersion,
  initialNoteContentVersion,
  noteContentDigest,
} from '../resource-content-version'
import type { FileOwnedMetadata } from '../file-content-contract'

const fileMetadata: FileOwnedMetadata = {
  classification: 'viewable_image',
  byteSize: 4,
  detectedFormat: 'png',
  extension: 'png',
  mediaType: 'image/png',
  viewerUnavailableReason: null,
}

describe('resource content versions', () => {
  it('golden-tests exact note-content-v1 digest bytes', async () => {
    const update = new Uint8Array([0, 1, 2, 255])
    const digest = await noteContentDigest(update)

    expect(digest).toBe('6827cb419a6ade69f6ede4eef05b80384d65463d349c206315b74fc52ee63fae')
    await expect(initialNoteContentVersion(update)).resolves.toEqual({
      scheme: 'authoritative-revision-v1',
      revision: 1,
      digest,
    })
  })

  it('golden-tests exact file-content-v1 bytes and file-owned metadata', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71])
    const digest = await fileContentDigest(bytes, fileMetadata)

    expect(digest).toBe('f6100b0b19c3373bd259958146243345bfd462d6a19c948980ae3fc1160ccc68')
    await expect(initialFileContentVersion(bytes, fileMetadata)).resolves.toEqual({
      scheme: 'authoritative-revision-v1',
      revision: 1,
      digest,
    })
    await expect(fileContentDigest(bytes, { ...fileMetadata, byteSize: 3 })).rejects.toThrow(
      'File byte size does not match canonical metadata',
    )
  })

  it('advances only when canonical content changes', async () => {
    const noteUpdate = new Uint8Array([1])
    const note = await initialNoteContentVersion(noteUpdate)
    await expect(advanceNoteContentVersion(note, noteUpdate)).resolves.toBe(note)
    await expect(advanceNoteContentVersion(note, new Uint8Array([2]))).resolves.toMatchObject({
      revision: 2,
    })

    const bytes = new Uint8Array([137, 80, 78, 71])
    const file = initialVersion(await fileContentDigest(bytes, fileMetadata))
    await expect(advanceFileContentVersion(file, bytes, fileMetadata)).resolves.toBe(file)
    await expect(
      advanceFileContentVersion(file, bytes, { ...fileMetadata, extension: null }),
    ).resolves.toMatchObject({ revision: 2 })
  })
})
