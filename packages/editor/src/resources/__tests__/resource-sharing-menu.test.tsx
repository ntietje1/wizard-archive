import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vite-plus/test'
import { testDomainId } from '../../../../../shared/test/domain-id'
import { Popover } from '@wizard-archive/ui/shadcn/components/popover'
import { assertVersionStamp } from '../component-version'
import type { EditorRuntime, ResourceAccessGateway } from '../editor-runtime-contract'
import { RESOURCE_INDEX_SCHEMA } from '../resource-index-contract'
import type { AuthorizedResourceSummary, ResourceProjectionScope } from '../resource-index-contract'
import { canonicalizeResourceTitle } from '../resource-record'
import type { ResourceAccessPresentation } from '../resource-access-policy'
import { ResourceSharingMenu } from '../workspace/resource-sharing-menu'
import { MutableWorkspaceResourceIndex, indexRevision } from '../workspace-resource-index'

const campaignId = testDomainId('campaign', 'sharing-menu')
const actorId = testDomainId('campaignMember', 'sharing-menu')
const participantId = testDomainId('campaignMember', 'sharing-menu-player')
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
  ],
}

describe('ResourceSharingMenu', () => {
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

    render(
      <Popover open>
        <ResourceSharingMenu resource={folder} runtime={runtime} />
      </Popover>,
    )

    expect(screen.getByRole('dialog', { name: 'Share Shared folder' })).toBeInTheDocument()
    expect(screen.getByText('All players')).toBeInTheDocument()
    expect(screen.getByText('Avery Player')).toBeInTheDocument()
    expect(screen.getByText('@avery · View · explicit member')).toBeInTheDocument()
    expect(screen.getAllByRole('combobox')[0]).toHaveTextContent('Default')

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

    await user.click(screen.getAllByRole('combobox')[0]!)
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
})
