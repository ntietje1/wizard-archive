import { describe, expect, it } from 'vite-plus/test'

const boundaryModule = await import('../../../../scripts/import-boundaries.mjs')

const {
  analyzeImportBoundaries,
}: {
  analyzeImportBoundaries: (files: Array<{ filePath: string; source: string }>) => Array<string>
} = boundaryModule

describe('import boundary checks', () => {
  it('allows generated Convex contracts only at explicit frontend provider boundaries', () => {
    expect(
      analyzeImportBoundaries([
        {
          filePath: 'src/example.ts',
          source: [
            "import { api } from 'convex/_generated/api'",
            "import type { Id } from 'convex/_generated/dataModel'",
          ].join('\n'),
        },
        {
          filePath: 'src/features/example/hooks/use-example.ts',
          source: "import { api } from 'convex/_generated/api'",
        },
        {
          filePath: 'src/editor-adapters/live/example.ts',
          source: "import type { Id } from 'convex/_generated/dataModel'",
        },
      ]),
    ).toEqual([
      'src/example.ts:1 src may import generated Convex API values only from explicit data-boundary modules',
      'src/example.ts:2 src may import generated Convex data-model types only from explicit provider boundaries',
    ])
  })

  it('blocks type imports from local Convex modules', () => {
    expect(
      analyzeImportBoundaries([
        {
          filePath: 'src/example.ts',
          source: [
            "import type { PrivateResource } from 'convex/resources/privateTypes'",
            "import type { MapItem } from 'convex/gameMaps/types'",
          ].join('\n'),
        },
      ]),
    ).toEqual([
      'src/example.ts:1 src may not import type from local Convex module convex/resources/privateTypes',
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

  it('blocks tilde alias traversal into local Convex modules', () => {
    expect(
      analyzeImportBoundaries([
        {
          filePath: 'src/example.ts',
          source: "import { validatePinDropTarget } from '~/../convex/gameMaps/validation'",
        },
      ]),
    ).toEqual([
      'src/example.ts:1 src may not import value from local Convex module ~/../convex/gameMaps/validation',
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

  it('blocks TypeScript import assignments from local Convex modules', () => {
    expect(
      analyzeImportBoundaries([
        {
          filePath: 'src/example.cts',
          source: "import validation = require('convex/gameMaps/validation')",
        },
      ]),
    ).toEqual([
      'src/example.cts:1 src may not import value from local Convex module convex/gameMaps/validation',
    ])
  })

  it('blocks type import expressions from local Convex modules', () => {
    expect(
      analyzeImportBoundaries([
        {
          filePath: 'src/example.ts',
          source: "type MapItem = import('convex/gameMaps/types').MapItem",
        },
      ]),
    ).toEqual([
      'src/example.ts:1 src may not import type from local Convex module convex/gameMaps/types',
    ])
  })

  it('blocks shared from importing convex or src modules', () => {
    expect(
      analyzeImportBoundaries([
        {
          filePath: 'shared/example.ts',
          source: [
            "import { api } from 'convex/_generated/api'",
            "import { useLiveWorkspaceRuntime } from '../src/editor-adapters/live/use-live-workspace-runtime'",
          ].join('\n'),
        },
      ]),
    ).toEqual([
      'shared/example.ts:1 shared may not import value from convex boundary module convex/_generated/api',
      'shared/example.ts:2 shared may not import value from src boundary module ../src/editor-adapters/live/use-live-workspace-runtime',
    ])
  })

  it('blocks shared from importing ui package modules', () => {
    expect(
      analyzeImportBoundaries([
        {
          filePath: 'shared/example.ts',
          source: "import { Button } from '@wizard-archive/ui/shadcn/components/button'",
        },
      ]),
    ).toEqual([
      'shared/example.ts:1 shared may not import value from ui-package boundary module @wizard-archive/ui/shadcn/components/button',
    ])
  })

  it('blocks convex from importing src modules', () => {
    expect(
      analyzeImportBoundaries([
        {
          filePath: 'convex/_test/yjs.helper.ts',
          source:
            "import { useLiveWorkspaceRuntime } from '../../src/editor-adapters/live/use-live-workspace-runtime'",
        },
      ]),
    ).toEqual([
      'convex/_test/yjs.helper.ts:1 convex may not import value from src boundary module ../../src/editor-adapters/live/use-live-workspace-runtime',
    ])
  })

  it('blocks convex from importing ui package modules', () => {
    expect(
      analyzeImportBoundaries([
        {
          filePath: 'convex/functions.ts',
          source: "import { Button } from '@wizard-archive/ui/shadcn/components/button'",
        },
      ]),
    ).toEqual([
      'convex/functions.ts:1 convex may not import value from ui-package boundary module @wizard-archive/ui/shadcn/components/button',
    ])
  })

  it('blocks production convex from backend-unsafe editor package subpaths', () => {
    expect(
      analyzeImportBoundaries([
        {
          filePath: 'convex/gameMaps/functions/createItemPins.ts',
          source: "import { planMapPinCreations } from '@wizard-archive/editor/game-maps'",
        },
        {
          filePath: 'convex/canvases/functions/enhanceCanvas.ts',
          source: "import type { CanvasItem } from '@wizard-archive/editor/canvas/item-contract'",
        },
        {
          filePath: 'convex/canvases/functions/createCanvas.ts',
          source:
            "import { createCanvasDocumentDoc } from '@wizard-archive/editor/canvas/document-contract'",
        },
        {
          filePath: 'convex/notes/functions/enhanceNote.ts',
          source: "import type { NoteItem } from '@wizard-archive/editor/notes'",
        },
        {
          filePath: 'convex/notes/functions/importText.ts',
          source:
            "import { createImportedTextNotePayload } from '@wizard-archive/editor/notes/imported-text'",
        },
      ]),
    ).toEqual([
      'convex/gameMaps/functions/createItemPins.ts:1 convex may not import value from backend-unsafe editor package subpath @wizard-archive/editor/game-maps',
      'convex/canvases/functions/enhanceCanvas.ts:1 convex may not import type from backend-unsafe editor package subpath @wizard-archive/editor/canvas/item-contract',
      'convex/notes/functions/enhanceNote.ts:1 convex may not import type from backend-unsafe editor package subpath @wizard-archive/editor/notes',
      'convex/notes/functions/importText.ts:1 convex may not import value from backend-unsafe editor package subpath @wizard-archive/editor/notes/imported-text',
    ])
  })

  it('reports disallowed src imports with file and line details', () => {
    expect(
      analyzeImportBoundaries([
        {
          filePath: 'src/example.ts',
          source: [
            "import { api } from 'convex/_generated/api'",
            "import type { AnyItem } from '@wizard-archive/editor/resources/items'",
            "import { validatePinDropTarget } from 'convex/gameMaps/validation'",
          ].join('\n'),
        },
      ]),
    ).toEqual([
      'src/example.ts:1 src may import generated Convex API values only from explicit data-boundary modules',
      'src/example.ts:3 src may not import value from local Convex module convex/gameMaps/validation',
    ])
  })

  it('allows editor adapters to import declared public package entries', () => {
    expect(
      analyzeImportBoundaries([
        {
          filePath: 'src/editor-adapters/live/example.ts',
          source: [
            "import { ResourceShell } from '@wizard-archive/editor/resources/resource-shell'",
            "import { noteDocumentToMarkdown } from '@wizard-archive/editor/notes/document-markdown'",
            "import type { WizardEditorRuntime } from '@wizard-archive/editor/resources/editor-runtime-contract'",
            "import { createCanvasDocumentDoc } from '@wizard-archive/editor/canvas/document-contract'",
          ].join('\n'),
        },
      ]),
    ).toEqual([])
  })

  it('blocks editor adapter imports from editor subpaths outside the baseline', () => {
    expect(
      analyzeImportBoundaries([
        {
          filePath: 'src/editor-adapters/live/example.ts',
          source: [
            "import { WizardEditor } from '@wizard-archive/editor'",
            "import { createExperimentalRuntime } from '@wizard-archive/editor/experimental/runtime'",
            "import { WorkspaceRuntimeHost } from '@wizard-archive/editor/workspace/runtime-host'",
            "import type { WorkspaceRuntime } from '@wizard-archive/editor/workspace/runtime'",
            "import { planMapPinCreations } from '@wizard-archive/editor/game-maps'",
            "import type { NoteSession } from '@wizard-archive/editor/notes'",
            "import { createWizardEditorRuntime } from '@wizard-archive/editor/adapter'",
          ].join('\n'),
        },
      ]),
    ).toEqual([
      'src/editor-adapters/live/example.ts:1 src/editor-adapters may not import value from unapproved editor package subpath @wizard-archive/editor',
      'src/editor-adapters/live/example.ts:2 src/editor-adapters may not import value from unapproved editor package subpath @wizard-archive/editor/experimental/runtime',
      'src/editor-adapters/live/example.ts:3 src/editor-adapters may not import value from unapproved editor package subpath @wizard-archive/editor/workspace/runtime-host',
      'src/editor-adapters/live/example.ts:4 src/editor-adapters may not import type from unapproved editor package subpath @wizard-archive/editor/workspace/runtime',
      'src/editor-adapters/live/example.ts:5 src/editor-adapters may not import value from unapproved editor package subpath @wizard-archive/editor/game-maps',
      'src/editor-adapters/live/example.ts:6 src/editor-adapters may not import type from unapproved editor package subpath @wizard-archive/editor/notes',
      'src/editor-adapters/live/example.ts:7 src/editor-adapters may not import value from unapproved editor package subpath @wizard-archive/editor/adapter',
    ])
  })

  it('blocks app code from bypassing editor package exports through raw source imports', () => {
    expect(
      analyzeImportBoundaries([
        {
          filePath: 'src/editor-adapters/live/example.ts',
          source:
            "import { createWorkspaceRuntime } from '../../../packages/editor/src/workspace/runtime'",
        },
        {
          filePath: 'src/example.ts',
          source: "import { createWorkspaceRuntime } from 'packages/editor/src/workspace/runtime'",
        },
      ]),
    ).toEqual([
      'src/editor-adapters/live/example.ts:1 src may not import value from raw editor package source ../../../packages/editor/src/workspace/runtime; use @wizard-archive/editor package exports',
      'src/example.ts:1 src may not import value from raw editor package source packages/editor/src/workspace/runtime; use @wizard-archive/editor package exports',
    ])
  })

  it('blocks tilde alias traversal into raw editor package source', () => {
    expect(
      analyzeImportBoundaries([
        {
          filePath: 'src/example.ts',
          source:
            "import { createWorkspaceRuntime } from '~/../packages/editor/src/workspace/runtime'",
        },
      ]),
    ).toEqual([
      'src/example.ts:1 src may not import value from raw editor package source ~/../packages/editor/src/workspace/runtime; use @wizard-archive/editor package exports',
    ])
  })

  it('blocks external code from bypassing ui package exports through raw source imports', () => {
    expect(
      analyzeImportBoundaries([
        {
          filePath: 'src/example.ts',
          source: "import { Button } from '../packages/ui/src/button'",
        },
        {
          filePath: 'packages/editor/src/example.ts',
          source: "import { Button } from '../../ui/src/button'",
        },
      ]),
    ).toEqual([
      'src/example.ts:1 src may not import value from raw ui package source ../packages/ui/src/button; use @wizard-archive/ui package exports',
      'packages/editor/src/example.ts:1 editor-package may not import value from raw ui package source ../../ui/src/button; use @wizard-archive/ui package exports',
    ])
  })

  it('allows same-package raw source imports', () => {
    expect(
      analyzeImportBoundaries([
        {
          filePath: 'packages/editor/src/workspace/example.ts',
          source: "import { createRuntime } from '../runtime'",
        },
        {
          filePath: 'packages/ui/src/example.ts',
          source: "import { Button } from './button'",
        },
      ]),
    ).toEqual([])
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
