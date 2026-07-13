import { describe, expect, it } from 'vite-plus/test'
import { RESOURCE_TYPES } from '../../items-persistence-contract'
import {
  SIDEBAR_ITEM_CREATION_COMMAND_BY_ID,
  SIDEBAR_ITEM_CREATION_COMMANDS,
} from '../creation-catalog'

describe('SIDEBAR_ITEM_CREATION_COMMANDS', () => {
  it('defines one ordered creation command for every supported sidebar item type', () => {
    const keys = SIDEBAR_ITEM_CREATION_COMMANDS.map((command) => command.key)

    expect(keys).toEqual(['note', 'folder', 'map', 'canvas', 'file'])
    expect(SIDEBAR_ITEM_CREATION_COMMANDS.map((command) => command.id)).toEqual(
      keys.map((key) => `create.${key}`),
    )
    expect(SIDEBAR_ITEM_CREATION_COMMANDS.map((command) => command.type)).toEqual([
      RESOURCE_TYPES.notes,
      RESOURCE_TYPES.folders,
      RESOURCE_TYPES.gameMaps,
      RESOURCE_TYPES.canvases,
      RESOURCE_TYPES.files,
    ])
    expect(SIDEBAR_ITEM_CREATION_COMMAND_BY_ID['create.map']).toMatchObject({
      label: 'Map',
      type: RESOURCE_TYPES.gameMaps,
      defaultName: 'Untitled Map',
    })
    expect(Object.values(SIDEBAR_ITEM_CREATION_COMMAND_BY_ID)).toEqual(
      SIDEBAR_ITEM_CREATION_COMMANDS,
    )
  })
})
