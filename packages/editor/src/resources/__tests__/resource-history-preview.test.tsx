import * as Y from 'yjs'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { NOTE_YJS_FRAGMENT, noteBlocksToYDoc } from '../../notes/document/headless-yjs'
import { createCanvasDocumentDoc } from '../../canvas/document-contract'
import { initialVersion, sha256Digest } from '../component-version'
import { DOMAIN_ID_KIND, generateDomainId } from '../domain-id'
import type {
  ItemHistoryController,
  ItemHistoryState,
  ResourceNavigation,
} from '../editor-runtime-contract'
import { createInMemoryEditorRuntime } from '../in-memory-editor-runtime'
import {
  RESOURCE_INDEX_SCHEMA,
  authorizedResourceSummaryFromRecord,
} from '../resource-index-contract'
import { canonicalizeResourceTitle } from '../resource-record'
import type { ResourceRecord } from '../resource-record'
import { ResourceHistoryPreview } from '../workspace/resource-history-preview'
import { createWorkspaceActions } from '../workspace/resource-operations'

async function historyPreviewFixture(state: ItemHistoryState) {
  const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
  const actorId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
  const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
  const version = initialVersion(await sha256Digest(new Uint8Array([1])))
  const resource: ResourceRecord = {
    id: resourceId,
    campaignId,
    parentId: null,
    kind: 'note',
    title: canonicalizeResourceTitle('Field notes'),
    icon: null,
    color: null,
    lifecycle: { state: 'active' },
    metadataVersion: version,
    created: { at: 1, by: actorId },
    updated: { at: 1, by: actorId },
  }
  const navigation: ResourceNavigation = {
    current: () => ({ kind: 'resource', resourceId }),
    open: vi.fn(),
    subscribe: () => () => {},
  }
  const core = createInMemoryEditorRuntime({
    canEdit: true,
    scope: { campaignId, actorId, projection: 'dm', schema: RESOURCE_INDEX_SCHEMA },
    snapshot: {
      campaignId,
      resources: [resource],
      tombstones: [],
      aliases: [],
    },
    navigation,
  })
  const selectPreview = vi.fn()
  const requestRestore = vi.fn()
  const confirmRestore = vi.fn().mockResolvedValue({ status: 'unavailable' as const })
  const subscribe = vi.fn(() => () => {})
  const source: ItemHistoryController = {
    get: () => state,
    subscribe,
    loadMore: vi.fn(),
    selectPreview,
    requestRestore,
    cancelRestore: vi.fn(),
    confirmRestore,
  }
  return {
    actions: createWorkspaceActions(core.runtime, vi.fn()),
    confirmRestore,
    core,
    requestRestore,
    resource: authorizedResourceSummaryFromRecord(resource, 'edit'),
    selectPreview,
    source,
    subscribe,
  }
}

