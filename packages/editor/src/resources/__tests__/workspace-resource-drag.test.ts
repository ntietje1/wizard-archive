import { describe, expect, it, vi } from 'vite-plus/test'
import { allowWorkspaceResourceDrop, finishWorkspaceResourceDrop } from '../workspace-resource-drag'
import type { WorkspaceActions } from '../workspace/resource-operations'

describe('workspace external resource drops', () => {
  it('keeps exactly one resource drop target active', () => {
    const previous = document.createElement('div')
    const current = document.createElement('div')
    previous.dataset.dropTarget = 'true'
    previous.dataset.dropOperation = 'move'
    document.body.append(previous, current)
    const drop = dropEvent(current, current, browserDataTransfer())

    allowWorkspaceResourceDrop(drop.event)

    expect(previous).not.toHaveAttribute('data-drop-target')
    expect(previous).not.toHaveAttribute('data-drop-operation')
    expect(current).toHaveAttribute('data-drop-target', 'true')
    expect(current).toHaveAttribute('data-drop-operation', 'copy')
    previous.remove()
    current.remove()
  })

  it('routes browser files to the destination through the workspace transfer action', async () => {
    const target = document.createElement('div')
    const dataTransfer = browserDataTransfer()
    const actions = workspaceDropActions()
    const drop = dropEvent(target, target, dataTransfer)

    await finishWorkspaceResourceDrop(drop.event, actions, {
      type: 'collection',
      parentId: null,
      title: 'Resources',
    })

    expect(drop.preventDefault).toHaveBeenCalledOnce()
    expect(drop.stopPropagation).toHaveBeenCalledOnce()
    expect(actions.importExternal).toHaveBeenCalledWith(null, dataTransfer)
  })

  it('blocks external files on non-folder resources instead of importing at an ancestor', async () => {
    const target = document.createElement('div')
    const note = document.createElement('button')
    note.dataset.resourceKind = 'note'
    target.append(note)
    const actions = workspaceDropActions()
    const drop = dropEvent(target, note, browserDataTransfer())

    await finishWorkspaceResourceDrop(drop.event, actions, {
      type: 'collection',
      parentId: null,
      title: 'Resources',
    })

    expect(actions.importExternal).not.toHaveBeenCalled()
    expect(actions.report).toHaveBeenCalledWith({
      kind: 'failed',
      message: 'Drop files on a folder or empty resource area',
    })
  })
})

function workspaceDropActions() {
  return {
    drop: vi.fn(),
    importExternal: vi.fn(),
    report: vi.fn(),
  } satisfies Pick<WorkspaceActions, 'drop' | 'importExternal' | 'report'>
}

function browserDataTransfer(): Parameters<typeof finishWorkspaceResourceDrop>[0]['dataTransfer'] {
  return {
    dropEffect: 'none',
    files: [],
    getData: () => '',
    items: [],
    types: ['Files'],
  }
}

function dropEvent(
  currentTarget: HTMLElement,
  target: HTMLElement,
  dataTransfer: Parameters<typeof finishWorkspaceResourceDrop>[0]['dataTransfer'],
) {
  const preventDefault = vi.fn()
  const stopPropagation = vi.fn()
  return {
    event: {
      altKey: false,
      ctrlKey: false,
      currentTarget,
      dataTransfer,
      metaKey: false,
      preventDefault,
      stopPropagation,
      target,
    },
    preventDefault,
    stopPropagation,
  }
}
