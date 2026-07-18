import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { testDomainId } from '../../../../../shared/test/domain-id'
import { assertVersionStamp } from '../component-version'
import type { EditorRuntime, ResourceAccessGateway } from '../editor-runtime-contract'
import { RESOURCE_INDEX_SCHEMA } from '../resource-index-contract'
import type { AuthorizedResourceSummary, ResourceProjectionScope } from '../resource-index-contract'
import { canonicalizeResourceTitle } from '../resource-record'
import type { ResourceAccessPresentation } from '../resource-access-policy'
import { ResourceSharingControl } from '../workspace/resource-sharing-control'
import { MutableWorkspaceResourceIndex, indexRevision } from '../workspace-resource-index'

const campaignId = testDomainId('campaign', 'sharing-control')
const actorId = testDomainId('campaignMember', 'sharing-menu')
const participantId = testDomainId('campaignMember', 'sharing-menu-player')
const defaultParticipantId = testDomainId('campaignMember', 'sharing-menu-default-player')
const folderId = testDomainId('resource', 'sharing-menu-folder')
const scope = {
  campaignId,
  actorId,
  projection: 'dm',
  schema: RESOURCE_INDEX_SCHEMA,
} satisfies ResourceProjectionScope
const folder: AuthorizedResourceSummary = {
  id: folderId,
  campaignId,
  displayParentId: null,
  kind: 'folder',
  title: canonicalizeResourceTitle('Shared folder'),
  icon: null,
  color: null,
  lifecycle: 'active',
  permission: 'edit',
  metadataVersion: assertVersionStamp({
    scheme: 'authoritative-revision-v1',
    revision: 1,
    digest: '0'.repeat(64),
  }),
  createdAt: 1,
  updatedAt: 1,
}
const presentation: ResourceAccessPresentation = {
  policy: {
    resourceId: folderId,
    subject: 'folder',
    audienceAccess: { state: 'default' },
    inheritance: 'enabled',
  },
  defaultAccess: { permission: 'none', source: { type: 'none' } },
  participants: [
    {
      id: participantId,
      displayName: 'Avery Player',
      username: 'avery',
      imageUrl: null,
      access: { state: 'explicit', permission: 'view' },
      effectiveAccess: {
        permission: 'view',
        source: { type: 'member', resourceId: folderId },
      },
    },
    {
      id: defaultParticipantId,
      displayName: 'Blake Player',
      username: 'blake',
      imageUrl: null,
      access: { state: 'default' },
      effectiveAccess: {
        permission: 'none',
        source: { type: 'none' },
      },
    },
  ],
  participantsComplete: true,
}

describe('ResourceSharingControl', () => {
  beforeEach(() => localStorage.clear())

  it('presents canonical sharing state and submits one access command at a time', async () => {
    const user = userEvent.setup()
    let finish!: () => void
    const execute = vi.fn(
      () =>
        new Promise<Awaited<ReturnType<ResourceAccessGateway['execute']>>>((resolve) => {
          finish = () =>
            resolve({
              status: 'received',
              result: {
                status: 'completed',
                receipt: {
                  campaignId,
                  operationId: testDomainId('operation', 'sharing-menu'),
                  resourceIds: [folderId],
                },
              },
            })
        }),
    )
    const presentationKnowledge = { state: 'known', value: presentation } as const
    const access: ResourceAccessGateway = {
      execute,
      get: () => ({ state: 'known', value: 'edit' }),
      getPresentation: () => presentationKnowledge,
      loadPresentation: vi.fn(),
      loadMorePresentation: vi.fn(),
      subscribe: () => () => undefined,
    }
    const index = new MutableWorkspaceResourceIndex(scope, indexRevision('sharing-menu'))
    index.replaceSnapshot({
      scope,
      revision: indexRevision('sharing-menu-ready'),
      resources: [folder],
      missingResourceIds: [],
      collections: [],
    })
    const runtime = {
      scope,
      resources: {
        index,
        access: { status: 'available', value: access },
      },
    } as unknown as EditorRuntime

    render(<ResourceSharingControl resource={folder} runtime={runtime} />)

    expect(screen.getByRole('button', { name: 'Shared' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Shared' }))
    expect(screen.getByRole('dialog', { name: 'Share Shared folder' })).toBeInTheDocument()
    expect(screen.getByText('Other Players')).toBeInTheDocument()
    expect(screen.getByText('Avery Player')).toBeInTheDocument()
    expect(screen.getByText('@avery')).toBeInTheDocument()
    expect(screen.queryByText('Blake Player')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Avery Player permission' })).toHaveTextContent(
      'View',
    )

    await user.click(screen.getByRole('button', { name: /Other Players/ }))
    expect(screen.getByText('Blake Player')).toBeInTheDocument()
    expect(screen.getByText('@blake')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('switch', { name: 'Share through descendants' }))

    expect(execute).toHaveBeenCalledWith({
      campaignId,
      operationId: expect.any(String),
      command: {
        type: 'setFolderAccessInheritance',
        folderId,
        inheritance: 'disabled',
      },
    })
    expect(screen.getByLabelText('Updating sharing')).toBeInTheDocument()
    for (const select of screen.getAllByRole('combobox')) expect(select).toBeDisabled()
    expect(screen.getByRole('switch', { name: 'Share through descendants' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )

    finish()
    await waitFor(() => expect(screen.queryByLabelText('Updating sharing')).not.toBeInTheDocument())

    await user.click(screen.getByRole('combobox', { name: 'All Players permission' }))
    await user.click(await screen.findByRole('option', { name: 'None' }))

    expect(execute).toHaveBeenLastCalledWith({
      campaignId,
      operationId: expect.any(String),
      command: {
        type: 'setAudienceAccess',
        resourceIds: [folderId],
        permission: 'none',
      },
    })
    finish()
  })

  it('loads another participant page only when the expanded player list requests it', async () => {
    const user = userEvent.setup()
    const loadMorePresentation = vi.fn()
    const pagedKnowledge = {
      state: 'known',
      value: { ...presentation, participantsComplete: false },
    } as const
    const access: ResourceAccessGateway = {
      execute: vi.fn(),
      get: () => ({ state: 'known', value: 'edit' }),
      getPresentation: () => pagedKnowledge,
      loadPresentation: vi.fn(),
      loadMorePresentation,
      subscribe: () => () => undefined,
    }
    const index = new MutableWorkspaceResourceIndex(scope, indexRevision('sharing-pages'))
    index.replaceSnapshot({
      scope,
      revision: indexRevision('sharing-pages-ready'),
      resources: [folder],
      missingResourceIds: [],
      collections: [],
    })
    const runtime = {
      scope,
      resources: {
        index,
        access: { status: 'available', value: access },
      },
    } as unknown as EditorRuntime

    render(<ResourceSharingControl resource={folder} runtime={runtime} />)

    await user.click(screen.getByRole('button', { name: 'Shared' }))
    expect(screen.queryByRole('button', { name: 'Load more players' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Other Players/ }))
    await user.click(screen.getByRole('button', { name: 'Load more players' }))

    expect(loadMorePresentation).toHaveBeenCalledOnce()
  })
})
