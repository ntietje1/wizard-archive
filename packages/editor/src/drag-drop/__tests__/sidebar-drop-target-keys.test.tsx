import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import type { RefObject } from 'react'
import { createFolder } from '../../test/sidebar-item-factory'
import { createResourceCatalogModel } from '../../filesystem/catalog'
import { DndProviderContext } from '../context'
import { getDropTargetKey, resolveDropTarget } from '../drop-target-data'
import { defaultDndStoreApi as useDndStore, resetDndStore } from './store-test-utils'
import { useSidebarItemDropTarget } from '../use-sidebar-item-drop-target'

describe('sidebar item drop target keys', () => {
  beforeEach(() => {
    resetDndStore()
  })

  it('uses the same namespaced key for sidebar drop registration and hover feedback', () => {
    const folder = createFolder()
    const targetKey = `sidebar-item:${folder.id}`

    expect(getDropTargetKey({ type: folder.type, sidebarItemId: folder.id })).toBe(targetKey)
    expect(getDropTargetKey(folder)).toBe(targetKey)

    useDndStore.setState({
      activeDropTargetKey: targetKey,
      externalFileDropTargetKey: targetKey,
      isDraggingFiles: true,
    })

    const ref = { current: null } as RefObject<HTMLElement | null>
    const { result } = renderHook(() => useSidebarItemDropTarget({ ref, item: folder }))

    expect(result.current.isDropTarget).toBe(true)
    expect(result.current.isFileDropTarget).toBe(true)
  })

  it('only marks trash actions for the targeted sidebar item', () => {
    const targetedFolder = createFolder()
    const otherFolder = createFolder()
    const targetKey = `sidebar-item:${targetedFolder.id}`

    useDndStore.setState({
      activeDropTargetKey: targetKey,
      dragOutcome: { type: 'operation', action: 'trash', label: 'Move item to "Trash"' },
    })

    const ref = { current: null } as RefObject<HTMLElement | null>
    const { result } = renderHook(() => useSidebarItemDropTarget({ ref, item: otherFolder }))

    expect(result.current.isDropTarget).toBe(false)
    expect(result.current.isTrashAction).toBe(false)
  })

  it('derives the highlight key from runtime-scoped target data', () => {
    const folder = createFolder()
    const runtimeId = 'runtime-a'
    const targetKey = `runtime:${runtimeId}:sidebar-item:${folder.id}`

    useDndStore.setState({
      activeDropTargetKey: targetKey,
      externalFileDropTargetKey: targetKey,
      isDraggingFiles: true,
    })

    const ref = { current: null } as RefObject<HTMLElement | null>
    const { result } = renderHook(() => useSidebarItemDropTarget({ ref, item: folder }), {
      wrapper: ({ children }) => (
        <DndProviderContext.Provider
          value={{
            canAcceptExternalFiles: true,
            dispatchDropPayload: () => Promise.resolve(),
            getItemLinkPath: () => [],
            runtimeId,
          }}
        >
          {children}
        </DndProviderContext.Provider>
      ),
    })

    expect(result.current.dropTargetKey).toBe(targetKey)
    expect(result.current.isDropTarget).toBe(true)
    expect(result.current.isFileDropTarget).toBe(true)
  })

  it('preserves runtime scope when resolving sidebar item target data', () => {
    const folder = createFolder()
    const runtimeId = 'runtime-a'
    const { catalog } = createResourceCatalogModel({
      activeItems: [folder],
      trashItems: [],
    })

    const target = resolveDropTarget(
      {
        type: folder.type,
        sidebarItemId: folder.id,
        __wizardArchiveDndRuntimeId: runtimeId,
      },
      catalog,
      { runtimeId },
    )

    expect(getDropTargetKey(target)).toBe(`runtime:${runtimeId}:sidebar-item:${folder.id}`)
  })
})
