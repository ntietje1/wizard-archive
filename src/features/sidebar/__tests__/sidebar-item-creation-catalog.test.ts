import { describe, expect, it } from 'vitest'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import { SIDEBAR_ITEM_CREATION_COMMANDS } from '../sidebar-item-creation-catalog'

describe('SIDEBAR_ITEM_CREATION_COMMANDS', () => {
  it('defines one ordered creation command for every supported sidebar item type', () => {
    expect(
      SIDEBAR_ITEM_CREATION_COMMANDS.map((command) => ({
        id: command.id,
        key: command.key,
        type: command.type,
        label: command.label,
      })),
    ).toEqual([
      {
        id: 'create.note',
        key: 'note',
        type: SIDEBAR_ITEM_TYPES.notes,
        label: 'Note',
      },
      {
        id: 'create.folder',
        key: 'folder',
        type: SIDEBAR_ITEM_TYPES.folders,
        label: 'Folder',
      },
      {
        id: 'create.map',
        key: 'map',
        type: SIDEBAR_ITEM_TYPES.gameMaps,
        label: 'Map',
      },
      {
        id: 'create.canvas',
        key: 'canvas',
        type: SIDEBAR_ITEM_TYPES.canvases,
        label: 'Canvas',
      },
      {
        id: 'create.file',
        key: 'file',
        type: SIDEBAR_ITEM_TYPES.files,
        label: 'File',
      },
    ])
  })
})
