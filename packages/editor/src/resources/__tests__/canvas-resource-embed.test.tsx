import { BlockNoteEditor } from '@blocknote/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import * as Y from 'yjs'
import { NOTE_YJS_FRAGMENT, noteBlocksToYDoc } from '../../notes/document/headless-yjs'
import { CanvasResourceEmbed } from '../workspace/canvas-resource-embed'
import { createInMemoryNoteSession } from '../in-memory-note-session'
import type {
  CanvasSessionSource,
  CanvasPreviewSource,
  FileContentSource,
  MapSessionSource,
  MapPreviewSource,
  NoteSessionSource,
} from '../content-session-contract'
import type { EditorRuntime } from '../editor-runtime-contract'
import { assertSha256Digest, initialVersion, sha256Digest } from '../component-version'
import { DOMAIN_ID_KIND, generateDomainId, generateUuidV7 } from '../domain-id'
import { RESOURCE_INDEX_SCHEMA } from '../resource-index-contract'
import type { ResourceIndexLoader, ResourceProjectionScope } from '../resource-index-contract'
import { canonicalizeResourceTitle } from '../resource-record'
import { MutableWorkspaceResourceIndex, indexRevision } from '../workspace-resource-index'

vi.mock('../../files/image-file-viewer', () => ({
  ImageFileViewer: ({ alt, url }: { alt: string; url: string }) => <img alt={alt} src={url} />,
}))

