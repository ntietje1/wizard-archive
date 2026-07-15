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
    fireEvent.click(screen.getByRole('button', { name: 'More options' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }))

    expect(await screen.findByText('Resource duplicated')).toBeInTheDocument()
    await waitFor(() => expect(navigation.current()).not.toBe(resource.id))
    expect(core.runtime.resources.index.getSnapshot().lookup(navigation.current()!)).toMatchObject({
      state: 'known',
      value: { title: resource.title, kind: 'folder' },
    })
    core.dispose()
  })

  it('updates natural title, icon, and color through one metadata command', async () => {
    const { core, resource } = await shellRuntime(true)

    render(
      <ResourceShell
        ariaLabel="Editable resources"
        runtime={core.runtime}
        workspaceName="DM view"
      />,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'More options' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit details' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Resource title' }), {
      target: { value: 'Renamed folder' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Resource icon' }), {
      target: { value: 'Book' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Resource color' }), {
      target: { value: '#123456' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('heading', { name: 'Renamed folder' })).toBeInTheDocument()
    expect(core.runtime.resources.index.getSnapshot().lookup(resource.id)).toMatchObject({
      state: 'known',
      value: { title: 'Renamed folder', icon: 'Book', color: '#123456' },
    })
    core.dispose()
  })

  it('keeps exact duplicate titles unchanged when creating resources', async () => {
    const { core, resource } = await shellRuntime(true)

    render(
      <ResourceShell
        ariaLabel="Editable resources"
        runtime={core.runtime}
        workspaceName="DM view"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Create resource' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'New resource title' }), {
      target: { value: resource.title },
    })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Folder' }))

    expect(await screen.findByText('Folder created')).toBeInTheDocument()
    const roots = core.runtime.resources.index
      .getSnapshot()
      .list({ parentId: null, lifecycle: 'active' })
    expect(roots).toMatchObject({ state: 'known', complete: true })
    if (roots.state === 'known') {
      expect(roots.items.filter((item) => item.title === resource.title)).toHaveLength(2)
    }
    core.dispose()
  })

  it('requires explicit confirmation before permanent deletion', async () => {
    const { core, resource } = await shellRuntime(true, 'trashed')

    render(
      <ResourceShell
        ariaLabel="Editable resources"
        runtime={core.runtime}
        workspaceName="DM view"
      />,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'More options' }))
    fireEvent.click(screen.getByRole('menuitem', { name: `Delete ${resource.title} forever` }))
    expect(core.runtime.resources.index.getSnapshot().lookup(resource.id).state).toBe('known')
    fireEvent.click(
      screen.getByRole('menuitem', { name: `Confirm delete ${resource.title} forever` }),
    )

    await waitFor(() =>
      expect(core.runtime.resources.index.getSnapshot().lookup(resource.id).state).toBe('missing'),
    )
    core.dispose()
  })

  it('retries indeterminate delivery with the same operation identity', async () => {
    const { core, resource } = await shellRuntime(true)
    if (core.runtime.resources.structure.status !== 'available') throw new Error('expected editor')
    const authoritative = core.runtime.resources.structure.value
    const operationIds: Array<string> = []
    const runtime = {
      ...core.runtime,
      resources: {
        ...core.runtime.resources,
        structure: {
          status: 'available' as const,
          value: {
            execute: async (...args: Parameters<typeof authoritative.execute>) => {
              operationIds.push(args[0].operationId)
              if (operationIds.length === 1) {
                return {
                  status: 'indeterminate' as const,
                  retryable: true as const,
                  reason: 'response_lost' as const,
                }
              }
              return await authoritative.execute(...args)
            },
          },
        },
      },
    }

    render(
      <ResourceShell ariaLabel="Editable resources" runtime={runtime} workspaceName="DM view" />,
    )
    fireEvent.click(await screen.findByRole('button', { name: 'More options' }))
    fireEvent.click(screen.getByRole('menuitem', { name: `Move ${resource.title} to trash` }))
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))

    await waitFor(() =>
      expect(core.runtime.resources.index.getSnapshot().lookup(resource.id)).toMatchObject({
        state: 'known',
        value: { lifecycle: 'trashed' },
      }),
    )
    expect(operationIds).toHaveLength(2)
    expect(operationIds[0]).toBe(operationIds[1])
    core.dispose()
  })

  it('persists viewer mode and removes editing entry points', async () => {
    const { core } = await shellRuntime(true)

    render(
      <ResourceShell
        ariaLabel="Editable resources"
        runtime={core.runtime}
        workspaceName="DM view"
      />,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'viewer' }))
    expect(await screen.findByText('Viewer mode — editing is disabled')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create resource' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'More options' }))
    expect(screen.queryByRole('menuitem', { name: 'Duplicate' })).not.toBeInTheDocument()
    expect(core.runtime.preferences.get()).toMatchObject({
      status: 'ready',
      snapshot: { value: { mode: 'viewer' } },
    })
    core.dispose()
  })

  it('restores persisted sidebar visibility and the contextual details panel', async () => {
    const { core, resource } = await shellRuntime(true)

    render(
      <ResourceShell
        ariaLabel="Editable resources"
        runtime={core.runtime}
        workspaceName="DM view"
      />,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Close sidebar' }))
    expect(screen.queryByRole('navigation', { name: 'Sidebar' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open sidebar' }))
    expect(await screen.findByRole('navigation', { name: 'Sidebar' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open resource panel' }))
    const panel = await screen.findByRole('complementary', { name: 'Resource panel' })
    expect(panel).toHaveTextContent(resource.id)
    expect(core.runtime.preferences.get()).toMatchObject({
      status: 'ready',
      snapshot: { value: { panels: { left: { visible: true }, right: { visible: true } } } },
    })
    core.dispose()
  })

  it('supports modifier ranges and keyboard movement across visible resources', async () => {
    const { core, resource } = await shellRuntime(true)

    render(
      <ResourceShell
        ariaLabel="Editable resources"
        runtime={core.runtime}
        workspaceName="DM view"
      />,
    )

    await createFolderFromSidebar('Second folder')
    await createFolderFromSidebar('Third folder')
    const first = screen.getByRole('button', { name: resource.title })
    const second = screen.getByRole('button', { name: 'Second folder' })
    const third = screen.getByRole('button', { name: 'Third folder' })

    fireEvent.click(first)
    fireEvent.click(second, { ctrlKey: true })
    fireEvent.click(third, { shiftKey: true })
    expect(first).toHaveAttribute('data-selected', 'true')
    expect(second).toHaveAttribute('data-selected', 'true')
    expect(third).toHaveAttribute('data-selected', 'true')

    fireEvent.keyDown(third, { key: 'ArrowUp' })
    expect(second).toHaveFocus()
    expect(first).toHaveAttribute('data-selected', 'false')
    expect(second).toHaveAttribute('data-selected', 'true')
    expect(third).toHaveAttribute('data-selected', 'false')
    core.dispose()
  })

  it('copies and pastes resources through the canonical deep-copy command', async () => {
    const { core, resource } = await shellRuntime(true)

    render(
      <ResourceShell
        ariaLabel="Editable resources"
        runtime={core.runtime}
        workspaceName="DM view"
      />,
    )

    await createFolderFromSidebar('Destination')
    fireEvent.contextMenu(screen.getByRole('button', { name: resource.title }), {
      clientX: 40,
      clientY: 50,
    })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy' }))
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Destination' }), {
      clientX: 80,
      clientY: 90,
    })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Paste into folder' }))

    expect(await screen.findByText('Resource duplicated')).toBeInTheDocument()
    const destination = core.runtime.resources.index
      .getSnapshot()
      .list({ parentId: null, lifecycle: 'active' })
    if (destination.state !== 'known') throw new Error('expected loaded roots')
    const destinationId = destination.items.find((item) => item.title === 'Destination')?.id
    if (!destinationId) throw new Error('expected destination folder')
    expect(
      core.runtime.resources.index
        .getSnapshot()
        .list({ parentId: destinationId, lifecycle: 'active' }),
    ).toMatchObject({
      state: 'known',
      items: [{ title: resource.title, kind: 'folder' }],
    })
    core.dispose()
  })

  it('supports resource clipboard and lifecycle keyboard commands', async () => {
    const { core, resource } = await shellRuntime(true)

    render(
      <ResourceShell
        ariaLabel="Editable resources"
        runtime={core.runtime}
        workspaceName="DM view"
      />,
    )

    await createFolderFromSidebar('Keyboard source')
    const source = screen.getByRole('button', { name: 'Keyboard source' })
    fireEvent.click(source)
    fireEvent.keyDown(source, { key: 'c', ctrlKey: true })
    const destination = screen.getByRole('button', { name: resource.title })
    fireEvent.click(destination)
    fireEvent.keyDown(destination, { key: 'v', ctrlKey: true })

    expect(await screen.findByText('Resource duplicated')).toBeInTheDocument()
    expect(
      core.runtime.resources.index
        .getSnapshot()
        .list({ parentId: resource.id, lifecycle: 'active' }),
    ).toMatchObject({ state: 'known', items: [{ title: 'Keyboard source' }] })

    fireEvent.keyDown(destination, { key: 'Delete' })
    await waitFor(() =>
      expect(core.runtime.resources.index.getSnapshot().lookup(resource.id)).toMatchObject({
        state: 'known',
        value: { lifecycle: 'trashed' },
      }),
    )
    core.dispose()
  })

  it('searches from Ctrl+K and opens a title result', async () => {
    const { core, navigation, resource } = await shellRuntime(true)

    render(
      <ResourceShell
        ariaLabel="Editable resources"
        runtime={core.runtime}
        workspaceName="DM view"
      />,
    )

    fireEvent.keyDown(screen.getByRole('region', { name: 'Editable resources' }), {
      key: 'k',
      ctrlKey: true,
    })
    const input = await screen.findByRole('combobox', { name: 'Search' })
    fireEvent.change(input, { target: { value: 'Campaign folder' } })
    const result = await screen.findByRole('option', { name: /Campaign folder/ })
    fireEvent.click(result)

    expect(navigation.current()).toBe(resource.id)
    expect(screen.queryByRole('dialog', { name: 'Search' })).not.toBeInTheDocument()
    core.dispose()
  })

  it('bookmarks through the gateway and shows a bookmarks-only sidebar', async () => {
    const { core, resource } = await shellRuntime(true)

    render(
      <ResourceShell
        ariaLabel="Editable resources"
        runtime={core.runtime}
        workspaceName="DM view"
      />,
    )

    fireEvent.contextMenu(await screen.findByRole('button', { name: resource.title }), {
      clientX: 40,
      clientY: 50,
    })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Bookmark' }))
    expect(await screen.findByText('Bookmarked')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Bookmarks' }))

    expect(screen.getByRole('button', { name: 'Bookmarks' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: resource.title })).toBeInTheDocument()
    core.dispose()
  })

  it('restores a trashed resource by dragging it out to the workspace root', async () => {
    const { core, resource } = await shellRuntime(true, 'trashed')
    const transferData = new Map<string, string>()
    const dataTransfer = {
      dropEffect: 'none',
      effectAllowed: 'none',
      getData: (type: string) => transferData.get(type) ?? '',
      setData: (type: string, value: string) => transferData.set(type, value),
    }

    render(
      <ResourceShell
        ariaLabel="Editable resources"
        runtime={core.runtime}
        workspaceName="DM view"
      />,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Trash' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open full trash view' }))
    const source = await screen.findByRole('button', { name: resource.title })
    fireEvent.dragStart(source, { dataTransfer })
    fireEvent.drop(screen.getByLabelText('trash resource drop zone'), { dataTransfer })

    await waitFor(() =>
      expect(core.runtime.resources.index.getSnapshot().lookup(resource.id)).toMatchObject({
        state: 'known',
        value: { lifecycle: 'active', displayParentId: null },
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Trash' }))
    fireEvent.click(screen.getByRole('button', { name: 'Back to resources' }))
    expect(await screen.findByRole('button', { name: resource.title })).toBeInTheDocument()
    core.dispose()
  })

  it('empties complete trash roots only after inline confirmation', async () => {
    const { core, resource } = await shellRuntime(true, 'trashed')

    render(
      <ResourceShell
        ariaLabel="Editable resources"
        runtime={core.runtime}
        workspaceName="DM view"
      />,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Trash' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Empty Trash' }))
    expect(core.runtime.resources.index.getSnapshot().lookup(resource.id).state).toBe('known')
    fireEvent.click(screen.getByRole('button', { name: 'Confirm empty trash' }))

    await waitFor(() =>
      expect(core.runtime.resources.index.getSnapshot().lookup(resource.id).state).toBe('missing'),
    )
    core.dispose()
  })
})

async function createFolderFromSidebar(title: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Create resource' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'New resource title' }), {
    target: { value: title },
  })
  fireEvent.click(screen.getByRole('menuitem', { name: 'Folder' }))
  await screen.findByRole('button', { name: title })
}

async function shellRuntime(canEdit: boolean, lifecycle: 'active' | 'trashed' = 'active') {
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
    lifecycle:
      lifecycle === 'active' ? { state: 'active' } : { state: 'trashed', at: 1, by: actorId },
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
    snapshot: {
      campaignId,
      resources: [resource],
      tombstones: [],
      aliases: [],
      assetsFolderId: null,
    },
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
