import { describe, expect, it } from 'vitest'
import { createTestWorkspaceRuntime } from '../workspace-runtime-factory'
import { createNote } from '../sidebar-item-factory'
import { RESOURCE_TYPES } from '../../workspace/items-persistence-contract'

describe('createTestWorkspaceRuntime', () => {
  it('requires tests to provide filesystem mutation operations before using them', () => {
    const item = createNote()
    const runtime = createTestWorkspaceRuntime({ item })
    const operations = runtime.filesystem.operations

    expect(() =>
      operations.createItem({
        type: RESOURCE_TYPES.notes,
        parentTarget: { kind: 'direct', parentId: null },
      }),
    ).toThrow('Test workspace runtime operation "createItem" was used without an implementation')
    expect(() => operations.updateItemMetadata({ item, name: 'Renamed' })).toThrow(
      'Test workspace runtime operation "updateItemMetadata" was used without an implementation',
    )
    expect(() => operations.executeDropCommand({ type: 'trash', itemIds: [item.id] })).toThrow(
      'Test workspace runtime operation "executeDropCommand" was used without an implementation',
    )
    expect(() => operations.toggleBookmarks([item.id])).toThrow(
      'Test workspace runtime operation "toggleBookmarks" was used without an implementation',
    )
    expect(() => operations.trashItems([item.id])).toThrow(
      'Test workspace runtime operation "trashItems" was used without an implementation',
    )
    expect(() => operations.restoreItems([item.id], null)).toThrow(
      'Test workspace runtime operation "restoreItems" was used without an implementation',
    )
    expect(() => operations.requestDeleteItemsForever([item.id])).toThrow(
      'Test workspace runtime operation "requestDeleteItemsForever" was used without an implementation',
    )
    expect(() => operations.requestEmptyTrash()).toThrow(
      'Test workspace runtime operation "requestEmptyTrash" was used without an implementation',
    )
    expect(() => operations.pasteIntoTarget({ clickedItem: item })).toThrow(
      'Test workspace runtime operation "pasteIntoTarget" was used without an implementation',
    )
    expect(() =>
      operations.importFile({
        file: {
          name: 'notes.txt',
          contentType: 'text/plain',
          size: 5,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(5)),
          text: () => Promise.resolve('notes'),
        },
        parentId: null,
      }),
    ).toThrow('Test workspace runtime operation "importFile" was used without an implementation')
    expect(() => operations.importDrop({ files: [], rootFolders: [], parentId: null })).toThrow(
      'Test workspace runtime operation "importDrop" was used without an implementation',
    )
  })
})
