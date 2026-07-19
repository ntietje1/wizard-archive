import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { NOTE_YJS_FRAGMENT, noteBlocksToYDoc } from '../../notes/document/headless-yjs'
import { initialVersion, sha256Digest } from '../component-version'
import { DOMAIN_ID_KIND, generateDomainId } from '../domain-id'
import { createInMemoryEditorRuntime } from '../in-memory-editor-runtime'
import { serializeAuthoredDestination } from '../authored-destination'
import {
  RESOURCE_INDEX_SCHEMA,
  authorizedResourceSummaryFromRecord,
} from '../resource-index-contract'
import { canonicalizeResourceTitle } from '../resource-record'
import { ResourceRightSidebar } from '../workspace/resource-right-sidebar'
import { createWorkspaceActions } from '../workspace/resource-operations'
import type {
  ItemHistoryController,
  ItemHistoryState,
  ResourceNavigation,
} from '../editor-runtime-contract'
import type { ResourceRecord } from '../resource-record'

describe('ResourceRightSidebar note outline', () => {
  it('lists canonical headings and scrolls to their stable block identities', async () => {
    const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
    const actorId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const parentHeadingId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    const headingId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    const version = initialVersion(await sha256Digest(new Uint8Array([7])))
    const noteDocument = noteBlocksToYDoc(
      [
        {
          id: parentHeadingId,
          type: 'heading',
          props: { level: 1 },
          content: [{ type: 'text', text: 'Chapter one' }],
        },
        {
          id: headingId,
          type: 'heading',
          props: { level: 2 },
          content: [{ type: 'text', text: 'Hidden vault' }],
        },
      ],
      NOTE_YJS_FRAGMENT,
    )
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
    const open = vi.fn()
    const navigation: ResourceNavigation = {
      current: () => ({ kind: 'resource', resourceId }),
      open,
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
        assetsFolderId: null,
      },
      content: { notes: [{ resourceId, content: noteDocument, version }] },
      navigation,
    })
    const navigate = vi.fn()

    render(
      <ResourceRightSidebar
        actions={createWorkspaceActions(core.runtime, vi.fn())}
        activePanel="outline"
        noteHeadingNavigation={{ current: navigate }}
        resource={authorizedResourceSummaryFromRecord(resource, 'edit')}
        runtime={core.runtime}
        onActivePanelChange={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByRole('navigation', { name: 'Note outline' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Collapse Chapter one' }))
    expect(screen.queryByRole('button', { name: 'Hidden vault' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Expand Chapter one' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hidden vault' }))
    expect(navigate).toHaveBeenCalledWith(headingId)

    core.dispose()
  })
})

describe('ResourceRightSidebar references', () => {
  it('restores outgoing link rows and opens their exact canonical targets', async () => {
    const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
    const actorId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const targetId = generateDomainId(DOMAIN_ID_KIND.resource)
    const sourceBlockId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    const blockId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    const version = initialVersion(await sha256Digest(new Uint8Array([9])))
    const records: Array<ResourceRecord> = [
      {
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
      },
      {
        id: targetId,
        campaignId,
        parentId: null,
        kind: 'note',
        title: canonicalizeResourceTitle('Hidden vault'),
        icon: null,
        color: null,
        lifecycle: { state: 'active' },
        metadataVersion: version,
        created: { at: 1, by: actorId },
        updated: { at: 1, by: actorId },
      },
    ]
    const openTarget = vi.fn()
    const navigation: ResourceNavigation = {
      current: () => ({ kind: 'resource', resourceId }),
      open: openTarget,
      subscribe: () => () => {},
    }
    const target = {
      kind: 'noteBlock' as const,
      resourceId: targetId,
      blockId,
      presentation: 'heading' as const,
    }
    const core = createInMemoryEditorRuntime({
      canEdit: true,
      scope: { campaignId, actorId, projection: 'dm', schema: RESOURCE_INDEX_SCHEMA },
      snapshot: {
        campaignId,
        resources: records,
        tombstones: [],
        aliases: [],
        assetsFolderId: null,
      },
      content: {
        notes: [
          {
            resourceId,
            version,
            content: noteBlocksToYDoc(
              [
                {
                  id: sourceBlockId,
                  type: 'paragraph',
                  content: [
                    {
                      type: 'resourceLink',
                      props: {
                        destination: serializeAuthoredDestination({
                          kind: 'internal',
                          target,
                        }),
                        label: 'Hidden vault',
                      },
                    },
                  ],
                },
              ],
              NOTE_YJS_FRAGMENT,
            ),
          },
          {
            resourceId: targetId,
            version,
            content: noteBlocksToYDoc(
              [
                {
                  id: blockId,
                  type: 'heading',
                  props: { level: 1 },
                  content: [{ type: 'text', text: 'Hidden vault' }],
                },
              ],
              NOTE_YJS_FRAGMENT,
            ),
          },
        ],
      },
      navigation,
    })
    await core.runtime.resources.loader.ensureResource(resourceId)
    await core.runtime.resources.loader.ensureResource(targetId)

    render(
      <ResourceRightSidebar
        actions={createWorkspaceActions(core.runtime, vi.fn())}
        activePanel="outgoing"
        noteHeadingNavigation={{ current: null }}
        resource={authorizedResourceSummaryFromRecord(records[0]!, 'edit')}
        runtime={core.runtime}
        onActivePanelChange={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByRole('navigation', { name: 'Outgoing links' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: /Hidden vault/ }))
    expect(openTarget).toHaveBeenCalledWith(target)

    core.dispose()
  })
})

describe('ResourceRightSidebar item history', () => {
  it('renders typed actions and reserves preview and restore controls for checkpoints', async () => {
    const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
    const actorId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const version = initialVersion(await sha256Digest(new Uint8Array([11])))
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
        assetsFolderId: null,
      },
      navigation,
    })
    const checkpointEntryId = generateDomainId(DOMAIN_ID_KIND.historyEntry)
    const state: ItemHistoryState = {
      list: {
        status: 'ready',
        pagination: 'more_available',
        entries: [
          {
            id: generateDomainId(DOMAIN_ID_KIND.historyEntry),
            resourceId,
            actor: { id: actorId, displayName: 'Mira', imageUrl: null },
            action: 'renamed',
            metadata: { from: 'Draft', to: 'Field notes' },
            createdAt: Date.now() - 1_000,
          },
          {
            id: checkpointEntryId,
            resourceId,
            actor: { id: actorId, displayName: 'Mira', imageUrl: null },
            action: 'content_edited',
            metadata: null,
            createdAt: Date.now(),
            checkpoint: {
              kind: 'note',
              snapshotId: generateDomainId(DOMAIN_ID_KIND.snapshot),
              version,
            },
          },
        ],
      },
      preview: { status: 'closed' },
      restore: { status: 'closed' },
    }
    const selectPreview = vi.fn()
    const requestRestore = vi.fn()
    const loadMore = vi.fn()
    const history: ItemHistoryController = {
      get: () => state,
      subscribe: () => () => {},
      loadMore,
      selectPreview,
      requestRestore,
      cancelRestore: vi.fn(),
      confirmRestore: vi.fn(),
    }
    const runtime = {
      ...core.runtime,
      history: { status: 'available' as const, value: history },
    }

    const view = render(
      <ResourceRightSidebar
        actions={createWorkspaceActions(runtime, vi.fn())}
        activePanel="history"
        noteHeadingNavigation={{ current: null }}
        resource={authorizedResourceSummaryFromRecord(resource, 'edit')}
        runtime={runtime}
        onActivePanelChange={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByRole('list', { name: 'Item history' })).toBeVisible()
    expect(screen.getByText(/renamed “Draft” to “Field notes”/)).toBeVisible()
    expect(screen.getAllByRole('button', { name: 'Restore this version' })).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: /Mira edited the content/ }))
    expect(selectPreview).toHaveBeenCalledWith(resourceId, checkpointEntryId)
    fireEvent.click(screen.getByRole('button', { name: 'Restore this version' }))
    expect(requestRestore).toHaveBeenCalledWith(resourceId, checkpointEntryId)
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(loadMore).toHaveBeenCalledWith(resourceId)

    view.rerender(
      <ResourceRightSidebar
        actions={createWorkspaceActions(runtime, vi.fn())}
        activePanel="history"
        noteHeadingNavigation={{ current: null }}
        resource={authorizedResourceSummaryFromRecord(resource, 'view')}
        runtime={runtime}
        onActivePanelChange={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'History' })).toBeDisabled()
    expect(screen.getByRole('heading', { name: 'Details' })).toBeVisible()
    expect(screen.queryByRole('list', { name: 'Item history' })).not.toBeInTheDocument()

    core.dispose()
  })
})
