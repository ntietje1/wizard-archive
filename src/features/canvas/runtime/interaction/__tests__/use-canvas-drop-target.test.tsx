import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CanvasDocumentNode } from '~/features/canvas/domain/canvas-document'
import type { DropResult } from '~/features/file-upload/utils/folder-reader'
import { executeRegisteredExternalFileDropCommand } from '~/features/dnd/utils/external-file-drop-command'
import { CANVAS_DROP_ZONE_TYPE } from '~/features/dnd/utils/drop-target-data'
import { testId } from '~/test/helpers/test-id'
import { useCanvasDropTarget } from '../use-canvas-drop-target'

const uploadEmbedFile = vi.hoisted(() => vi.fn())

vi.mock('~/features/dnd/hooks/useDndDropTarget', () => ({
  useDndDropTarget: vi.fn(() => ({ isDropTarget: false })),
}))

vi.mock('~/features/dnd/hooks/useExternalDropTarget', () => ({
  useExternalDropTarget: vi.fn(() => ({ isFileDropTarget: false })),
}))

vi.mock('~/features/embeds/hooks/use-embed-upload', () => ({
  useEmbedUpload: () => ({
    uploadEmbedFile,
  }),
}))

describe('useCanvasDropTarget', () => {
  beforeEach(() => {
    uploadEmbedFile.mockReset()
  })

  it('registers a canvas-scoped external file executor and returns folders to generic uploads', async () => {
    const canvasId = testId<'sidebarItems'>('canvas_target')
    const uploadedId = testId<'sidebarItems'>('uploaded_file')
    const createNodes = vi.fn()
    const flushUpdates = vi.fn(() => Promise.resolve())
    const file = new File(['content'], 'portrait.png', { type: 'image/png' })
    const dropResult: DropResult = {
      files: [{ file, relativePath: 'portrait.png' }],
      rootFolders: [{ name: 'Maps', relativePath: 'Maps', files: [], subfolders: [] }],
    }
    uploadEmbedFile.mockResolvedValue({ id: uploadedId, slug: 'portrait' })

    renderHook(() =>
      useCanvasDropTarget({
        canvasId,
        enabled: true,
        createNodes,
        provider: { flushUpdates } as never,
        screenToCanvasPosition: ({ x, y }) => ({ x: x + 100, y: y + 200 }),
      }),
    )

    let outcome
    await act(async () => {
      outcome = await executeRegisteredExternalFileDropCommand({
        target: { type: CANVAS_DROP_ZONE_TYPE, canvasId },
        dropResult,
        input: { clientX: 10, clientY: 20 },
      })
    })

    expect(uploadEmbedFile).toHaveBeenCalledWith(file)
    expect(createNodes).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'embed',
        data: expect.objectContaining({
          target: expect.objectContaining({ sidebarItemId: uploadedId }),
        }),
        position: { x: 110, y: 220 },
      }) satisfies Partial<CanvasDocumentNode>,
    ])
    expect(flushUpdates).toHaveBeenCalled()
    expect(outcome).toEqual({
      handled: true,
      unhandledDropResult: { files: [], rootFolders: dropResult.rootFolders },
    })
  })
})
