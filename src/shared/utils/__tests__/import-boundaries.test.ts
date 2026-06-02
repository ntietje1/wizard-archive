import { describe, expect, it } from 'vite-plus/test'

const boundaryModule = await import('../../../../scripts/import-boundaries.mjs')

const {
  analyzeImportBoundaries,
}: {
  analyzeImportBoundaries: (files: Array<{ filePath: string; source: string }>) => Array<string>
} = boundaryModule

describe('import boundary checks', () => {
  it('allows generated Convex API imports from src', () => {
    expect(
      analyzeImportBoundaries([
        {
          filePath: 'src/example.ts',
          source: [
            "import { api } from 'convex/_generated/api'",
            "import type { Id } from 'convex/_generated/dataModel'",
          ].join('\n'),
        },
      ]),
    ).toEqual([])
  })

  it('blocks legacy Convex DTO type imports from src', () => {
    expect(
      analyzeImportBoundaries([
        {
          filePath: 'src/example.ts',
          source: [
            "import type { AnySidebarItem } from 'convex/sidebarItems/types/types'",
            "import type { GameMap } from 'convex/gameMaps/types'",
          ].join('\n'),
        },
      ]),
    ).toEqual([
      'src/example.ts:1 src may not import type from local Convex module convex/sidebarItems/types/types',
      'src/example.ts:2 src may not import type from local Convex module convex/gameMaps/types',
    ])
  })

  it('blocks runtime imports from local Convex modules', () => {
    expect(
      analyzeImportBoundaries([
        {
          filePath: 'src/example.ts',
          source: "import { validatePinDropTarget } from 'convex/gameMaps/validation'",
        },
      ]),
    ).toEqual([
      'src/example.ts:1 src may not import value from local Convex module convex/gameMaps/validation',
    ])
  })

  it('blocks side-effect imports from local Convex modules', () => {
    expect(
      analyzeImportBoundaries([
        {
          filePath: 'src/example.ts',
          source: "import 'convex/gameMaps/validation'",
        },
      ]),
    ).toEqual([
      'src/example.ts:1 src may not import value from local Convex module convex/gameMaps/validation',
    ])
  })

  it('blocks dynamic imports from local Convex modules', () => {
    expect(
      analyzeImportBoundaries([
        {
          filePath: 'src/example.ts',
          source: "const validation = await import('convex/gameMaps/validation')",
        },
      ]),
    ).toEqual([
      'src/example.ts:1 src may not import value from local Convex module convex/gameMaps/validation',
    ])
  })

  it('blocks require calls from local Convex modules', () => {
    expect(
      analyzeImportBoundaries([
        {
          filePath: 'src/example.cjs',
          source: "const validation = require('convex/gameMaps/validation')",
        },
      ]),
    ).toEqual([
      'src/example.cjs:1 src may not import value from local Convex module convex/gameMaps/validation',
    ])
  })

  it('blocks type import expressions from local Convex modules', () => {
    expect(
      analyzeImportBoundaries([
        {
          filePath: 'src/example.ts',
          source: "type GameMap = import('convex/gameMaps/types').GameMap",
        },
      ]),
    ).toEqual([
      'src/example.ts:1 src may not import type from local Convex module convex/gameMaps/types',
    ])
  })

  it('blocks P01.1 contract families from returning to src imports', () => {
    expect(
      analyzeImportBoundaries([
        {
          filePath: 'src/example.ts',
          source: [
            "import type { ClientError } from 'convex/errors'",
            "import { MAX_FILE_SIZE } from 'convex/storage/validation'",
            "import type { FileSystemCommand } from 'convex/sidebarItems/filesystem/commands'",
          ].join('\n'),
        },
      ]),
    ).toEqual([
      'src/example.ts:1 src may not import type from local Convex module convex/errors',
      'src/example.ts:2 src may not import value from local Convex module convex/storage/validation',
      'src/example.ts:3 src may not import type from local Convex module convex/sidebarItems/filesystem/commands',
    ])
  })

  it('blocks shared from importing convex or src modules', () => {
    expect(
      analyzeImportBoundaries([
        {
          filePath: 'shared/example.ts',
          source: [
            "import { api } from 'convex/_generated/api'",
            "import { useEditor } from '../src/features/editor/useEditor'",
          ].join('\n'),
        },
      ]),
    ).toEqual([
      'shared/example.ts:1 shared may not import value from convex boundary module convex/_generated/api',
      'shared/example.ts:2 shared may not import value from src boundary module ../src/features/editor/useEditor',
    ])
  })

  it('blocks convex from importing src modules', () => {
    expect(
      analyzeImportBoundaries([
        {
          filePath: 'convex/yjsSync/__tests__/makeYjsUpdate.helper.ts',
          source: "import { blocksToYDoc } from '../../../src/features/editor/blocknote-yjs'",
        },
      ]),
    ).toEqual([
      'convex/yjsSync/__tests__/makeYjsUpdate.helper.ts:1 convex may not import value from src boundary module ../../../src/features/editor/blocknote-yjs',
    ])
  })

  it('allows convex to import shared contracts', () => {
    expect(
      analyzeImportBoundaries([
        {
          filePath: 'convex/example.ts',
          source: "import { SIDEBAR_ITEM_STATUS } from '../shared/sidebar-items/types'",
        },
      ]),
    ).toEqual([])
  })

  it('reports disallowed src imports with file and line details', () => {
    expect(
      analyzeImportBoundaries([
        {
          filePath: 'src/example.ts',
          source: [
            "import { api } from 'convex/_generated/api'",
            "import type { AnySidebarItem } from 'shared/sidebar-items/model-types'",
            "import { validatePinDropTarget } from 'convex/gameMaps/validation'",
          ].join('\n'),
        },
      ]),
    ).toEqual([
      'src/example.ts:3 src may not import value from local Convex module convex/gameMaps/validation',
    ])
  })

  it('does not treat import-like strings as import declarations', () => {
    expect(
      analyzeImportBoundaries([
        {
          filePath: 'src/example.test.ts',
          source: [
            'const source = [',
            '  "import { validatePinDropTarget } from \'convex/gameMaps/validation\'",',
            "].join('\\n')",
          ].join('\n'),
        },
      ]),
    ).toEqual([])
  })
})
