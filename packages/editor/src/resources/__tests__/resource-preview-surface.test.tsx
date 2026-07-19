import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { NOTE_YJS_FRAGMENT, noteBlocksToYDoc } from '../../notes/document/headless-yjs'
import { assertSha256Digest } from '../component-version'
import { DOMAIN_ID_KIND, generateDomainId } from '../domain-id'
import type { EditorRuntime } from '../editor-runtime-contract'
import { RESOURCE_INDEX_SCHEMA } from '../resource-index-contract'
import type { AuthorizedResourceSummary } from '../resource-index-contract'
import { canonicalizeResourceTitle } from '../resource-record'
import { createResourcePreview } from '../resource-preview'
import { parseSafeHttpsUrl } from '../authored-destination-contract'
import { ResourcePreviewSurface } from '../workspace/resource-preview-surface'
import { indexRevision } from '../workspace-resource-index'

vi.mock('../../canvas/canvas-readonly-preview', () => ({
  CanvasReadonlyPreview: ({ focusedNodeId }: { focusedNodeId?: string | null }) => (
    <div data-focused-node={focusedNodeId ?? ''} data-testid="canvas-preview" />
  ),
}))

vi.mock('../../files/file-embed-preview', () => ({
  FileEmbedPreview: ({ title }: { title: string }) => <div data-testid="file-preview">{title}</div>,
}))

vi.mock('../../maps/map-embed-preview', () => ({
  MapEmbedPreview: ({ focusedPinId, title }: { focusedPinId?: string | null; title: string }) => (
    <div data-focused-pin={focusedPinId ?? ''} data-testid="map-preview">
      {title}
    </div>
  ),
}))

