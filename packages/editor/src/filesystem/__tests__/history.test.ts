import { describe, expect, it } from 'vite-plus/test'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import { testHistoryEntryId } from '../../test/history-entry-id'
import { createResourceFileSystemHistory, resolveResourceHistoryScope } from '../history'
import type { HistoryPreviewSnapshot, ResourceHistory } from '../history-types'
import { testAssetId } from '../../../../../shared/test/asset-id'

describe('workspace history model', () => {
  it('gates active history entries to persisted editable items', () => {
    expect(
      resolveResourceHistoryScope({
        canEdit: true,
        itemId: 'optimistic-create-1' as SidebarItemId,
        previewingEntryId: testHistoryEntryId('history-1'),
        rollbackEntryId: testHistoryEntryId('history-2'),
      }),
    ).toEqual({
      activePreviewingEntryId: null,
      activeRollbackEntryId: null,
      persistedItemId: null,
    })

    expect(
      resolveResourceHistoryScope({
        canEdit: false,
        itemId: 'item-1' as SidebarItemId,
        previewingEntryId: testHistoryEntryId('history-1'),
        rollbackEntryId: testHistoryEntryId('history-2'),
      }),
    ).toEqual({
      activePreviewingEntryId: null,
      activeRollbackEntryId: null,
      persistedItemId: 'item-1',
    })
  })

  it('accepts product-level game-map preview content from the source', () => {
    const snapshot = {
      kind: 'game-map',
      snapshotData: { imageAssetId: testAssetId('asset-1'), pins: [] },
      imageUrlState: { status: 'ready', url: 'https://example.test/map.png' },
    } satisfies HistoryPreviewSnapshot

    const history = createResourceFileSystemHistory({
      activeRollbackEntryId: null,
      entries: {
        canEdit: true,
        entries: [],
        loadMore: () => undefined,
        members: [],
        myMemberId: null,
        previewingEntryId: testHistoryEntryId('history-1'),
        status: 'Exhausted',
      },
      itemId: 'item-1' as SidebarItemId,
      ...historyControls({ previewingEntryId: testHistoryEntryId('history-1') }),
      preview: {
        entryTime: 2,
        historyEntryError: null,
        historyEntryLoading: false,
        snapshot,
        snapshotError: null,
        snapshotLoading: false,
      },
      restoreRollback: () => ({ status: 'already_running' }),
      rollback: {
        entryTime: undefined,
        historyEntryError: null,
        historyEntryLoading: false,
        isRestoring: false,
      },
    })

    expect(history).toMatchObject({
      status: 'available',
      previewingEntryId: testHistoryEntryId('history-1'),
      rollbackEntryId: null,
      preview: {
        status: 'ready',
        entryTime: 2,
        snapshot: {
          kind: 'game-map',
          snapshotData: { imageAssetId: testAssetId('asset-1'), pins: [] },
          imageUrlState: { status: 'ready', url: 'https://example.test/map.png' },
        },
      },
      rollback: { status: 'closed', isRestoring: false },
    })
  })
})

function historyControls(
  overrides: Partial<
    Pick<
      Extract<ResourceHistory, { status: 'available' }>,
      | 'clearItemSession'
      | 'clearPreview'
      | 'clearRollback'
      | 'previewEntry'
      | 'previewingEntryId'
      | 'requestRollback'
      | 'rollbackEntryId'
    >
  > = {},
) {
  return {
    previewingEntryId: null,
    rollbackEntryId: null,
    previewEntry: () => undefined,
    requestRollback: () => undefined,
    clearPreview: () => undefined,
    clearRollback: () => undefined,
    clearItemSession: () => undefined,
    ...overrides,
  }
}
