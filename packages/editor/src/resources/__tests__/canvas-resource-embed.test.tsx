import { BlockNoteEditor } from '@blocknote/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import * as Y from 'yjs'
import { NOTE_YJS_FRAGMENT, noteBlocksToYDoc } from '../../notes/document/headless-yjs'
import { CanvasResourceEmbed } from '../workspace/canvas-resource-embed'
import { createInMemoryNoteSession } from '../in-memory-note-session'
import type {
  CanvasPreviewSource,
  MapPreviewSource,
  NoteSessionSource,
} from '../content-session-contract'
import { assertSha256Digest, initialVersion, sha256Digest } from '../component-version'
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
    const maps = {
      get: () => ({ status: 'unavailable' as const, reason: 'capability_not_supported' as const }),
      subscribe: () => () => {},
    } satisfies MapPreviewSource
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
        activation={null}
        canEdit
        canvases={canvases}
        editing={false}
        index={index}
        loader={loader}
        maps={maps}
        node={node}
        notes={notes}
        zoom={2}
      />,
    )
    const editor = await screen.findByRole('textbox', { name: 'Ship manifest embedded note' })
    const creationCount = createEditor.mock.calls.length

    expect(editor).toHaveAttribute('contenteditable', 'false')
    expect(screen.getByTestId('canvas-embed-floating-label')).toHaveTextContent('Ship manifest')
    expect(screen.getByTestId('canvas-embed-floating-label')).toHaveStyle({
      transform: 'scale(0.5)',
      width: '200%',
    })
    expect(editor.closest('[data-slot="scroll-area"]')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Harbor ledger' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Supplies: 6 * 3' })).toBeVisible()
    expect(editor.closest('[data-canvas-editable-embed="true"]')).toBeInTheDocument()

    view.rerender(
      <CanvasResourceEmbed
        activation={null}
        canEdit
        canvases={canvases}
        editing
        index={index}
        loader={loader}
        maps={maps}
        node={node}
        notes={notes}
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

  it('renders a complete canonical folder collection instead of a placeholder', () => {
    const ensureCollection = vi.fn(() => Promise.resolve({ status: 'completed' as const }))
    renderFolderEmbed(true, ensureCollection)

    expect(screen.getByTestId('canvas-embed-floating-label')).toHaveTextContent('Documents')
    expect(screen.getByText('Quest log')).toBeVisible()
    expect(ensureCollection).not.toHaveBeenCalled()
  })

  it('does not load a known empty folder', () => {
    const ensureCollection = vi.fn(() => Promise.resolve({ status: 'completed' as const }))
    renderFolderEmbed(true, ensureCollection, false)

    expect(screen.getByText('Folder is empty')).toBeVisible()
    expect(ensureCollection).not.toHaveBeenCalled()
  })

  it('loads one folder page on mount and advances only from the explicit control', async () => {
    let resolveFirst!: () => void
    let resolveSecond!: () => void
    const ensureCollection = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<{ status: 'completed' }>((resolve) => {
            resolveFirst = () => resolve({ status: 'completed' })
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<{ status: 'completed' }>((resolve) => {
            resolveSecond = () => resolve({ status: 'completed' })
          }),
      )
    const folder = renderFolderEmbed(null, ensureCollection)

    await waitFor(() => expect(ensureCollection).toHaveBeenCalledOnce())
    folder.publish(false, true)
    resolveFirst()

    expect(await screen.findByText('Quest log')).toBeVisible()
    const loadMore = await screen.findByRole('button', { name: 'Load more resources' })
    expect(ensureCollection).toHaveBeenCalledOnce()

    fireEvent.click(loadMore)
    fireEvent.click(loadMore)
    await waitFor(() => expect(ensureCollection).toHaveBeenCalledTimes(2))
    expect(loadMore).toBeDisabled()

    folder.publish(true, true)
    resolveSecond()
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Load more resources' })).not.toBeInTheDocument(),
    )
  })

  it('shows retryable and terminal folder load failures truthfully', async () => {
    const ensureCollection = vi
      .fn()
      .mockResolvedValueOnce({
        status: 'failed' as const,
        retryable: true,
        reason: 'network_unavailable' as const,
      })
      .mockResolvedValueOnce({
        status: 'failed' as const,
        retryable: false,
        reason: 'invalid_response' as const,
      })
    renderFolderEmbed(null, ensureCollection)

    fireEvent.click(await screen.findByRole('button', { name: 'Try loading folder again' }))
    expect(await screen.findByText('Folder could not be loaded')).toHaveAttribute('role', 'status')
    expect(screen.queryByRole('button', { name: /loading folder/i })).not.toBeInTheDocument()
    expect(ensureCollection).toHaveBeenCalledTimes(2)
  })
})

