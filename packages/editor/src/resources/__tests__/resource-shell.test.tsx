import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import { initialVersion, sha256Digest } from '../component-version'
import { DOMAIN_ID_KIND, generateDomainId } from '../domain-id'
import type { ResourceNavigation } from '../editor-runtime-contract'
import { createInMemoryEditorRuntime } from '../in-memory-editor-runtime'
import { RESOURCE_INDEX_SCHEMA } from '../resource-index-contract'
import { canonicalizeResourceTitle } from '../resource-record'
import type { ResourceRecord } from '../resource-record'
import { ResourceShell } from '../resource-shell'

describe('ResourceShell', () => {
  it('does not render mutating controls when structure editing is unavailable', async () => {
    const { core, resource } = await shellRuntime(false)

    render(
      <ResourceShell
        ariaLabel="Read-only resources"
        runtime={core.runtime}
        workspaceName="Player view"
      />,
    )

    expect(await screen.findByRole('heading', { name: resource.title })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Duplicate' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: `Move ${resource.title} to trash` }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Note' })).not.toBeInTheDocument()
    core.dispose()
  })

  it('duplicates through the canonical structure command and opens the copy', async () => {
    const { core, navigation, resource } = await shellRuntime(true)

    render(
      <ResourceShell
        ariaLabel="Editable resources"
        runtime={core.runtime}
        workspaceName="DM view"
      />,
    )

    expect(await screen.findByRole('heading', { name: resource.title })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }))

    expect(await screen.findByText('Resource duplicated')).toBeInTheDocument()
    await waitFor(() => expect(navigation.current()).not.toBe(resource.id))
    expect(core.runtime.resources.index.getSnapshot().lookup(navigation.current()!)).toMatchObject({
      state: 'known',
      value: { title: resource.title, kind: 'folder' },
    })
    core.dispose()
  })
})

async function shellRuntime(canEdit: boolean) {
  const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
  const actorId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
  const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
  const version = initialVersion(await sha256Digest(new Uint8Array([3])))
  const resource: ResourceRecord = {
    id: resourceId,
    campaignId,
    parentId: null,
    kind: 'folder',
    title: canonicalizeResourceTitle('Campaign folder'),
    icon: null,
    color: null,
    lifecycle: { state: 'active' },
    metadataVersion: version,
    created: { at: 1, by: actorId },
    updated: { at: 1, by: actorId },
  }
  const navigation = createNavigation(resourceId)
  const core = createInMemoryEditorRuntime({
    canEdit,
    scope: {
      campaignId,
      actorId,
      projection: canEdit ? 'dm' : 'player',
      schema: RESOURCE_INDEX_SCHEMA,
    },
    snapshot: { campaignId, resources: [resource], tombstones: [], aliases: [], roles: [] },
    navigation,
  })
  return { core, navigation, resource }
}

function createNavigation(initialResourceId: ResourceRecord['id']): ResourceNavigation {
  let resourceId = initialResourceId
  const listeners = new Set<() => void>()
  return {
    current: () => resourceId,
    open: (nextResourceId) => {
      resourceId = nextResourceId
      for (const listener of listeners) listener()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