describe('CanvasResourceEmbed', () => {
  it('keeps the canonical note surface mounted while activation and target permission change', async () => {
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const sourceResourceId = generateDomainId(DOMAIN_ID_KIND.resource)
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
    const flush = vi.spyOn(session, 'flush')
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
    const note = {
      id: resourceId,
      campaignId,
      displayParentId: null,
      kind: 'note' as const,
      title: canonicalizeResourceTitle('Ship manifest'),
      icon: null,
      color: null,
      lifecycle: 'active' as const,
      permission: 'edit' as const,
      metadataVersion: version,
      createdAt: 1,
      updatedAt: 1,
    }
    index.replaceSnapshot({
      scope,
      revision: indexRevision('known-note'),
      resources: [note],
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
    const runtime = previewRuntime({ canvases, index, loader, maps, notes, scope })
    const view = render(
      <CanvasResourceEmbed
        activation={null}
        onDefaultTextColorChange={vi.fn()}
        canEdit
        editing={false}
        node={node}
        runtime={runtime}
        sourceResourceId={sourceResourceId}
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

    index.replaceSnapshot({
      scope,
      revision: indexRevision('view-note'),
      resources: [{ ...note, permission: 'view' }],
      missingResourceIds: [],
      collections: [],
    })
    await waitFor(() =>
      expect(editor.closest('[data-canvas-editable-embed="true"]')).not.toBeInTheDocument(),
    )

    view.rerender(
      <CanvasResourceEmbed
        activation={null}
        onDefaultTextColorChange={vi.fn()}
        canEdit
        editing
        node={node}
        runtime={runtime}
        sourceResourceId={sourceResourceId}
      />,
    )

    expect(screen.getByRole('textbox', { name: 'Ship manifest embedded note' })).toBe(editor)
    expect(editor).toHaveAttribute('contenteditable', 'false')
    expect(createEditor).toHaveBeenCalledTimes(creationCount)
    expect(flush).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Value' })).not.toBeInTheDocument()
    expect(loader.ensureResource).not.toHaveBeenCalled()

    index.replaceSnapshot({
      scope,
      revision: indexRevision('editable-note'),
      resources: [note],
      missingResourceIds: [],
      collections: [],
    })
    await waitFor(() => expect(editor).toHaveAttribute('contenteditable', 'true'))
    expect(createEditor).toHaveBeenCalledTimes(creationCount)
    expect(screen.getByRole('toolbar', { name: 'Canvas formatting toolbar' })).toBeInTheDocument()

    index.replaceSnapshot({
      scope,
      revision: indexRevision('downgraded-note'),
      resources: [{ ...note, permission: 'view' }],
      missingResourceIds: [],
      collections: [],
    })
    await waitFor(() => expect(editor).toHaveAttribute('contenteditable', 'false'))
    expect(flush).toHaveBeenCalledOnce()

    index.replaceSnapshot({
      scope,
      revision: indexRevision('regranted-note'),
      resources: [note],
      missingResourceIds: [],
      collections: [],
    })
    await waitFor(() => expect(editor).toHaveAttribute('contenteditable', 'true'))
    expect(createEditor).toHaveBeenCalledTimes(creationCount)

    view.rerender(
      <CanvasResourceEmbed
        activation={null}
        onDefaultTextColorChange={vi.fn()}
        canEdit={false}
        editing
        node={node}
        runtime={runtime}
        sourceResourceId={sourceResourceId}
      />,
    )
    expect(editor).toHaveAttribute('contenteditable', 'false')

    createEditor.mockRestore()
    view.unmount()
    session.dispose()
  })

  it('renders verified native file content through the shared cross-kind surface', async () => {
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
    const actorId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    const scope = {
      campaignId,
      actorId,
      projection: 'dm',
      schema: RESOURCE_INDEX_SCHEMA,
    } satisfies ResourceProjectionScope
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
    const version = initialVersion(await sha256Digest(bytes))
    const index = new MutableWorkspaceResourceIndex(scope, indexRevision('file-embed'))
    index.replaceSnapshot({
      scope,
      revision: indexRevision('known-file'),
      resources: [
        {
          id: resourceId,
          campaignId,
          displayParentId: null,
          kind: 'file',
          title: canonicalizeResourceTitle('Harbor.png'),
          icon: null,
          color: null,
          lifecycle: 'active',
          permission: 'edit',
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
    const exportFile = vi.fn(() => ({
      status: 'ready' as const,
      bytes,
      extension: 'png',
      mediaType: 'image/png',
    }))
    const fileState = {
      status: 'ready' as const,
      content: {
        attachment: 'attached' as const,
        byteSize: bytes.byteLength,
        classification: 'viewable_image' as const,
        detectedFormat: 'png',
        extension: 'png',
        mediaType: 'image/png',
        viewerUnavailableReason: null,
      },
      version,
    }
    const files = {
      createAsset: () => Promise.resolve({ status: 'rejected' as const, reason: 'unsupported' }),
      get: () => fileState,
      subscribe: () => () => {},
      export: exportFile,
      replace: () => Promise.reject(new Error('Not used')),
      dispose: () => {},
    } satisfies FileContentSource
    const unavailable = {
      get: () => ({ status: 'unavailable' as const, reason: 'capability_not_supported' as const }),
      subscribe: () => () => {},
    }
    class TestURL extends URL {}
    const revokeObjectURL = vi.fn()
    TestURL.createObjectURL = vi.fn(() => 'blob:harbor-image')
    TestURL.revokeObjectURL = revokeObjectURL
    vi.stubGlobal('URL', TestURL)
    const onMediaLayout = vi.fn()
    const view = render(
      <CanvasResourceEmbed
        activation={null}
        onDefaultTextColorChange={vi.fn()}
        canEdit
        editing={false}
        node={{
          id: generateDomainId(DOMAIN_ID_KIND.canvasNode),
          type: 'embed',
          position: { x: 0, y: 0 },
          data: {
            destination: {
              kind: 'internal',
              target: { kind: 'resource', resourceId },
            },
          },
        }}
        onMediaLayout={onMediaLayout}
        runtime={previewRuntime({
          canvases: unavailable,
          files,
          index,
          loader,
          maps: unavailable,
          notes: unavailableNoteSource(),
          scope,
        })}
        sourceResourceId={generateDomainId(DOMAIN_ID_KIND.resource)}
      />,
    )

    const image = await screen.findByRole('img', { name: 'Harbor.png' })
    expect(image).toHaveAttribute('src', 'blob:harbor-image')
    expect(screen.getByTestId('canvas-embed-floating-label')).toHaveTextContent('Harbor.png')
    expect(exportFile).toHaveBeenCalledOnce()
    Object.defineProperties(image, {
      naturalWidth: { configurable: true, value: 1600 },
      naturalHeight: { configurable: true, value: 900 },
    })
    fireEvent.load(image)
    expect(onMediaLayout).toHaveBeenCalledWith({
      kind: 'intrinsicAspectRatio',
      aspectRatio: 1.777778,
    })

    view.unmount()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:harbor-image')
    vi.unstubAllGlobals()
  })

  it('rejects a recursive canvas embed before loading content', () => {
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
    const actorId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    const scope = {
      campaignId,
      actorId,
      projection: 'dm',
      schema: RESOURCE_INDEX_SCHEMA,
    } satisfies ResourceProjectionScope
    const index = new MutableWorkspaceResourceIndex(scope, indexRevision('recursive-embed'))
    const ensureResource = vi.fn(() => Promise.resolve({ status: 'completed' as const }))
    const loader = {
      ensureResource,
      ensureCollection: vi.fn(() => Promise.resolve({ status: 'completed' as const })),
    } satisfies ResourceIndexLoader
    const unavailable = {
      get: () => ({ status: 'unavailable' as const, reason: 'capability_not_supported' as const }),
      subscribe: () => () => {},
    }
    render(
      <CanvasResourceEmbed
        activation={null}
        onDefaultTextColorChange={vi.fn()}
        canEdit
        editing={false}
        node={{
          id: generateDomainId(DOMAIN_ID_KIND.canvasNode),
          type: 'embed',
          position: { x: 0, y: 0 },
          data: {
            destination: {
              kind: 'internal',
              target: { kind: 'resource', resourceId },
            },
          },
        }}
        runtime={previewRuntime({
          canvases: unavailable,
          index,
          loader,
          maps: unavailable,
          notes: unavailableNoteSource(),
          scope,
        })}
        sourceResourceId={resourceId}
      />,
    )

    expect(screen.getByTestId('canvas-embed-floating-label')).toHaveTextContent(
      'Warning: resource embed',
    )
    expect(ensureResource).not.toHaveBeenCalled()
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

    expect(screen.getByText('Empty folder')).toBeVisible()
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
      permission: 'edit' as const,
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
      permission: 'edit' as const,
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
      onDefaultTextColorChange={vi.fn()}
      canEdit
      editing={false}
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
      runtime={previewRuntime({
        canvases: unavailable,
        index,
        loader,
        maps: unavailable,
        notes,
        scope,
      })}
      sourceResourceId={generateDomainId(DOMAIN_ID_KIND.resource)}
    />,
  )
  return { publish }
}

function previewRuntime({
  canvases,
  files: suppliedFiles,
  index,
  loader,
  maps,
  notes,
  scope,
}: {
  canvases: CanvasPreviewSource
  files?: FileContentSource
  index: EditorRuntime['resources']['index']
  loader: EditorRuntime['resources']['loader']
  maps: MapPreviewSource
  notes: NoteSessionSource
  scope: ResourceProjectionScope
}): EditorRuntime {
  const unsupported = {
    status: 'unavailable',
    reason: 'capability_not_supported',
  } as const
  const unavailable = {
    get: () => ({ status: 'unavailable' as const, reason: 'capability_not_supported' as const }),
    subscribe: () => () => {},
  }
  const files =
    suppliedFiles ??
    ({
      ...unavailable,
      createAsset: () => Promise.resolve({ status: 'rejected' as const, reason: 'unsupported' }),
      export: () => ({
        status: 'unavailable' as const,
        reason: 'capability_not_supported' as const,
      }),
      replace: () => Promise.reject(new Error('Not used')),
      dispose: () => {},
    } satisfies FileContentSource)
  const mapSessions = {
    ...unavailable,
    previews: maps,
    export: () => ({ status: 'unavailable' as const, reason: 'capability_not_supported' as const }),
    create: () => Promise.reject(new Error('Not used')),
    dispose: () => {},
  } satisfies MapSessionSource
  const canvasSessions = {
    ...unavailable,
    previews: canvases,
    export: () => ({ status: 'unavailable' as const, reason: 'capability_not_supported' as const }),
    create: () => Promise.reject(new Error('Not used')),
    dispose: () => {},
  } satisfies CanvasSessionSource
  return {
    scope,
    resources: {
      index,
      loader,
      structure: unsupported,
      access: unsupported,
      noteBlockAccess: unsupported,
      bookmarks: unsupported,
      previews: unsupported,
      references: unsupported,
      undo: unsupported,
    },
    content: { notes, files, maps: mapSessions, canvases: canvasSessions },
    navigation: {
      current: () => null,
      open: () => {},
      subscribe: () => () => {},
    },
    preferences: {
      get: () => ({ status: 'unavailable', reason: 'scope_unavailable' }),
      subscribe: () => () => {},
      patch: () => Promise.resolve(),
    },
    search: unsupported,
    history: unsupported,
    transfers: unsupported,
    viewAs: unsupported,
  }
}

function unavailableNoteSource(): NoteSessionSource {
  return {
    get: () => ({ status: 'unavailable', reason: 'capability_not_supported' }),
    subscribe: () => () => {},
    export: () => ({ status: 'unavailable', reason: 'capability_not_supported' }),
    create: () => Promise.reject(new Error('Not used')),
    dispose: () => {},
  }
}
