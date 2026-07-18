import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { NOTE_YJS_FRAGMENT, noteBlocksToYDoc } from '../../notes/document/headless-yjs'
import { initialVersion, sha256Digest } from '../component-version'
import { DOMAIN_ID_KIND, generateDomainId } from '../domain-id'
import { createInMemoryEditorRuntime } from '../in-memory-editor-runtime'
import {
  RESOURCE_INDEX_SCHEMA,
  authorizedResourceSummaryFromRecord,
} from '../resource-index-contract'
import { canonicalizeResourceTitle } from '../resource-record'
import { ResourceRightSidebar } from '../workspace/resource-right-sidebar'
import { createWorkspaceActions } from '../workspace/resource-operations'
import type { EditorRuntime, ResourceNavigation } from '../editor-runtime-contract'
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
      navigation,
    })
    await core.runtime.resources.loader.ensureResource(targetId)
    const target = {
      kind: 'noteBlock' as const,
      resourceId: targetId,
      blockId,
      presentation: 'heading' as const,
    }
    const references = {
      status: 'ready' as const,
      outgoing: [{ sourceResourceId: resourceId, sourceVersion: version, target }],
      backlinks: [],
    }
    const runtime: EditorRuntime = {
      ...core.runtime,
      resources: {
        ...core.runtime.resources,
        references: {
          status: 'available',
          value: {
            get: () => references,
            subscribe: () => () => {},
          },
        },
      },
    }

    render(
      <ResourceRightSidebar
        actions={createWorkspaceActions(runtime, vi.fn())}
        activePanel="outgoing"
        noteHeadingNavigation={{ current: null }}
        resource={authorizedResourceSummaryFromRecord(records[0]!, 'edit')}
        runtime={runtime}
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
