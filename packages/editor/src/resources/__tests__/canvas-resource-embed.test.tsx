import { BlockNoteEditor } from '@blocknote/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import * as Y from 'yjs'
import { NOTE_YJS_FRAGMENT, noteBlocksToYDoc } from '../../notes/document/headless-yjs'
import { CanvasResourceEmbed } from '../workspace/canvas-resource-embed'
import { createInMemoryNoteSession } from '../in-memory-note-session'
import type { CanvasPreviewSource, NoteSessionSource } from '../content-session-contract'
import { initialVersion, sha256Digest } from '../component-version'
import { DOMAIN_ID_KIND, generateDomainId, generateUuidV7 } from '../domain-id'
import { RESOURCE_INDEX_SCHEMA } from '../resource-index-contract'
import type { ResourceIndexLoader, ResourceProjectionScope } from '../resource-index-contract'
import { canonicalizeResourceTitle } from '../resource-record'
import { MutableWorkspaceResourceIndex, indexRevision } from '../workspace-resource-index'

describe('CanvasResourceEmbed', () => {
  it('keeps the complete canonical note surface mounted across canvas activation', async () => {
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
    const actorId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    const scope = {
      campaignId,
      actorId,
      projection: 'dm',
      schema: RESOURCE_INDEX_SCHEMA,
    } satisfies ResourceProjectionScope
    const document = noteBlocksToYDoc(
      [
        {
          id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
          type: 'heading',
          props: { level: 2 },
          content: [{ type: 'text', text: 'Harbor ledger' }],
        },
        {
          id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
          type: 'paragraph',
          content: [
            {
              type: 'value',
              props: {
                valueId: generateUuidV7(),
                label: 'Supplies',
                expressionSource: '6 * 3',
              },
            },
          ],
        },
      ],
      NOTE_YJS_FRAGMENT,
    )
    const version = initialVersion(await sha256Digest(Y.encodeStateAsUpdate(document)))
    const session = createInMemoryNoteSession(document, version)
    const noteState = { status: 'ready' as const, session }
    const notes = {
      get: () => noteState,
      subscribe: () => () => {},
      export: () => ({ status: 'loading' as const }),
      create: () => Promise.reject(new Error('Not used')),
      dispose: () => {},
    } satisfies NoteSessionSource
    const canvases = {
      get: () => ({ status: 'unavailable' as const, reason: 'capability_not_supported' as const }),
      subscribe: () => () => {},
    } satisfies CanvasPreviewSource
    const index = new MutableWorkspaceResourceIndex(scope, indexRevision('empty'))
    index.replaceSnapshot({
      scope,
      revision: indexRevision('known-note'),
      resources: [
        {
          id: resourceId,
          campaignId,
          displayParentId: null,
          kind: 'note',
          title: canonicalizeResourceTitle('Ship manifest'),
          icon: null,
          color: null,
          lifecycle: 'active',
          metadataVersion: version,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      missingResourceIds: [],
      collections: [],
    })
    const loader = {
      ensureResource: vi.fn(() => Promise.resolve({ status: 'completed' as const })),
      ensureCollection: vi.fn(() => Promise.resolve({ status: 'completed' as const })),
    } satisfies ResourceIndexLoader
    const onEdit = vi.fn()
    const createEditor = vi.spyOn(BlockNoteEditor, 'create')
    const node = {
      id: generateDomainId(DOMAIN_ID_KIND.canvasNode),
      type: 'embed' as const,
      position: { x: 0, y: 0 },
      data: {
        destination: {
          kind: 'internal' as const,
          target: { kind: 'resource' as const, resourceId },
        },
      },
    }
    const view = render(
      <CanvasResourceEmbed
        canEdit
        canvases={canvases}
        editing={false}
        index={index}
        loader={loader}
        node={node}
        notes={notes}
        onEdit={onEdit}
      />,
    )
    const editor = await screen.findByRole('textbox', { name: 'Ship manifest embedded note' })
    const creationCount = createEditor.mock.calls.length

    expect(editor).toHaveAttribute('contenteditable', 'false')
    expect(screen.getByRole('heading', { level: 2, name: 'Harbor ledger' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Supplies: 6 * 3' })).toBeVisible()
    fireEvent.doubleClick(editor)
    expect(onEdit).toHaveBeenCalledOnce()

    view.rerender(
      <CanvasResourceEmbed
        canEdit
        canvases={canvases}
        editing
        index={index}
        loader={loader}
        node={node}
        notes={notes}
        onEdit={onEdit}
      />,
    )

    expect(screen.getByRole('textbox', { name: 'Ship manifest embedded note' })).toBe(editor)
    expect(editor).toHaveAttribute('contenteditable', 'true')
    expect(createEditor).toHaveBeenCalledTimes(creationCount)
    expect(screen.queryByRole('button', { name: 'Value' })).not.toBeInTheDocument()
    expect(loader.ensureResource).not.toHaveBeenCalled()

    createEditor.mockRestore()
    view.unmount()
    session.dispose()
  })
})