describe('ResourceHistoryPreview', () => {
  it('keeps one controller subscription across parent renders', async () => {
    const fixture = await historyPreviewFixture({
      list: { status: 'loading' },
      preview: { status: 'closed' },
      restore: { status: 'closed' },
    })
    const view = render(
      <ResourceHistoryPreview
        actions={fixture.actions}
        resource={fixture.resource}
        runtime={fixture.core.runtime}
        source={fixture.source}
      >
        <span>Current viewport</span>
      </ResourceHistoryPreview>,
    )

    view.rerender(
      <ResourceHistoryPreview
        actions={fixture.actions}
        resource={fixture.resource}
        runtime={fixture.core.runtime}
        source={fixture.source}
      >
        <span>Current viewport</span>
      </ResourceHistoryPreview>,
    )

    expect(fixture.subscribe).toHaveBeenCalledOnce()
    fixture.core.dispose()
  })

  it('replaces the viewport while loading and owns preview exit and restore confirmation', async () => {
    const entryId = generateDomainId(DOMAIN_ID_KIND.historyEntry)
    const fixture = await historyPreviewFixture({
      list: { status: 'loading' },
      preview: { status: 'loading', entryId, entryTime: Date.now() - 1_000 },
      restore: { status: 'ready', entryId, entryTime: Date.now() - 1_000 },
    })

    render(
      <ResourceHistoryPreview
        actions={fixture.actions}
        resource={fixture.resource}
        runtime={fixture.core.runtime}
        source={fixture.source}
      >
        <span>Current viewport</span>
      </ResourceHistoryPreview>,
    )

    expect(screen.queryByText('Current viewport')).not.toBeInTheDocument()
    expect(screen.getByText(/Previewing version from/)).toBeVisible()
    expect(screen.getByText('Loading historical version')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Exit' }))
    expect(fixture.selectPreview).toHaveBeenCalledWith(fixture.resource.id, null)
    fireEvent.click(screen.getAllByRole('button', { name: 'Restore' })[0]!)
    expect(fixture.requestRestore).toHaveBeenCalledWith(fixture.resource.id, entryId)

    const dialog = screen.getByRole('alertdialog')
    expect(
      within(dialog).getByText(/current content will remain available in history/i),
    ).toBeVisible()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Restore' }))
    expect(fixture.confirmRestore).toHaveBeenCalledWith(fixture.resource.id)

    fixture.core.dispose()
  })

  it('renders historical note content through the native read-only note editor', async () => {
    const entryId = generateDomainId(DOMAIN_ID_KIND.historyEntry)
    const snapshotId = generateDomainId(DOMAIN_ID_KIND.snapshot)
    const note = noteBlocksToYDoc(
      [
        {
          id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
          type: 'paragraph',
          content: [{ type: 'text', text: 'The former inscription' }],
        },
      ],
      NOTE_YJS_FRAGMENT,
    )
    const fixture = await historyPreviewFixture({
      list: { status: 'loading' },
      preview: {
        status: 'ready',
        entryId,
        entryTime: Date.now(),
        preview: {
          kind: 'note',
          snapshotId,
          version: initialVersion(await sha256Digest(Y.encodeStateAsUpdate(note))),
          update: Y.encodeStateAsUpdate(note),
        },
      },
      restore: { status: 'closed' },
    })

    render(
      <ResourceHistoryPreview
        actions={fixture.actions}
        resource={fixture.resource}
        runtime={fixture.core.runtime}
        source={fixture.source}
      >
        <span>Current viewport</span>
      </ResourceHistoryPreview>,
    )

    const editor = await screen.findByRole('textbox', {
      name: 'Field notes historical note preview',
    })
    expect(editor).toHaveTextContent('The former inscription')
    expect(editor).toHaveAttribute('contenteditable', 'false')

    note.destroy()
    fixture.core.dispose()
  })

  it('uses the canonical read-only canvas and map preview surfaces', async () => {
    const entryId = generateDomainId(DOMAIN_ID_KIND.historyEntry)
    const canvas = createCanvasDocumentDoc({ nodes: [], edges: [] })
    const canvasUpdate = Y.encodeStateAsUpdate(canvas)
    const canvasFixture = await historyPreviewFixture({
      list: { status: 'loading' },
      preview: {
        status: 'ready',
        entryId,
        entryTime: Date.now(),
        preview: {
          kind: 'canvas',
          snapshotId: generateDomainId(DOMAIN_ID_KIND.snapshot),
          version: initialVersion(await sha256Digest(canvasUpdate)),
          update: canvasUpdate,
        },
      },
      restore: { status: 'closed' },
    })
    const canvasView = render(
      <ResourceHistoryPreview
        actions={canvasFixture.actions}
        resource={canvasFixture.resource}
        runtime={canvasFixture.core.runtime}
        source={canvasFixture.source}
      >
        <span>Current viewport</span>
      </ResourceHistoryPreview>,
    )
    expect(screen.getByTestId('canvas-readonly-preview')).toBeVisible()
    canvasView.unmount()
    canvas.destroy()
    canvasFixture.core.dispose()

    const mapFixture = await historyPreviewFixture({
      list: { status: 'loading' },
      preview: {
        status: 'ready',
        entryId,
        entryTime: Date.now(),
        preview: {
          kind: 'map',
          snapshotId: generateDomainId(DOMAIN_ID_KIND.snapshot),
          version: initialVersion(await sha256Digest(new Uint8Array([2]))),
          content: { image: { status: 'unattached' }, layers: [], pins: [] },
          loadImage: vi.fn(),
        },
      },
      restore: { status: 'closed' },
    })
    render(
      <ResourceHistoryPreview
        actions={mapFixture.actions}
        resource={mapFixture.resource}
        runtime={mapFixture.core.runtime}
        source={mapFixture.source}
      >
        <span>Current viewport</span>
      </ResourceHistoryPreview>,
    )
    expect(screen.getByText('No map image')).toBeVisible()
    mapFixture.core.dispose()
  })
})
