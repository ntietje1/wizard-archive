import { describe, expect, it } from 'vite-plus/test'
import { createResourceCatalogModel } from '../../filesystem/catalog'
import { NOTE_EDITOR_DROP_TYPE, resolveDropTarget } from '../drop-target-data'

function testCatalog() {
  return createResourceCatalogModel({ activeItems: [], trashItems: [] }).catalog
}

describe('resolveDropTarget', () => {
  it('returns null for targets owned by a different runtime when a runtime is provided', () => {
    const raw = {
      type: NOTE_EDITOR_DROP_TYPE,
      noteId: 'note_1',
      __wizardArchiveDndRuntimeId: 'runtime-a',
    }

    expect(resolveDropTarget(raw, testCatalog(), { runtimeId: 'runtime-b' })).toBeNull()
    expect(resolveDropTarget(raw, testCatalog(), { runtimeId: 'runtime-a' })).toEqual(raw)
  })
})
