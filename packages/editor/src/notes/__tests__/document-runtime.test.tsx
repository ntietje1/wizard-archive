import { testResourceId } from '../../../../../shared/test/resource-id'
import type { ResourceId } from '../../resources/domain-id'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { NoteDocumentRuntime } from '../document-runtime'
import { createTestWorkspaceRuntime } from '../../test/workspace-runtime-factory'
import {
  createTestNotePlaybackSessionPorts,
  createTestNoteSessionPorts,
  createTestNoteValueSessionPorts,
} from '../../test/workspace-note-session-source-factory'
import { createNote } from '../../test/sidebar-item-factory'
import { createRuntimeNoteContentSource } from '../runtime-content-source'
import type { CustomBlockNoteEditor } from '../editor-schema'
import type { NoteValueRuntimeState } from '../values/state-contract'
import type { NoteBlock } from '../document/model'

import { testNoteBlockId } from '../../test/blocknote-id'

describe('NoteDocumentRuntime', () => {
  it('keeps document-runtime helpers on feature-owned note sources', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'packages/editor/src/notes/document-runtime.tsx'),
      'utf8',
    )

    expect(source).toContain('source: NoteDocumentContentSource')
    expect(source).toContain('source: NoteWikiLinkContentSource')
    expect(source).not.toContain('source.document.useNoteCollaborationSession')
    expect(source).not.toContain('source.wikiLinks.useWikiLinkAutocompleteModelData')
    expect(source).not.toContain('document: NoteDocumentContentSource')
    expect(source).not.toContain('playback: NotePlaybackContentSource')
  })

  it('keeps runtime note content input split by feature-owned session leaves', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'packages/editor/src/notes/runtime-content-source.ts'),
      'utf8',
    )

    expect(source).toContain("noteDocument: Pick<NoteSessionPorts['document']")
    expect(source).toContain("noteHeadings: Pick<NoteHeadingSessionPorts['headings']")
    expect(source).toContain("notePlayback: Pick<NotePlaybackSessionPorts['playback']")
    expect(source).toContain('noteValues: NoteValueRuntimeStateSource')
    expect(source).not.toContain(
      "note: Pick<NoteSessionPorts, 'document' | 'headings' | 'playback' | 'values'>",
    )
    expect(source).not.toContain('const noteContent = runtime.sessions.note')
    expect(source).not.toContain('noteContent.headings')
    expect(source).not.toContain('noteContent.values')
  })

  it('keeps editable document sessions separate from collaboration playback', () => {
    const useCollaborationSession = vi.fn()
    const getCollaborationPlayback = vi.fn()
    const source = createRuntimeNoteContentSource({
      ...createTestWorkspaceRuntime({
        noteSession: createTestNoteSessionPorts({
          useCollaborationSession,
        }),
        notePlayback: createTestNotePlaybackSessionPorts({ getCollaborationPlayback }),
      }),
      sessions: {
        noteDocument: { useCollaborationSession },
        noteHeadings: { useNoteHeadings: () => ({ headings: [], status: 'success' }) },
        notePlayback: { getCollaborationPlayback },
        noteValues: { useNoteValueStates: () => ({ states: [], status: 'success' }) },
      },
    })

    expect(source).not.toHaveProperty('collaboration')
    expect(source.document).not.toHaveProperty('playback')
    expect(source.document.useNoteCollaborationSession).toBe(useCollaborationSession)
    expect(source.playback.getNoteCollaborationPlayback).toBe(getCollaborationPlayback)
  })

  it('builds note runtime from workspace paths and note value state loads', () => {
    const currentNote = createNote({
      id: testResourceId('note-current'),
      name: 'Current Note',
    })
    const sourceNote = createNote({
      id: testResourceId('note-source'),
      name: 'Source Note',
    })
    const currentValue = createRuntimeState({
      noteId: currentNote.id,
      valueId: 'current-value',
      slug: 'draft_total',
      formattedValue: '7',
    })
    const sourceValue = createRuntimeState({
      noteId: sourceNote.id,
      valueId: 'source-value',
      slug: 'prof_bonus',
      formattedValue: '2',
    })
    const useNoteValueStates = vi.fn((noteIds: Array<ResourceId>) => ({
      states: [
        ...(noteIds.includes(currentNote.id) ? [currentValue] : []),
        ...(noteIds.includes(sourceNote.id) ? [sourceValue] : []),
      ],
      status: 'success' as const,
    }))
    const noteSession = createTestNoteSessionPorts()
    const noteValues = createTestNoteValueSessionPorts({ useNoteValueStates })
    const workspaceRuntime = createTestWorkspaceRuntime({
      activeItems: [currentNote, sourceNote],
      item: currentNote,
      noteSession,
      noteValues,
    })
    const source = createRuntimeNoteContentSource({
      ...workspaceRuntime,
      sessions: {
        noteDocument: { useCollaborationSession: noteSession.document.useCollaborationSession },
        noteHeadings: { useNoteHeadings: () => ({ headings: [], status: 'success' }) },
        notePlayback: {},
        noteValues: { useNoteValueStates: noteValues.values.useNoteValueStates },
      },
    })
    const observed: {
      linkedItemId?: string | null
      linkResolverIsViewerMode?: boolean
      persistedValueSlug?: string
      referenceableValueSlug?: string
    } = {}

    render(
      <NoteDocumentRuntime
        editor={createEditor('[[Source Note.prof_bonus]] + 1')}
        isViewerMode={false}
        linkResolutionSource={source.linkResolution}
        noteId={currentNote.id}
        noteValueReferences={source.valueReferences}
        noteValueStateSource={source.valueState}
      >
        {(runtime) => {
          observed.linkedItemId = runtime.linkResolver.resolveLink({
            syntax: 'wiki',
            pathKind: 'global',
            itemPath: ['Source Note'],
            itemName: 'Source Note',
            headingPath: [],
            displayName: null,
            rawTarget: 'Source Note',
            isExternal: false,
          }).itemId
          observed.linkResolverIsViewerMode = runtime.linkResolver.isViewerMode
          observed.persistedValueSlug = runtime.valueRuntimeSource.persistedStates[0]?.slug
          observed.referenceableValueSlug = runtime.valueRuntimeSource.referenceableStates[0]?.slug
          return null
        }}
      </NoteDocumentRuntime>,
    )

    expect(useNoteValueStates).toHaveBeenCalledWith([currentNote.id, sourceNote.id])
    expect(observed.linkedItemId).toBe(sourceNote.id)
    expect(observed.linkResolverIsViewerMode).toBe(false)
    expect(observed.persistedValueSlug).toBe('draft_total')
    expect(observed.referenceableValueSlug).toBe('prof_bonus')
  })

  it('reads note value candidates from the current catalog on every request', () => {
    let noteName = 'First Name'
    const noteId = testResourceId('candidate-note')
    const source = createRuntimeNoteContentSource({
      navigation: {
        openExternalUrl: vi.fn(),
        openItem: vi.fn(),
      },
      filesystem: {
        catalog: {
          getVisibleAncestors: () => [],
          getVisibleItemById: () => null,
          getVisibleRoots: () => [],
          queryVisibleItems: () => [
            createNote({
              id: noteId,
              name: noteName,
            }),
          ],
        },
        load: { activeError: null, activeStatus: 'success' },
        operations: {
          createItem: vi.fn(),
          importFile: vi.fn(),
          validateCreateItem: vi.fn(),
        },
        paths: {
          getVisibleItemLinkPath: (item) => [item.name],
          resolveVisibleFolderPath: () => null,
          resolveVisibleItemPath: () => null,
          resolveVisibleNotePath: () => null,
        },
        permissions: {
          canAccessItem: () => true,
          canEdit: false,
          getMemberItemPermissionLevel: () => 'none',
        },
        sharing: {
          blocks: { status: 'unsupported', reason: 'not_available' },
          viewAsParticipant: { status: 'unsupported', reason: 'not_available' },
        },
      },
      sessions: {
        noteDocument: { useCollaborationSession: vi.fn() },
        noteHeadings: { useNoteHeadings: () => ({ headings: [], status: 'success' }) },
        notePlayback: {},
        noteValues: { useNoteValueStates: () => ({ states: [], status: 'success' }) },
      },
    })

    expect(source.valueReferences.getNoteCandidates()).toEqual([
      { noteId, title: 'First Name', path: 'First Name' },
    ])

    noteName = 'Renamed Note'

    expect(source.valueReferences.getNoteCandidates()).toEqual([
      { noteId, title: 'Renamed Note', path: 'Renamed Note' },
    ])
  })
})

function createEditor(expressionSource: string): CustomBlockNoteEditor {
  return {
    document: [
      {
        id: testNoteBlockId('block-1'),
        type: 'paragraph',
        props: {},
        content: [
          {
            type: 'value',
            props: {
              valueId: 'value-1',
              slug: 'draft_total',
              expressionSource,
            },
          },
        ],
        children: [],
      },
    ] as Array<NoteBlock>,
    _tiptapEditor: {
      on: vi.fn(),
      off: vi.fn(),
    },
  } as unknown as CustomBlockNoteEditor
}

function createRuntimeState(
  overrides: Partial<Extract<NoteValueRuntimeState<ResourceId>, { status: 'ok' }>> = {},
): NoteValueRuntimeState<ResourceId> {
  return {
    noteId: testResourceId('note-id'),
    noteBlockId: testNoteBlockId('block-1'),
    valueId: 'value-1',
    slug: 'draft_value',
    status: 'ok',
    rawValue: 1,
    formattedValue: '1',
    ...overrides,
  }
}
