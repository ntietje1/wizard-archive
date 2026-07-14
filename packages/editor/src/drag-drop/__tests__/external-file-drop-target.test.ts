import { describe, expect, it } from 'vite-plus/test'
import {
  createFolder as createFolderFixture,
  createNote as createNoteFixture,
} from '../../test/sidebar-item-factory'
import { testId } from '../../test/id'
import { testCampaignId } from '../../../../../shared/test/campaign-id'
import {
  CANVAS_DROP_ZONE_TYPE,
  EMPTY_EMBED_DROP_TYPE,
  NOTE_EDITOR_DROP_TYPE,
} from '../drop-target-data'
import { resolveExternalFileDropTarget } from '../external-file-drop-target'

const campaignId = testCampaignId('campaign_1')

describe('resolveExternalFileDropTarget', () => {
  it('models root and folder file drops as direct imports', () => {
    const folder = createFolderFixture({ campaignId })

    expect(resolveExternalFileDropTarget(null)).toEqual({
      kind: 'accepted',
      files: { kind: 'fileImport', destination: { kind: 'direct', parentId: null } },
      browserFolders: { kind: 'fileImport', destination: { kind: 'direct', parentId: null } },
    })
    expect(resolveExternalFileDropTarget({ ...folder, ancestorIds: [] })).toEqual({
      kind: 'accepted',
      files: { kind: 'fileImport', destination: { kind: 'direct', parentId: folder.id } },
      browserFolders: { kind: 'fileImport', destination: { kind: 'direct', parentId: folder.id } },
    })
  })

  it('blocks external files on trashed folders', () => {
    const folder = createFolderFixture({ campaignId, status: 'trashed' })

    expect(resolveExternalFileDropTarget({ ...folder, ancestorIds: [] })).toEqual({
      kind: 'blocked',
      reason: 'unsupported_target',
    })
  })

  it('models surface file drops with explicit folder import destinations', () => {
    expect(
      resolveExternalFileDropTarget({
        type: CANVAS_DROP_ZONE_TYPE,
        canvasId: testId<'sidebarItems'>('canvas_1'),
      }),
    ).toEqual({
      kind: 'accepted',
      files: {
        kind: 'surfaceFileImport',
        commandId: 'surface-file-import.canvas',
        label: 'Upload to canvas',
      },
      browserFolders: { kind: 'fileImport', destination: { kind: 'assets' } },
    })

    expect(
      resolveExternalFileDropTarget({
        type: EMPTY_EMBED_DROP_TYPE,
        sourceItemId: testId<'sidebarItems'>('canvas_1'),
        embedBlockId: 'embed-block-1',
      }),
    ).toEqual({
      kind: 'accepted',
      files: {
        kind: 'surfaceFileImport',
        commandId: 'surface-file-import.empty-embed',
        label: 'Upload to embed',
      },
      browserFolders: { kind: 'fileImport', destination: { kind: 'assets' } },
    })
  })

  it('blocks surface external drops when the raw file upload route is unavailable', () => {
    expect(
      resolveExternalFileDropTarget(
        {
          type: CANVAS_DROP_ZONE_TYPE,
          canvasId: testId<'sidebarItems'>('canvas_1'),
        },
        { surfaceFileUploadAvailable: false },
      ),
    ).toEqual({
      kind: 'blocked',
      reason: 'unsupported_target',
    })
  })

  it('models note body file drops as note-owned surface inserts', () => {
    expect(
      resolveExternalFileDropTarget({
        type: NOTE_EDITOR_DROP_TYPE,
        noteId: testId<'sidebarItems'>('note_1'),
      }),
    ).toEqual({
      kind: 'accepted',
      files: {
        kind: 'surfaceFileImport',
        commandId: 'surface-file-import.note-editor',
        label: 'Add file embeds to note',
      },
      browserFolders: { kind: 'fileImport', destination: { kind: 'assets' } },
    })
  })

  it('blocks non-folder sidebar resources', () => {
    const note = createNoteFixture({ campaignId })

    expect(
      resolveExternalFileDropTarget({
        ...note,
        ancestorIds: [],
      }),
    ).toEqual({ kind: 'blocked', reason: 'unsupported_target' })
  })
})
