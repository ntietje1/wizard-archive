import { describe, expect, it } from 'vite-plus/test'
import { RESOURCE_STATUS } from '../../workspace/items-persistence-contract'
import { validateEmbedDropTarget } from '../drop-validation'

describe('validateEmbedDropTarget', () => {
  it('rejects self, trashed, and cross-workspace embed targets', () => {
    expect(
      validateEmbedDropTarget({
        targetId: 'note-1',
        workspaceId: 'workspace-1',
        item: {
          id: 'note-1',
          workspaceId: 'workspace-1',
          status: RESOURCE_STATUS.active,
        },
      }),
    ).toBe('self_embed')

    expect(
      validateEmbedDropTarget({
        targetId: 'note-1',
        workspaceId: 'workspace-1',
        item: {
          id: 'note-2',
          workspaceId: 'workspace-1',
          status: RESOURCE_STATUS.trashed,
        },
      }),
    ).toBe('trashed_item')

    expect(
      validateEmbedDropTarget({
        targetId: 'note-1',
        workspaceId: 'workspace-1',
        item: {
          id: 'note-2',
          workspaceId: 'workspace-2',
          status: RESOURCE_STATUS.active,
        },
      }),
    ).toBe('wrong_workspace')
  })

  it('accepts active non-self targets when no workspace mismatch exists', () => {
    expect(
      validateEmbedDropTarget({
        targetId: 'note-1',
        workspaceId: 'workspace-1',
        item: {
          id: 'note-2',
          workspaceId: 'workspace-1',
          status: RESOURCE_STATUS.active,
        },
      }),
    ).toBeNull()

    expect(
      validateEmbedDropTarget({
        targetId: 'note-1',
        workspaceId: null,
        item: {
          id: 'note-2',
          workspaceId: 'workspace-2',
          status: RESOURCE_STATUS.active,
        },
      }),
    ).toBeNull()
  })

  it('validates empty-string workspace ids as scoped workspace ids', () => {
    expect(
      validateEmbedDropTarget({
        targetId: 'note-1',
        workspaceId: '',
        item: {
          id: 'note-2',
          workspaceId: 'workspace-2',
          status: RESOURCE_STATUS.active,
        },
      }),
    ).toBe('wrong_workspace')
  })
})
