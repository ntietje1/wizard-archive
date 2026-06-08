import { render, screen, waitFor } from '@testing-library/react'
import { useRef } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useEmbedDropTarget } from '../use-embed-drop-target'
import { testId } from '~/test/helpers/test-id'
import type { Id } from 'convex/_generated/dataModel'
import type { EmbedTarget } from 'shared/embeds/embedTargets'

const dropTargetState = vi.hoisted(() => ({
  args: null as null | {
    canDrop: (input: { source: { data: Record<string | symbol, unknown> } }) => boolean
    onDrop: (input: { source: { data: Record<string | symbol, unknown> } }) => void
  },
}))

vi.mock('@atlaskit/pragmatic-drag-and-drop/element/adapter', () => ({
  dropTargetForElements: vi.fn((args) => {
    dropTargetState.args = args
    return vi.fn()
  }),
}))

describe('useEmbedDropTarget', () => {
  beforeEach(() => {
    dropTargetState.args = null
  })

  it('replaces from sidebar item drops and rejects the current canvas', async () => {
    const setTarget = vi.fn(() => Promise.resolve())
    renderHookHarness({ sourceItemId: testId<'sidebarItems'>('canvas-1'), setTarget })

    await waitFor(() => expect(dropTargetState.args).not.toBeNull())

    expect(
      dropTargetState.args!.canDrop({
        source: { data: { sidebarItemId: testId<'sidebarItems'>('canvas-1') } },
      }),
    ).toBe(false)
    expect(
      dropTargetState.args!.canDrop({
        source: { data: { sidebarItemId: testId<'sidebarItems'>('note-1') } },
      }),
    ).toBe(true)

    dropTargetState.args!.onDrop({
      source: { data: { sidebarItemId: testId<'sidebarItems'>('note-1') } },
    })

    await waitFor(() =>
      expect(setTarget).toHaveBeenCalledWith({
        kind: 'sidebarItem',
        sidebarItemId: testId<'sidebarItems'>('note-1'),
      }),
    )
  })

  it('replaces from external URL drops', async () => {
    const setTarget = vi.fn(() => Promise.resolve())
    renderHookHarness({ setTarget })

    dispatchNativeDrop({
      types: ['text/plain'],
      getData: (type) => (type === 'text/plain' ? 'https://example.com/file.pdf' : ''),
    })

    await waitFor(() =>
      expect(setTarget).toHaveBeenCalledWith({
        kind: 'externalUrl',
        url: 'https://example.com/file.pdf',
        name: 'file.pdf',
      }),
    )
  })

  it('replaces from uri-list URL drops with comments', async () => {
    const setTarget = vi.fn(() => Promise.resolve())
    renderHookHarness({ setTarget })

    dispatchNativeDrop({
      types: ['text/uri-list', 'text/plain'],
      getData: (type) =>
        type === 'text/uri-list'
          ? '# SourceURL: https://ignored.example\nhttps://example.com/file.pdf'
          : 'https://fallback.example/fallback.pdf',
    })

    await waitFor(() =>
      expect(setTarget).toHaveBeenCalledWith({
        kind: 'externalUrl',
        url: 'https://example.com/file.pdf',
        name: 'file.pdf',
      }),
    )
  })

  it('uploads native files before replacing the embed target', async () => {
    const setTarget = vi.fn(() => Promise.resolve())
    const uploadFile = vi.fn(() => Promise.resolve(testId<'sidebarItems'>('file-1')))
    const file = new File(['x'], 'image.png', { type: 'image/png' })
    renderHookHarness({ setTarget, uploadFile })

    dispatchNativeDrop({
      types: ['Files'],
      files: { item: () => file },
      getData: () => '',
    })

    await waitFor(() => expect(uploadFile).toHaveBeenCalledWith(file))
    expect(setTarget).toHaveBeenCalledWith({
      kind: 'sidebarItem',
      sidebarItemId: testId<'sidebarItems'>('file-1'),
    })
  })
})

function renderHookHarness({
  sourceCanvasId = testId<'sidebarItems'>('canvas-1'),
  sourceItemId = sourceCanvasId,
  setTarget = vi.fn(() => Promise.resolve()),
  uploadFile = vi.fn(() => Promise.resolve(null)),
}: {
  sourceCanvasId?: Id<'sidebarItems'> | null
  sourceItemId?: Id<'sidebarItems'> | null
  setTarget?: (target: EmbedTarget) => Promise<void>
  uploadFile?: (file: File) => Promise<Id<'sidebarItems'> | null>
} = {}) {
  return render(
    <CanvasEmbedDropTargetHarness
      sourceItemId={sourceItemId}
      setTarget={setTarget}
      uploadFile={uploadFile}
    />,
  )
}

function CanvasEmbedDropTargetHarness({
  sourceItemId,
  setTarget,
  uploadFile,
}: {
  sourceItemId: Id<'sidebarItems'> | null
  setTarget: (target: EmbedTarget) => Promise<void>
  uploadFile: (file: File) => Promise<Id<'sidebarItems'> | null>
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  useEmbedDropTarget({
    ref,
    enabled: true,
    sourceItemId,
    setTarget,
    uploadFile,
  })
  return <div ref={ref} data-testid="drop-target" />
}

function dispatchNativeDrop(dataTransfer: {
  types: Array<string>
  getData: (type: string) => string
  files?: { item: (index: number) => File | null }
}) {
  const event = new Event('drop', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      files: { item: () => null },
      ...dataTransfer,
    },
  })
  screen.getByTestId('drop-target').dispatchEvent(event)
}