function renderFolderEmbed(
  complete: boolean | null,
  ensureCollection: ResourceIndexLoader['ensureCollection'],
  includeChild = true,
) {
  const folderId = generateDomainId(DOMAIN_ID_KIND.resource)
  const childId = generateDomainId(DOMAIN_ID_KIND.resource)
  const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
  const actorId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
  const scope = {
    campaignId,
    actorId,
    projection: 'dm',
    schema: RESOURCE_INDEX_SCHEMA,
  } satisfies ResourceProjectionScope
  const version = initialVersion(assertSha256Digest('c'.repeat(64)))
  const resources = [
    {
      id: folderId,
      campaignId,
      displayParentId: null,
      kind: 'folder' as const,
      title: canonicalizeResourceTitle('Documents'),
      icon: null,
      color: null,
      lifecycle: 'active' as const,
      metadataVersion: version,
      createdAt: 1,
      updatedAt: 1,
    },
    {
      id: childId,
      campaignId,
      displayParentId: folderId,
      kind: 'note' as const,
      title: canonicalizeResourceTitle('Quest log'),
      icon: null,
      color: null,
      lifecycle: 'active' as const,
      metadataVersion: version,
      createdAt: 1,
      updatedAt: 1,
    },
  ]
  const index = new MutableWorkspaceResourceIndex(scope, indexRevision('empty-folder'))
  let revision = 0
  const publish = (nextComplete: boolean, includePublishedChild: boolean) => {
    revision += 1
    index.replaceSnapshot({
      scope,
      revision: indexRevision(`folder-page-${revision}`),
      resources,
      missingResourceIds: [],
      collections: [
        {
          query: { parentId: folderId, lifecycle: 'active' },
          resourceIds: includePublishedChild ? [childId] : [],
          complete: nextComplete,
        },
      ],
    })
  }
  index.replaceSnapshot({
    scope,
    revision: indexRevision('folder-resource'),
    resources: includeChild ? resources : [resources[0]!],
    missingResourceIds: [],
    collections:
      complete === null
        ? []
        : [
            {
              query: { parentId: folderId, lifecycle: 'active' },
              resourceIds: includeChild ? [childId] : [],
              complete,
            },
          ],
  })
  const loader = {
    ensureResource: vi.fn(() => Promise.resolve({ status: 'completed' as const })),
    ensureCollection,
  } satisfies ResourceIndexLoader
  const unavailable = {
    get: () => ({ status: 'unavailable' as const, reason: 'capability_not_supported' as const }),
    subscribe: () => () => {},
  }
  const notes = {
    ...unavailable,
    export: () => ({ status: 'loading' as const }),
    create: () => Promise.reject(new Error('Not used')),
    dispose: () => {},
  } satisfies NoteSessionSource
  render(
    <CanvasResourceEmbed
      activation={null}
      canEdit
      canvases={unavailable}
      editing={false}
      index={index}
      loader={loader}
      maps={unavailable}
      node={{
        id: generateDomainId(DOMAIN_ID_KIND.canvasNode),
        type: 'embed',
        position: { x: 0, y: 0 },
        data: {
          destination: {
            kind: 'internal',
            target: { kind: 'resource', resourceId: folderId },
          },
        },
      }}
      notes={notes}
    />,
  )
  return { publish }
}
