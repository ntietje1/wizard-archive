import { testResourceId } from '../../../../../shared/test/resource-id'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { defaultDndStoreApi as useDndStore, resetDndStore } from './store-test-utils'

describe('drag-drop store', () => {
  beforeEach(() => {
    resetDndStore()
  })

  it('resets every drag state field between monitor lifecycles', () => {
    useDndStore.setState({
      batchDecision: {
        command: {
          status: 'failed',
          action: 'pin',
          commandId: 'surface-drop.pin-sidebar-item-to-map',
          items: [],
          rejectedItems: [],
          target: {
            type: 'map-drop-zone',
            mapId: testResourceId('map_1'),
            mapName: 'World Map',
          },
          label: 'No items can be pinned to "World Map"',
        },
        onConfirm: async () => {},
      },
      dragOutcome: { type: 'operation', action: 'move', label: 'Move item' },
      externalFileDropTargetKey: 'root',
      isDraggingElement: true,
      isDraggingFiles: true,
      dragPreviewItemIds: [testResourceId('note_1')],
      activeDropTargetKey: 'sidebar-item:note_1',
    })

    resetDndStore()

    expect(useDndStore.getState()).toMatchObject({
      batchDecision: null,
      dragOutcome: null,
      externalFileDropTargetKey: null,
      isDraggingElement: false,
      isDraggingFiles: false,
      dragPreviewItemIds: [],
      activeDropTargetKey: null,
    })
  })

  it('does not publish a new state when sidebar preview ids are unchanged by value', () => {
    const ids = [testResourceId('note_1'), testResourceId('note_2')]
    useDndStore.getState().setDragPreviewItemIds(ids)
    const state = useDndStore.getState()

    useDndStore.getState().setDragPreviewItemIds([...ids])

    expect(useDndStore.getState()).toBe(state)
  })

  it('publishes explicit drag outcomes even when the object is reused', () => {
    const outcome = { type: 'operation' as const, action: 'move' as const, label: 'Move item' }
    useDndStore.getState().setDragOutcome(outcome)
    useDndStore.getState().setExternalFileDropTargetKey('root')
    useDndStore.getState().setIsDraggingFiles(true)
    useDndStore.getState().setIsDraggingElement(true)
    const state = useDndStore.getState()

    useDndStore.getState().setDragOutcome(outcome)
    useDndStore.getState().setExternalFileDropTargetKey('root')
    useDndStore.getState().setIsDraggingFiles(true)
    useDndStore.getState().setIsDraggingElement(true)

    expect(useDndStore.getState()).not.toBe(state)
  })
})
