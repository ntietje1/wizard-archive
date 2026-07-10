import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { SIDEBAR_ROOT_DROP_TYPE } from '../../../../../drag-drop/drop-target-data'
import { DroppableRoot } from '../droppable-root'

const dndCapability = vi.hoisted(() => ({
  canAcceptExternalFiles: true,
}))
const dndStoreState = vi.hoisted(() => ({
  externalFileDropTargetKey: null as string | null,
  isDraggingFiles: false,
}))
const dropTargetCalls = vi.hoisted(() => [] as Array<{ canDrop?: boolean }>)
const externalDropTargetCalls = vi.hoisted(
  () => [] as Array<{ enabled?: boolean; fileDropTarget?: { kind: string } }>,
)

vi.mock('../../../../../drag-drop/use-drop-target', () => ({
  useDndDropTarget: (options: { canDrop?: boolean }) => {
    dropTargetCalls.push({ canDrop: options.canDrop })
    return { dropTargetRef: vi.fn(), dropTargetKey: SIDEBAR_ROOT_DROP_TYPE, isDropTarget: false }
  },
}))

vi.mock('../../../../../drag-drop/use-external-drop-target', () => ({
  useExternalDropTarget: (options: { enabled?: boolean; fileDropTarget?: { kind: string } }) => {
    externalDropTargetCalls.push({
      enabled: options.enabled,
      fileDropTarget: options.fileDropTarget,
    })
    return { externalDropTargetRef: vi.fn(), isFileDropTarget: false }
  },
}))

vi.mock('../../../../../drag-drop/context', () => ({
  useCanAcceptExternalFiles: () => dndCapability.canAcceptExternalFiles,
}))

vi.mock('../../../../../drag-drop/store', () => ({
  useDndStore: (selector: (state: typeof dndStoreState) => unknown) => selector(dndStoreState),
}))

describe('DroppableRoot', () => {
  beforeEach(() => {
    dndCapability.canAcceptExternalFiles = true
    dndStoreState.externalFileDropTargetKey = null
    dndStoreState.isDraggingFiles = false
    dropTargetCalls.length = 0
    externalDropTargetCalls.length = 0
  })

  it('advertises root drops when runtime editing and external file drops are enabled', () => {
    render(
      <DroppableRoot canDrop={true}>
        <div>Sidebar</div>
      </DroppableRoot>,
    )

    expect(dropTargetCalls).toEqual([{ canDrop: true }])
    expect(externalDropTargetCalls).toEqual([
      { enabled: true, fileDropTarget: expect.objectContaining({ kind: 'accepted' }) },
    ])
  })

  it('passes disabled root and external file capabilities to the drop targets', () => {
    render(
      <DroppableRoot canDrop={false}>
        <div>Sidebar</div>
      </DroppableRoot>,
    )

    expect(dropTargetCalls).toEqual([{ canDrop: false }])
    expect(externalDropTargetCalls).toEqual([
      { enabled: false, fileDropTarget: expect.objectContaining({ kind: 'accepted' }) },
    ])

    dndCapability.canAcceptExternalFiles = false
    dropTargetCalls.length = 0
    externalDropTargetCalls.length = 0

    render(
      <DroppableRoot canDrop={true}>
        <div>Sidebar</div>
      </DroppableRoot>,
    )

    expect(dropTargetCalls).toEqual([{ canDrop: true }])
    expect(externalDropTargetCalls).toEqual([
      { enabled: false, fileDropTarget: expect.objectContaining({ kind: 'accepted' }) },
    ])
  })

  it('renders file-drop chrome when external files hover the root target', () => {
    dndStoreState.externalFileDropTargetKey = SIDEBAR_ROOT_DROP_TYPE
    dndStoreState.isDraggingFiles = true

    const { container } = render(
      <DroppableRoot canDrop={true}>
        <div>Sidebar</div>
      </DroppableRoot>,
    )

    expect(container.firstElementChild).toHaveClass('ring-drop-target-file')
  })
})