describe('ResourcePreviewSurface', () => {
  it('owns the current-resource switch for all five canonical kinds', () => {
    const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
    const actorId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    const note = resource('note', 'Note')
    const folder = resource('folder', 'Folder')
    const map = resource('map', 'Map')
    const file = resource('file', 'File')
    const canvas = resource('canvas', 'Canvas')
    const child = resource('note', 'Child')
    const blockId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    const pinId = generateDomainId(DOMAIN_ID_KIND.mapPin)
    const nodeId = generateDomainId(DOMAIN_ID_KIND.canvasNode)
    const noteDocument = noteBlocksToYDoc(
      [
        { type: 'paragraph', content: [{ type: 'text', text: 'Other note content' }] },
        {
          id: blockId,
          type: 'paragraph',
          content: [{ type: 'text', text: 'Static note content' }],
        },
      ],
      NOTE_YJS_FRAGMENT,
    )
    const source = (state: unknown) => ({
      get: () => state,
      subscribe: () => () => undefined,
    })
    const indexSnapshot = {
      scope: { campaignId, actorId, projection: 'dm' as const, schema: RESOURCE_INDEX_SCHEMA },
      revision: indexRevision('preview-test'),
      lookup: () => ({ state: 'missing' as const }),
      ancestors: () => ({ state: 'missing' as const }),
      list: () => ({ state: 'known' as const, items: [child], complete: true }),
    }
    const runtime = {
      scope: { campaignId, actorId, projection: 'dm', schema: RESOURCE_INDEX_SCHEMA },
      resources: {
        index: {
          getSnapshot: () => indexSnapshot,
          subscribe: () => () => undefined,
        },
        loader: {
          ensureCollection: () => Promise.resolve({ status: 'completed' }),
        },
      },
      content: {
        notes: source({
          status: 'initializing',
          operationId: generateDomainId(DOMAIN_ID_KIND.operation),
          local: noteDocument,
        }),
        files: source({ status: 'ready', content: {}, version: {} }),
        maps: { previews: source({ status: 'ready', preview: {} }) },
        canvases: { previews: source({ status: 'ready', document: {}, version: {} }) },
      },
    } as unknown as EditorRuntime

    const view = render(<ResourcePreviewSurface resource={note} runtime={runtime} />)
    expect(screen.getByLabelText('Note preview')).toHaveTextContent('Static note content')
    expect(screen.getByLabelText('Note preview')).toHaveTextContent('Other note content')

    view.rerender(
      <ResourcePreviewSurface
        resource={note}
        runtime={runtime}
        target={{
          kind: 'noteBlock',
          resourceId: note.id,
          blockId,
          presentation: 'block',
        }}
      />,
    )
    expect(screen.getByLabelText('Note preview')).toHaveTextContent('Static note content')
    expect(screen.getByLabelText('Note preview')).not.toHaveTextContent('Other note content')

    view.rerender(<ResourcePreviewSurface resource={folder} runtime={runtime} />)
    expect(screen.getByRole('list', { name: 'Folder contents' })).toHaveTextContent('Child')

    view.rerender(<ResourcePreviewSurface resource={map} runtime={runtime} />)
    expect(screen.getByTestId('map-preview')).toHaveTextContent('Map')
    view.rerender(
      <ResourcePreviewSurface
        resource={map}
        runtime={runtime}
        target={{ kind: 'mapPin', resourceId: map.id, pinId }}
      />,
    )
    expect(screen.getByTestId('map-preview')).toHaveAttribute('data-focused-pin', pinId)

    view.rerender(<ResourcePreviewSurface resource={file} runtime={runtime} />)
    expect(screen.getByTestId('file-preview')).toHaveTextContent('File')

    view.rerender(<ResourcePreviewSurface resource={canvas} runtime={runtime} />)
    expect(screen.getByTestId('canvas-preview')).toBeInTheDocument()
    view.rerender(
      <ResourcePreviewSurface
        resource={canvas}
        runtime={runtime}
        target={{ kind: 'canvasNode', resourceId: canvas.id, nodeId }}
      />,
    )
    expect(screen.getByTestId('canvas-preview')).toHaveAttribute('data-focused-node', nodeId)
    noteDocument.destroy()
  })

  it('preserves an embed-owned interactive note renderer', () => {
    const note = resource('note', 'Note')
    const noteDocument = noteBlocksToYDoc([{ type: 'paragraph' }], NOTE_YJS_FRAGMENT)
    const noteState = {
      status: 'initializing' as const,
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      local: noteDocument,
    }
    const runtime = {
      content: {
        notes: {
          get: () => noteState,
          subscribe: () => () => undefined,
        },
      },
    } as unknown as EditorRuntime

    render(
      <ResourcePreviewSurface
        resource={note}
        runtime={runtime}
        renderNote={({ resource: rendered }) => (
          <div data-testid="interactive-note">{rendered.title}</div>
        )}
      />,
    )

    expect(screen.getByTestId('interactive-note')).toHaveTextContent('Note')
    noteDocument.destroy()
  })

  it('uses actor-safe text, authoritative images, and deterministic card fallbacks', () => {
    const note = resource('note', 'Note')
    const file = resource('file', 'Image')
    const pdf = resource('file', 'Rules.pdf')
    const canvas = resource('canvas', 'Canvas')
    const imageUrl = parseSafeHttpsUrl('https://example.com/image.png')
    if (!imageUrl) throw new TypeError('Expected a safe test URL')
    const canvasPreviewState = { status: 'ready' as const, document: {}, version: {} }
    const previews = new Map([
      [
        note.id,
        {
          status: 'ready' as const,
          imageUrl: null,
          preview: createResourcePreview('note', 'Canonical excerpt', []),
        },
      ],
      [
        file.id,
        {
          status: 'ready' as const,
          imageUrl,
          preview: createResourcePreview('file', '', []),
        },
      ],
      [
        pdf.id,
        {
          status: 'ready' as const,
          imageUrl: null,
          preview: createResourcePreview('file', '', []),
        },
      ],
      [
        canvas.id,
        {
          status: 'ready' as const,
          imageUrl: null,
          preview: createResourcePreview('canvas', '', []),
        },
      ],
    ])
    const runtime = {
      resources: {
        previews: {
          status: 'available',
          value: {
            get: (resourceId: AuthorizedResourceSummary['id']) => previews.get(resourceId)!,
            subscribe: () => () => undefined,
          },
        },
      },
      content: {
        canvases: {
          previews: {
            get: () => canvasPreviewState,
            subscribe: () => () => undefined,
          },
        },
      },
    } as unknown as EditorRuntime

    const view = render(<ResourcePreviewSurface mode="card" resource={note} runtime={runtime} />)
    expect(screen.getByText('Canonical excerpt')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()

    view.rerender(<ResourcePreviewSurface mode="card" resource={file} runtime={runtime} />)
    const image = screen.getByRole('img', { name: 'Preview of Image' })
    expect(image).toHaveAttribute('src', imageUrl)
    fireEvent.error(image)
    expect(screen.queryByRole('img', { name: 'Preview of Image' })).not.toBeInTheDocument()
    expect(screen.getByText('File preview unavailable')).toBeInTheDocument()

    view.rerender(<ResourcePreviewSurface mode="card" resource={pdf} runtime={runtime} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('File preview unavailable')).toBeInTheDocument()

    view.rerender(<ResourcePreviewSurface mode="card" resource={canvas} runtime={runtime} />)
    expect(screen.getByTestId('canvas-preview')).toBeInTheDocument()
  })

  it('keeps unauthorized card previews content-free', () => {
    const file = resource('file', 'Private file')
    const previewState = { status: 'unavailable' as const, reason: 'unauthorized' as const }
    const runtime = {
      resources: {
        previews: {
          status: 'available',
          value: {
            get: () => previewState,
            subscribe: () => () => undefined,
          },
        },
      },
    } as unknown as EditorRuntime

    render(<ResourcePreviewSurface mode="card" resource={file} runtime={runtime} />)

    expect(screen.getByText('File preview unavailable')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})

function resource(
  kind: AuthorizedResourceSummary['kind'],
  title: string,
): AuthorizedResourceSummary {
  return {
    id: generateDomainId(DOMAIN_ID_KIND.resource),
    campaignId: generateDomainId(DOMAIN_ID_KIND.campaign),
    displayParentId: null,
    kind,
    title: canonicalizeResourceTitle(title),
    icon: null,
    color: null,
    lifecycle: 'active',
    permission: 'edit',
    metadataVersion: {
      scheme: 'authoritative-revision-v1',
      revision: 1,
      digest: assertSha256Digest('0'.repeat(64)),
    },
    createdAt: 1,
    updatedAt: 1,
  }
}
