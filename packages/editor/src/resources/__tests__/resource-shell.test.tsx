import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { Awareness } from 'y-protocols/awareness'
import { NOTE_YJS_FRAGMENT, noteBlocksToYDoc } from '../../notes/document/headless-yjs'
import { initialVersion, sha256Digest } from '../component-version'
import { DOMAIN_ID_KIND, generateDomainId } from '../domain-id'
import type { EditorRuntime, ResourceNavigation } from '../editor-runtime-contract'
import { createInMemoryEditorRuntime } from '../in-memory-editor-runtime'
import { EMPTY_FILE_CONTENT_METADATA } from '../file-content-contract'
import { initialFileContentVersion } from '../resource-content-version'
import { initialMapContentVersion } from '../map-session-policy'
import {
  RESOURCE_INDEX_SCHEMA,
  authorizedResourceSummaryFromRecord,
} from '../resource-index-contract'
import type { AuthorizedResourceSnapshot, ResourceLoadResult } from '../resource-index-contract'
import { canonicalizeResourceTitle } from '../resource-record'
import type { ResourceRecord } from '../resource-record'
import { ResourceShell } from '../resource-shell'
import { DEFAULT_WORKSPACE_PREFERENCES } from '../workspace-preferences'
import { EMPTY_WORKSPACE_SELECTION } from '../workspace-selection'
import { createWorkspaceActions } from '../workspace/resource-operations'
import { ResourceViewport } from '../workspace/resource-viewport'
import { MutableWorkspaceResourceIndex, indexRevision } from '../workspace-resource-index'

vi.mock('react-zoom-pan-pinch', () => ({
  TransformWrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
  TransformComponent: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

describe('ResourceShell', () => {
  it('becomes ready only after the initial root collection is known', async () => {
    const { core } = await shellRuntime(true)
    await core.runtime.resources.loader.ensureCollection({ parentId: null, lifecycle: 'active' })
    let releaseRoot!: () => void
    const rootGate = new Promise<void>((resolve) => {
      releaseRoot = resolve
    })
    const runtime = withControlledRootReadiness(core.runtime, async () => {
      await rootGate
      return { status: 'completed' }
    })

    render(
      <ResourceShell ariaLabel="Delayed resources" runtime={runtime} workspaceName="DM view" />,
    )

    const workspace = screen.getByRole('region', { name: 'Delayed resources' })
    expect(workspace).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Loading workspace…')
    expect(screen.queryByRole('navigation', { name: 'Sidebar' })).not.toBeInTheDocument()

    await act(async () => {
      releaseRoot()
      await rootGate
    })

    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'Delayed resources' })).toHaveAttribute(
        'aria-busy',
        'false',
      ),
    )
    expect(screen.getByRole('navigation', { name: 'Sidebar' })).toBeInTheDocument()
    core.dispose()
  })

  it('keeps the view-as exit available while the player projection is loading', async () => {
    const { core } = await shellRuntime(true)
    await core.runtime.resources.loader.ensureCollection({ parentId: null, lifecycle: 'active' })
    const selectedParticipantId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    const select = vi.fn()
    const runtime = {
      ...withControlledRootReadiness(
        core.runtime,
        () => new Promise<ResourceLoadResult>(() => undefined),
      ),
      viewAs: {
        status: 'available' as const,
        value: {
          pending: false,
          participants: [
            {
              id: selectedParticipantId,
              displayName: 'Mina',
              username: 'mina',
              imageUrl: null,
            },
          ],
          selectedParticipantId,
          select,
        },
      },
    }

    const view = render(
      <ResourceShell ariaLabel="Loading player view" runtime={runtime} workspaceName="DM view" />,
    )

    expect(screen.getByText('Viewing as')).toBeInTheDocument()
    expect(screen.getByText('Mina')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Exit' }))
    expect(select).toHaveBeenCalledExactlyOnceWith(null)
    view.unmount()
    core.dispose()
  })

  it('renders initial projection failure separately and retries to readiness', async () => {
    const { core } = await shellRuntime(true)
    await core.runtime.resources.loader.ensureCollection({ parentId: null, lifecycle: 'active' })
    let attempt = 0
    const runtime = withControlledRootReadiness(core.runtime, () => {
      attempt += 1
      return Promise.resolve(
        attempt === 1
          ? { status: 'failed', retryable: true, reason: 'network_unavailable' }
          : { status: 'completed' },
      )
    })

    render(
      <ResourceShell ariaLabel="Retrying resources" runtime={runtime} workspaceName="DM view" />,
    )

    const failure = await screen.findByRole('alert')
    expect(failure).toHaveTextContent('Could not load workspace: network_unavailable')
    expect(screen.getByRole('region', { name: 'Retrying resources' })).toHaveAttribute(
      'aria-busy',
      'false',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('navigation', { name: 'Sidebar' })).toBeInTheDocument()
    expect(attempt).toBe(2)
    core.dispose()
  })

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

  it('edits player content with resource edit permission while structure remains unavailable', async () => {
    const { core, resource } = await shellRuntime(false, 'active', 'edit', 'note')

    render(
      <ResourceShell
        ariaLabel="Player resources"
        runtime={core.runtime}
        workspaceName="Player view"
      />,
    )

    const editor = await screen.findByRole('textbox', { name: `${resource.title} note editor` })
    expect(editor).toHaveAttribute('contenteditable', 'true')
    expect(screen.queryByText('Read only')).not.toBeInTheDocument()
    expect(core.runtime.resources.structure).toMatchObject({
      status: 'unavailable',
      reason: 'unauthorized',
    })
    core.dispose()
  })

  it('keeps view permission, view-as, and viewer preference read only', async () => {
    const viewPermission = await shellRuntime(false, 'active', 'view', 'note')
    const view = render(
      <ResourceShell
        ariaLabel="View permission"
        runtime={viewPermission.core.runtime}
        workspaceName="Player view"
      />,
    )
    expect(
      await screen.findByRole('textbox', { name: `${viewPermission.resource.title} note editor` }),
    ).toHaveAttribute('contenteditable', 'false')
    view.unmount()
    viewPermission.core.dispose()

    const viewAs = await shellRuntime(false, 'active', 'edit', 'note', 'view_as_player')
    const viewAsRender = render(
      <ResourceShell
        ariaLabel="View as player"
        runtime={viewAs.core.runtime}
        workspaceName="DM view"
      />,
    )
    expect(
      await screen.findByRole('textbox', { name: `${viewAs.resource.title} note editor` }),
    ).toHaveAttribute('contenteditable', 'false')
    viewAsRender.unmount()
    viewAs.core.dispose()

    const viewerPreference = await shellRuntime(false, 'active', 'edit', 'note')
    await viewerPreference.core.runtime.preferences.patch({ field: 'mode', value: 'viewer' })
    render(
      <ResourceShell
        ariaLabel="Viewer preference"
        runtime={viewerPreference.core.runtime}
        workspaceName="Player view"
      />,
    )
    expect(
      await screen.findByRole('textbox', {
        name: `${viewerPreference.resource.title} note editor`,
      }),
    ).toHaveAttribute('contenteditable', 'false')
    expect(screen.getByText('Viewing as yourself — editing is disabled')).toBeInTheDocument()
    viewerPreference.core.dispose()
  })

  it('renders the canonical note session in view mode without persistence triggers', async () => {
    const { core, resource } = await shellRuntime(false)
    const summary = {
      ...authorizedResourceSummaryFromRecord(resource, 'edit'),
      kind: 'note' as const,
    }
    const blockId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    const document = noteBlocksToYDoc(
      [
        {
          id: blockId,
          type: 'paragraph',
          content: [{ type: 'text', text: 'Shared viewer document' }],
        },
      ],
      NOTE_YJS_FRAGMENT,
    )
    const awareness = new Awareness(document)
    const flush = vi.fn(() =>
      Promise.resolve({ status: 'completed' as const, version: resource.metadataVersion }),
    )
    const noteState = {
      status: 'ready' as const,
      session: {
        document,
        version: resource.metadataVersion,
        awareness: { status: 'unavailable' as const },
        collaboration: {
          provider: { awareness },
          user: { name: 'Player', color: '#5e6ad2' },
        },
        flush,
        retain: () => () => undefined,
        dispose: vi.fn(),
      },
    }
    const runtime = {
      ...core.runtime,
      content: {
        ...core.runtime.content,
        notes: {
          ...core.runtime.content.notes,
          get: () => noteState,
          subscribe: core.runtime.content.notes.subscribe.bind(core.runtime.content.notes),
        },
      },
    }
    const previousScrollIntoView = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollIntoView',
    )
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })
    const view = render(
      <ResourceViewport
        actions={createWorkspaceActions(runtime, vi.fn())}
        canEdit={false}
        noteHeadingNavigation={{ current: null }}
        resource={summary}
        runtime={runtime}
        selection={EMPTY_WORKSPACE_SELECTION}
        snapshot={runtime.resources.index.getSnapshot()}
        sort={DEFAULT_WORKSPACE_PREFERENCES.sort}
        target={{
          kind: 'noteBlock',
          resourceId: resource.id,
          blockId,
          presentation: 'block',
        }}
        onOpenContextMenu={vi.fn()}
        onSelectionChange={vi.fn()}
      />,
    )

    const editor = await screen.findByRole('textbox', { name: `${resource.title} note editor` })
    expect(editor).toHaveTextContent('Shared viewer document')
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled())
    fireEvent.blur(editor, { relatedTarget: null })
    view.unmount()
    expect(flush).not.toHaveBeenCalled()
    if (previousScrollIntoView) {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', previousScrollIntoView)
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
    }

    awareness.destroy()
    document.destroy()
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
    const sidebar = within(screen.getByRole('navigation', { name: 'Sidebar' }))
    fireEvent.contextMenu(sidebar.getByRole('button', { name: resource.title }), {
      clientX: 40,
      clientY: 50,
    })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }))

    expect(await screen.findByText('Resource duplicated')).toBeInTheDocument()
    await waitFor(() => expect(navigation.current()?.resourceId).not.toBe(resource.id))
    expect(
      core.runtime.resources.index.getSnapshot().lookup(navigation.current()!.resourceId),
    ).toMatchObject({
      state: 'known',
      value: { title: resource.title, kind: 'folder' },
    })
    core.dispose()
  })

  it('filters the shared topbar menu and opens panels and the canonical move picker', async () => {
    const { core, resource } = await shellRuntime(true)
    const runtime = withAvailableReferences(core.runtime)
    render(
      <ResourceShell ariaLabel="Editable resources" runtime={runtime} workspaceName="DM view" />,
    )
    await createFolderForTest(core.runtime, 'Destination')
    const roots = core.runtime.resources.index
      .getSnapshot()
      .list({ parentId: null, lifecycle: 'active' })
    if (roots.state !== 'known') throw new Error('expected loaded roots')
    const destinationId = roots.items.find((item) => item.title === 'Destination')?.id
    if (!destinationId) throw new Error('expected destination folder')

    fireEvent.click(screen.getByRole('button', { name: 'More options' }))
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Move…' })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Copy link' })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Details' })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Backlinks' })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Outgoing links' })).toBeVisible()
    expect(screen.queryByRole('menuitem', { name: 'Open' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'New…' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Copy' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Cut' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Paste' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Duplicate' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Bookmark' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('menuitem', { name: 'Backlinks' }))
    expect(await screen.findByText('No backlinks')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Close resource panel' })).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'More options' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move…' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Move resources' }))
    fireEvent.click(dialog.getByRole('option', { name: /Destination/ }))
    await waitFor(() =>
      expect(core.runtime.resources.index.getSnapshot().lookup(resource.id)).toMatchObject({
        state: 'known',
        value: { displayParentId: destinationId },
      }),
    )
    core.dispose()
  })

  it('renames from the topbar menu and edits appearance from the resource context menu', async () => {
    const { core, resource } = await shellRuntime(true)

    render(
      <ResourceShell
        ariaLabel="Editable resources"
        runtime={core.runtime}
        workspaceName="DM view"
      />,
    )

    await screen.findByRole('heading', { name: resource.title })
    fireEvent.click(screen.getByRole('button', { name: 'More options' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }))
    const title = screen.getByRole('textbox', { name: 'Resource title' })
    expect(title).toHaveFocus()
    fireEvent.change(title, {
      target: { value: 'Renamed folder' },
    })
    fireEvent.blur(title)

    expect(await screen.findByRole('heading', { name: 'Renamed folder' })).toBeInTheDocument()
    const sidebar = within(screen.getByRole('navigation', { name: 'Sidebar' }))
    fireEvent.contextMenu(sidebar.getByRole('button', { name: 'Renamed folder' }), {
      clientX: 40,
      clientY: 50,
    })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit icon and color' }))
    const appearance = await screen.findByRole('dialog', {
      name: 'Edit icon and color for Renamed folder',
    })
    expect(within(appearance).getByRole('group', { name: 'Resource color' })).toBeVisible()
    expect(within(appearance).getByRole('group', { name: 'Resource icon' })).toBeVisible()
    expect(within(appearance).queryByText('Color')).not.toBeInTheDocument()
    expect(within(appearance).queryByText('Icon')).not.toBeInTheDocument()
    fireEvent.click(within(appearance).getByRole('button', { name: 'BookOpen resource icon' }))
    await waitFor(() =>
      expect(core.runtime.resources.index.getSnapshot().lookup(resource.id)).toMatchObject({
        state: 'known',
        value: { icon: 'BookOpen' },
      }),
    )
    await waitFor(() =>
      expect(
        within(appearance).getByRole('button', { name: 'BookOpen resource icon' }),
      ).toHaveAttribute('aria-pressed', 'true'),
    )
    const red = within(appearance).getByRole('button', { name: 'Red resource color' })
    await waitFor(() => expect(red).toBeEnabled())
    fireEvent.click(red)
    await waitFor(() =>
      expect(core.runtime.resources.index.getSnapshot().lookup(resource.id)).toMatchObject({
        state: 'known',
        value: { title: 'Renamed folder', icon: 'BookOpen', color: '#f15b64' },
      }),
    )
    await waitFor(() => expect(red).toHaveAttribute('aria-pressed', 'true'))
    core.dispose()
  })

  it('renames a sidebar resource inline from its context menu', async () => {
    const { core, resource } = await shellRuntime(true)
    render(
      <ResourceShell
        ariaLabel="Editable resources"
        runtime={core.runtime}
        workspaceName="DM view"
      />,
    )

    const sidebar = within(screen.getByRole('navigation', { name: 'Sidebar' }))
    fireEvent.contextMenu(await sidebar.findByRole('button', { name: resource.title }), {
      clientX: 40,
      clientY: 50,
    })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }))
    const input = sidebar.getByRole('textbox', { name: `Rename ${resource.title}` })
    expect(input).toHaveFocus()
    fireEvent.change(input, { target: { value: 'Inline sidebar name' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(await screen.findByRole('heading', { name: 'Inline sidebar name' })).toBeVisible()
    await waitFor(() =>
      expect(sidebar.getByRole('button', { name: 'Inline sidebar name' })).toBeVisible(),
    )
    core.dispose()
  })

  it('exposes safe resource undo and redo through controls and keyboard shortcuts', async () => {
    const { core, resource } = await shellRuntime(true)
    render(
      <ResourceShell
        ariaLabel="Editable resources"
        runtime={core.runtime}
        workspaceName="DM view"
      />,
    )
    fireEvent.click(
      within(await screen.findByRole('heading', { name: resource.title })).getByRole('button'),
    )
    fireEvent.change(screen.getByRole('textbox', { name: 'Resource title' }), {
      target: { value: 'Undoable name' },
    })
    fireEvent.blur(screen.getByRole('textbox', { name: 'Resource title' }))
    expect(await screen.findByRole('heading', { name: 'Undoable name' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()

    fireEvent.contextMenu(screen.getByLabelText('resources resource drop zone'), {
      clientX: 10,
      clientY: 100,
    })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Undo rename' }))
    expect(await screen.findByRole('heading', { name: resource.title })).toBeInTheDocument()
    fireEvent.contextMenu(screen.getByLabelText('resources resource drop zone'), {
      clientX: 10,
      clientY: 100,
    })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Redo rename' }))
    expect(await screen.findByRole('heading', { name: 'Undoable name' })).toBeInTheDocument()
    core.dispose()
  })

  it('offers history, creation, and paste from the empty sidebar surface', async () => {
    const { core, resource } = await shellRuntime(true)
    render(
      <ResourceShell
        ariaLabel="Editable resources"
        runtime={core.runtime}
        workspaceName="DM view"
      />,
    )
    const sidebar = within(screen.getByRole('navigation', { name: 'Sidebar' }))
    fireEvent.contextMenu(await sidebar.findByRole('button', { name: resource.title }), {
      clientX: 40,
      clientY: 50,
    })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy' }))

    const root = screen.getByLabelText('resources resource drop zone')
    fireEvent.contextMenu(root, { clientX: 10, clientY: 100 })
    const rootMenu = within(screen.getByRole('menu', { name: 'Sidebar actions' }))
    expect(rootMenu.getByRole('menuitem', { name: 'Undo' })).toBeDisabled()
    expect(rootMenu.getByRole('menuitem', { name: 'Redo' })).toBeDisabled()
    expect(rootMenu.getByRole('menuitem', { name: 'New…' })).toBeVisible()
    expect(rootMenu.getByRole('menuitem', { name: 'Paste' })).toBeEnabled()
    fireEvent.click(rootMenu.getByRole('menuitem', { name: 'Paste' }))
    expect(await screen.findByText('Resource duplicated')).toBeVisible()
    await waitFor(() => {
      const roots = core.runtime.resources.index
        .getSnapshot()
        .list({ parentId: null, lifecycle: 'active' })
      expect(
        roots.state === 'known' ? roots.items.filter((item) => item.title === resource.title) : [],
      ).toHaveLength(2)
    })

    fireEvent.contextMenu(root, { clientX: 10, clientY: 100 })
    fireEvent.click(screen.getByRole('menuitem', { name: 'New…' }))
    fireEvent.click(
      within(screen.getByRole('menu', { name: 'New resource' })).getByRole('menuitem', {
        name: 'Folder',
      }),
    )
    expect(await screen.findByRole('heading', { name: 'Untitled folder' })).toBeVisible()
    core.dispose()
  })

  it('shows Paste only on folders and the sidebar root', async () => {
    const { core, resource } = await shellRuntime(true, 'active', 'edit', 'note')
    render(
      <ResourceShell
        ariaLabel="Editable resources"
        runtime={core.runtime}
        workspaceName="DM view"
      />,
    )
    const sidebar = within(screen.getByRole('navigation', { name: 'Sidebar' }))
    fireEvent.contextMenu(await sidebar.findByRole('button', { name: resource.title }), {
      clientX: 40,
      clientY: 50,
    })
    expect(screen.queryByRole('menuitem', { name: 'Paste' })).not.toBeInTheDocument()

    fireEvent.contextMenu(screen.getByLabelText('resources resource drop zone'), {
      clientX: 10,
      clientY: 100,
    })
    expect(screen.getByRole('menuitem', { name: 'Paste' })).toBeDisabled()
    core.dispose()
  })

  it('creates an empty file from the sidebar through the file content owner', async () => {
    const { core } = await shellRuntime(true)
    render(
      <ResourceShell
        ariaLabel="Editable resources"
        runtime={core.runtime}
        workspaceName="DM view"
      />,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Create resource' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'File' }))

    expect(await screen.findByRole('heading', { name: 'Untitled file' })).toBeInTheDocument()
    const created = core.runtime.resources.index
      .getSnapshot()
      .list({ parentId: null, lifecycle: 'active' })
    expect(created).toMatchObject({
      state: 'known',
      items: expect.arrayContaining([
        expect.objectContaining({ kind: 'file', title: 'Untitled file' }),
      ]),
    })
    if (created.state !== 'known') throw new Error('Expected created file')
    const file = created.items.find((item) => item.kind === 'file')
    if (!file) throw new Error('Expected created file')
    expect(core.runtime.content.files.get(file.id)).toMatchObject({
      status: 'ready',
      content: {
        attachment: 'unattached',
        byteSize: 0,
        detectedFormat: null,
        extension: null,
        mediaType: 'application/octet-stream',
        viewerUnavailableReason: 'empty_file',
      },
    })
    core.dispose()
  })

  it('replaces a file from the topbar menu without file-view controls', async () => {
    const { core, resource } = await shellRuntime(true, 'active', 'edit', 'file')
    render(
      <ResourceShell ariaLabel="Editable file" runtime={core.runtime} workspaceName="DM view" />,
    )

    const fileView = await screen.findByLabelText('File content')
    expect(within(fileView).queryByRole('button')).not.toBeInTheDocument()
    expect(within(fileView).queryByRole('link', { name: 'Download' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'More options' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Replace File' }))
    const bytes = new TextEncoder().encode('replacement')
    const file = new File([bytes], 'replacement.txt', { type: 'text/plain' })
    Object.defineProperty(file, 'arrayBuffer', { value: () => Promise.resolve(bytes.buffer) })
    fireEvent.change(screen.getByLabelText('Choose file replacement'), {
      target: { files: [file] },
    })

    await waitFor(() =>
      expect(core.runtime.content.files.get(resource.id)).toMatchObject({
        status: 'ready',
        content: { attachment: 'attached', byteSize: bytes.byteLength, extension: 'txt' },
      }),
    )
    core.dispose()
  })

  it('replaces the base map image from the sidebar menu without map-view replacement controls', async () => {
    const { core, resource } = await shellRuntime(true, 'active', 'edit', 'map')
    render(
      <ResourceShell ariaLabel="Editable map" runtime={core.runtime} workspaceName="DM view" />,
    )

    const mapView = await screen.findByLabelText('Map content')
    expect(
      within(mapView).queryByRole('button', { name: /choose|replace/i }),
    ).not.toBeInTheDocument()
    expect(within(mapView).queryByText(resource.title)).not.toBeInTheDocument()

    const sidebar = within(screen.getByRole('navigation', { name: 'Sidebar' }))
    fireEvent.contextMenu(sidebar.getByRole('button', { name: resource.title }), {
      clientX: 40,
      clientY: 50,
    })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Replace Map Image' }))
    const bytes = new Uint8Array([1, 2, 3])
    const file = new File([bytes], 'replacement.png', { type: 'image/png' })
    Object.defineProperty(file, 'arrayBuffer', { value: () => Promise.resolve(bytes.buffer) })
    fireEvent.change(screen.getByLabelText('Choose map image replacement'), {
      target: { files: [file] },
    })

    await waitFor(() => {
      const state = core.runtime.content.maps.get(resource.id)
      expect(state.status === 'ready' ? state.session.content.image : null).toMatchObject({
        status: 'attached',
        byteSize: bytes.byteLength,
      })
    })
    core.dispose()
  })

  it('keeps the file creation control pending without projecting a transient file', async () => {
    const { core } = await shellRuntime(true)
    const files = core.runtime.content.files
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const controlledFiles: typeof files = {
      create: async (...args) => {
        await gate
        return await files.create(...args)
      },
      createAsset: (source) => files.createAsset(source),
      dispose: () => files.dispose(),
      export: (resourceId) => files.export(resourceId),
      get: (resourceId) => files.get(resourceId),
      replace: (resourceId, version, source) => files.replace(resourceId, version, source),
      subscribe: (resourceId, listener) => files.subscribe(resourceId, listener),
    }
    const runtime = {
      ...core.runtime,
      content: { ...core.runtime.content, files: controlledFiles },
    }
    render(<ResourceShell ariaLabel="Pending file" runtime={runtime} workspaceName="DM view" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Create resource' }))
    const fileButton = screen.getByRole('menuitem', { name: 'File' })
    fireEvent.click(fileButton)

    expect(fileButton).toHaveAttribute('aria-busy', 'true')
    expect(fileButton).toBeDisabled()
    expect(screen.queryByText('Untitled file')).not.toBeInTheDocument()
    expect(screen.getByRole('menu')).toBeInTheDocument()

    release()

    expect(await screen.findByRole('heading', { name: 'Untitled file' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    core.dispose()
  })

  it('keeps the create surface pending until the completed receipt opens its resource', async () => {
    const { core, navigation, resource } = await shellRuntime(true)
    if (core.runtime.resources.structure.status !== 'available') throw new Error('expected editor')
    const authoritative = core.runtime.resources.structure.value
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const runtime = {
      ...core.runtime,
      resources: {
        ...core.runtime.resources,
        structure: {
          status: 'available' as const,
          value: {
            execute: async (...args: Parameters<typeof authoritative.execute>) => {
              await gate
              return await authoritative.execute(...args)
            },
          },
        },
      },
    }
    render(<ResourceShell ariaLabel="Pending creation" runtime={runtime} workspaceName="DM view" />)

    const trigger = await screen.findByRole('button', { name: 'Create resource' })
    fireEvent.click(trigger)
    expect(screen.queryByRole('textbox', { name: 'New resource title' })).not.toBeInTheDocument()
    const folderButton = screen.getByRole('menuitem', { name: 'Folder' })
    fireEvent.click(folderButton)

    expect(folderButton).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByText('Creating…')).not.toBeInTheDocument()
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(navigation.current()?.resourceId).toBe(resource.id)

    release()

    await waitFor(() => expect(navigation.current()?.resourceId).not.toBe(resource.id))
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    core.dispose()
  })

  it('opens a note created from an empty folder dashboard', async () => {
    const { core } = await shellRuntime(true)
    render(
      <ResourceShell ariaLabel="Folder creation" runtime={core.runtime} workspaceName="DM view" />,
    )

    expect(await screen.findByRole('heading', { name: 'Create New' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Note$/ }))

    expect(await screen.findByRole('heading', { name: 'Untitled note' })).toBeInTheDocument()
    core.dispose()
  })

  it('imports an external file dropped on an empty folder dashboard', async () => {
    const { core, navigation, resource } = await shellRuntime(true)
    const importedId = generateDomainId(DOMAIN_ID_KIND.resource)
    const runtime = {
      ...core.runtime,
      transfers: {
        status: 'available' as const,
        value: {
          execute: (intent: Parameters<NonNullableTransfer['execute']>[0]) =>
            Promise.resolve({
              jobId: intent.jobId,
              status: 'settled' as const,
              entries: [
                {
                  status: 'completed' as const,
                  sourceId: 'selected-file',
                  sourcePath: 'External.bin',
                  resourceId: importedId,
                  kind: 'file' as const,
                },
              ],
            }),
        },
      },
    } satisfies EditorRuntime
    render(<ResourceShell ariaLabel="Folder import" runtime={runtime} workspaceName="DM view" />)

    expect(await screen.findByRole('heading', { name: 'Create New' })).toBeInTheDocument()
    const dropZone = screen.getByLabelText(`${resource.title} resource drop zone`)
    const dataTransfer = {
      dropEffect: 'none',
      files: [new File(['external'], 'External.bin')],
      getData: () => '',
      items: [],
      types: ['Files'],
    }

    fireEvent.dragOver(dropZone, { dataTransfer })
    fireEvent.drop(dropZone, { dataTransfer })

    expect(await screen.findByText('Imported 1 file')).toBeInTheDocument()
    await waitFor(() => expect(navigation.current()?.resourceId).toBe(importedId))
    core.dispose()
  })

  it('replaces the native resource drag image with live workspace feedback', async () => {
    const { core, resource } = await shellRuntime(true)
    render(
      <ResourceShell
        ariaLabel="Editable resources"
        runtime={core.runtime}
        workspaceName="DM view"
      />,
    )
    const sidebar = within(screen.getByRole('navigation', { name: 'Sidebar' }))
    const row = await sidebar.findByRole('button', { name: resource.title })
    const values = new Map<string, string>()
    const dataTransfer = {
      dropEffect: 'none' as DataTransfer['dropEffect'],
      effectAllowed: 'uninitialized' as DataTransfer['effectAllowed'],
      files: [],
      getData: (type: string) => values.get(type) ?? '',
      items: [],
      setData: (type: string, value: string) => {
        values.set(type, value)
        dataTransfer.types = [...values.keys()]
      },
      setDragImage: vi.fn(),
      types: [] as Array<string>,
    }

    fireEvent.dragStart(row, { clientX: 20, clientY: 30, dataTransfer })

    expect(dataTransfer.setDragImage).toHaveBeenCalledOnce()
    expect(screen.getByTestId('resource-drag-overlay')).toHaveTextContent(resource.title)

    fireEvent.dragOver(screen.getByLabelText('resources resource drop zone'), {
      clientX: 40,
      clientY: 50,
      dataTransfer,
    })
    await waitFor(() =>
      expect(screen.getByTestId('resource-drag-overlay')).toHaveTextContent('Already in “DM view”'),
    )

    fireEvent.dragEnd(row, { dataTransfer })
    expect(screen.getByTestId('resource-drag-overlay')).toHaveClass('hidden')
    core.dispose()
  })

  it('does not navigate when the invoking creation surface unmounts', async () => {
    const { core, navigation, resource } = await shellRuntime(true)
    if (core.runtime.resources.structure.status !== 'available') throw new Error('expected editor')
    const authoritative = core.runtime.resources.structure.value
    let release!: () => void
    let deliveryFinished!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const finished = new Promise<void>((resolve) => {
      deliveryFinished = resolve
    })
    const runtime = {
      ...core.runtime,
      resources: {
        ...core.runtime.resources,
        structure: {
          status: 'available' as const,
          value: {
            execute: async (...args: Parameters<typeof authoritative.execute>) => {
              await gate
              const delivery = await authoritative.execute(...args)
              deliveryFinished()
              return delivery
            },
          },
        },
      },
    }
    const view = render(
      <ResourceShell ariaLabel="Unmounted creation" runtime={runtime} workspaceName="DM view" />,
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Create resource' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Folder' }))

    view.unmount()
    await act(async () => {
      release()
      await finished
      await Promise.resolve()
    })

    expect(navigation.current()?.resourceId).toBe(resource.id)
    core.dispose()
  })

  it('restores the create surface with the terminal rejection reason', async () => {
    const { core, navigation, resource } = await shellRuntime(true)
    if (core.runtime.resources.structure.status !== 'available') throw new Error('expected editor')
    const runtime = {
      ...core.runtime,
      resources: {
        ...core.runtime.resources,
        structure: {
          status: 'available' as const,
          value: {
            execute: () =>
              Promise.resolve({
                status: 'received' as const,
                result: { status: 'rejected' as const, reason: 'invalid_parent' as const },
              }),
          },
        },
      },
    }
    render(
      <ResourceShell ariaLabel="Rejected creation" runtime={runtime} workspaceName="DM view" />,
    )

    const trigger = await screen.findByRole('button', { name: 'Create resource' })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Folder' }))

    expect(await screen.findByText('Creation rejected: invalid_parent')).toBeInTheDocument()
    await waitFor(() => expect(trigger).toBeEnabled())
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Folder' })).toBeEnabled()
    expect(navigation.current()?.resourceId).toBe(resource.id)
    core.dispose()
  })

  it('keeps an unresolved create in its surface and retries one operation to completion', async () => {
    const { core, navigation, resource } = await shellRuntime(true)
    if (core.runtime.resources.structure.status !== 'available') throw new Error('expected editor')
    const authoritative = core.runtime.resources.structure.value
    const operationIds: Array<string> = []
    const resourceIds: Array<string> = []
    let releaseRetry!: () => void
    const retryGate = new Promise<void>((resolve) => {
      releaseRetry = resolve
    })
    const runtime = {
      ...core.runtime,
      resources: {
        ...core.runtime.resources,
        structure: {
          status: 'available' as const,
          value: {
            execute: async (...args: Parameters<typeof authoritative.execute>) => {
              operationIds.push(args[0].operationId)
              if (args[0].command.type !== 'create') throw new Error('expected create')
              resourceIds.push(args[0].command.resourceId)
              if (operationIds.length === 1) {
                return {
                  status: 'indeterminate' as const,
                  retryable: true as const,
                  reason: 'response_lost' as const,
                }
              }
              await retryGate
              return await authoritative.execute(...args)
            },
          },
        },
      },
    }
    render(
      <ResourceShell ariaLabel="Unresolved creation" runtime={runtime} workspaceName="DM view" />,
    )

    const trigger = await screen.findByRole('button', { name: 'Create resource' })
    fireEvent.click(trigger)
    const folderButton = screen.getByRole('menuitem', { name: 'Folder' })
    fireEvent.click(folderButton)

    expect(await screen.findByText('Creation unresolved: response_lost')).toBeVisible()
    expect(trigger).toBeDisabled()
    expect(screen.getByRole('menuitem', { name: 'Note' })).toBeDisabled()
    expect(navigation.current()?.resourceId).toBe(resource.id)

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(folderButton).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByText('Creating…')).not.toBeInTheDocument()
    releaseRetry()

    await waitFor(() => expect(navigation.current()?.resourceId).not.toBe(resource.id))
    expect(operationIds).toHaveLength(2)
    expect(operationIds[1]).toBe(operationIds[0])
    expect(resourceIds[1]).toBe(resourceIds[0])
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    core.dispose()
  })

  it('retries note creation with the same canonical document', async () => {
    const { core } = await shellRuntime(true)
    const authoritative = core.runtime.content.notes
    const documents: Array<Parameters<typeof authoritative.create>[1]> = []
    const notes: typeof authoritative = {
      get: (resourceId) => authoritative.get(resourceId),
      subscribe: (resourceId, listener) => authoritative.subscribe(resourceId, listener),
      export: (resourceId) => authoritative.export(resourceId),
      create: async (...args) => {
        documents.push(args[1])
        if (documents.length === 1) {
          return {
            status: 'indeterminate',
            retryable: true,
            reason: 'response_lost',
          }
        }
        return await authoritative.create(...args)
      },
      dispose: () => authoritative.dispose(),
    }
    const runtime = {
      ...core.runtime,
      content: { ...core.runtime.content, notes },
    }
    render(
      <ResourceShell ariaLabel="Retried note creation" runtime={runtime} workspaceName="DM view" />,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Create resource' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Note' }))
    expect(await screen.findByText('Creation unresolved: response_lost')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('heading', { name: 'Untitled note' })).toBeVisible()
    expect(documents).toHaveLength(2)
    expect(documents[1]).toBe(documents[0])
    core.dispose()
  })

  it('offers export, checked reapply, and discard for conflicted note edits', async () => {
    const { core } = await shellRuntime(true, 'active', 'edit', 'note')
    const recovery = {
      export: vi.fn(() => ({
        status: 'ready' as const,
        bytes: new TextEncoder().encode('Recovered note'),
        extension: 'md',
        mediaType: 'text/markdown',
      })),
      reapply: vi.fn(() =>
        Promise.resolve({ status: 'rejected' as const, reason: 'content_changed' as const }),
      ),
      discard: vi.fn(() => ({ status: 'completed' as const })),
    }
    const recoveryState = {
      status: 'recovery_required' as const,
      issue: 'version_mismatch' as const,
      recovery,
    }
    const runtime = {
      ...core.runtime,
      content: {
        ...core.runtime.content,
        notes: {
          ...core.runtime.content.notes,
          get: () => recoveryState,
          subscribe: () => () => undefined,
        },
      },
    }
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:recovery')
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    render(
      <ResourceShell ariaLabel="Recovery workspace" runtime={runtime} workspaceName="DM view" />,
    )

    expect(await screen.findByText('Unsaved edits need your attention')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Export edits' }))
    expect(recovery.export).toHaveBeenCalledOnce()
    expect(createObjectUrl).toHaveBeenCalledOnce()
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:recovery')

    fireEvent.click(screen.getByRole('button', { name: 'Reapply edits' }))
    expect(await screen.findByText('content_changed')).toBeVisible()
    expect(recovery.reapply).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Discard edits' }))
    expect(recovery.discard).toHaveBeenCalledOnce()

    createObjectUrl.mockRestore()
    revokeObjectUrl.mockRestore()
    core.dispose()
  })

  it('retires an unresolved create when navigation leaves its invoking surface', async () => {
    const { core, navigation, resource } = await shellRuntime(true)
    if (core.runtime.resources.structure.status !== 'available') throw new Error('expected editor')
    const execute = vi.fn(() =>
      Promise.resolve({
        status: 'indeterminate' as const,
        retryable: true as const,
        reason: 'response_lost' as const,
      }),
    )
    const runtime = {
      ...core.runtime,
      resources: {
        ...core.runtime.resources,
        structure: { status: 'available' as const, value: { execute } },
      },
    }
    render(<ResourceShell ariaLabel="Retired creation" runtime={runtime} workspaceName="DM view" />)

    const trigger = await screen.findByRole('button', { name: 'Create resource' })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Folder' }))
    expect(await screen.findByText('Creation unresolved: response_lost')).toBeVisible()

    act(() => navigation.open({ kind: 'resource', resourceId: resource.id }))

    await waitFor(() => expect(trigger).toBeEnabled())
    expect(screen.queryByText('Creation unresolved: response_lost')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
    expect(execute).toHaveBeenCalledOnce()
    core.dispose()
  })

  it('retires an unresolved create when its campaign changes', async () => {
    const { core } = await shellRuntime(true)
    const execute = vi.fn(() =>
      Promise.resolve({
        status: 'indeterminate' as const,
        retryable: true as const,
        reason: 'response_lost' as const,
      }),
    )
    const runtime = {
      ...core.runtime,
      resources: {
        ...core.runtime.resources,
        structure: { status: 'available' as const, value: { execute } },
      },
    }
    const view = render(
      <ResourceShell ariaLabel="Campaign creation" runtime={runtime} workspaceName="DM view" />,
    )

    const trigger = await screen.findByRole('button', { name: 'Create resource' })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Folder' }))
    expect(await screen.findByText('Creation unresolved: response_lost')).toBeVisible()

    view.rerender(
      <ResourceShell
        ariaLabel="Campaign creation"
        runtime={{
          ...runtime,
          scope: {
            ...runtime.scope,
            campaignId: generateDomainId(DOMAIN_ID_KIND.campaign),
          },
        }}
        workspaceName="DM view"
      />,
    )

    await waitFor(() => expect(trigger).toBeEnabled())
    expect(screen.queryByText('Creation unresolved: response_lost')).not.toBeInTheDocument()
    expect(execute).toHaveBeenCalledOnce()
    core.dispose()
  })

  it('requires abandonment before a fresh create and allocates a new operation identity', async () => {
    const { core, navigation, resource } = await shellRuntime(true)
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
              return operationIds.length === 1
                ? {
                    status: 'indeterminate' as const,
                    retryable: true as const,
                    reason: 'response_lost' as const,
                  }
                : await authoritative.execute(...args)
            },
          },
        },
      },
    }
    render(
      <ResourceShell ariaLabel="Abandoned creation" runtime={runtime} workspaceName="DM view" />,
    )

    const trigger = await screen.findByRole('button', { name: 'Create resource' })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Folder' }))
    expect(await screen.findByText('Creation unresolved: response_lost')).toBeVisible()
    expect(trigger).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(trigger).toBeEnabled()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Folder' }))

    await waitFor(() => expect(navigation.current()?.resourceId).not.toBe(resource.id))
    expect(operationIds).toHaveLength(2)
    expect(operationIds[1]).not.toBe(operationIds[0])
    core.dispose()
  })

  it('returns an indeterminate create settlement whose retry reuses the operation identity', async () => {
    const { core, navigation, resource } = await shellRuntime(true)
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
              return operationIds.length === 1
                ? {
                    status: 'indeterminate' as const,
                    retryable: true as const,
                    reason: 'response_lost' as const,
                  }
                : await authoritative.execute(...args)
            },
          },
        },
      },
    }
    const settlement = await createWorkspaceActions(runtime, vi.fn()).create(
      'folder',
      null,
      'Uncertain folder',
    )

    expect(settlement).toMatchObject({ status: 'indeterminate', reason: 'response_lost' })
    if (settlement.status !== 'indeterminate') throw new Error('expected indeterminate creation')
    expect(navigation.current()?.resourceId).toBe(resource.id)

    await expect(settlement.retry()).resolves.toMatchObject({ status: 'completed' })
    expect(operationIds).toHaveLength(2)
    expect(operationIds[1]).toBe(operationIds[0])
    expect(navigation.current()?.resourceId).toBe(resource.id)
    core.dispose()
  })

  it('returns a retryable provider failure without an unhandled creation promise', async () => {
    const { core, navigation, resource } = await shellRuntime(true)
    if (core.runtime.resources.structure.status !== 'available') throw new Error('expected editor')
    const authoritative = core.runtime.resources.structure.value
    const operationIds: Array<string> = []
    const report = vi.fn()
    const runtime = {
      ...core.runtime,
      resources: {
        ...core.runtime.resources,
        structure: {
          status: 'available' as const,
          value: {
            execute: async (...args: Parameters<typeof authoritative.execute>) => {
              operationIds.push(args[0].operationId)
              if (operationIds.length === 1) throw new Error('provider unavailable')
              return await authoritative.execute(...args)
            },
          },
        },
      },
    }

    const settlement = await createWorkspaceActions(runtime, report).create(
      'folder',
      null,
      'Retryable folder',
    )

    expect(settlement).toMatchObject({ status: 'failed', reason: 'provider_failure' })
    if (settlement.status !== 'failed' || !settlement.retry) {
      throw new Error('expected retryable provider failure')
    }
    expect(report).not.toHaveBeenCalled()
    expect(navigation.current()?.resourceId).toBe(resource.id)

    await expect(settlement.retry()).resolves.toMatchObject({ status: 'completed' })
    expect(operationIds[1]).toBe(operationIds[0])
    expect(navigation.current()?.resourceId).toBe(resource.id)
    core.dispose()
  })

  it('creates resources inside folders from the folder context menu', async () => {
    const { core, navigation, resource } = await shellRuntime(true)
    render(
      <ResourceShell
        ariaLabel="Editable resources"
        runtime={core.runtime}
        workspaceName="DM view"
      />,
    )

    const sidebar = within(screen.getByRole('navigation', { name: 'Sidebar' }))
    fireEvent.contextMenu(await sidebar.findByRole('button', { name: resource.title }), {
      clientX: 40,
      clientY: 50,
    })
    fireEvent.click(screen.getByRole('menuitem', { name: 'New…' }))
    fireEvent.click(
      within(screen.getByRole('menu', { name: 'New resource' })).getByRole('menuitem', {
        name: 'Map',
      }),
    )

    await waitFor(() => expect(navigation.current()?.resourceId).not.toBe(resource.id))
    const createdId = navigation.current()?.resourceId
    if (!createdId) throw new Error('expected created map to open')
    expect(core.runtime.resources.index.getSnapshot().lookup(createdId)).toMatchObject({
      state: 'known',
      value: { kind: 'map', displayParentId: resource.id, title: 'Untitled map' },
    })

    fireEvent.click(sidebar.getByRole('button', { name: resource.title }))
    fireEvent.click(screen.getByRole('button', { name: 'Enter close-all-folders mode' }))
    expect(sidebar.queryByRole('button', { name: 'Untitled map' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Exit close-all-folders mode' }))
    expect(sidebar.getByRole('button', { name: 'Untitled map' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Enter close-all-folders mode' }))
    act(() => navigation.open({ kind: 'resource', resourceId: createdId }))
    await waitFor(() => expect(sidebar.getByRole('button', { name: 'Untitled map' })).toBeVisible())
    expect(screen.getByRole('button', { name: 'Enter close-all-folders mode' })).not.toBePressed()
    core.dispose()
  })

  it('keeps empty folders togglable from the hover-caret control', async () => {
    const { core, resource } = await shellRuntime(true)
    render(
      <ResourceShell
        ariaLabel="Editable resources"
        runtime={core.runtime}
        workspaceName="DM view"
      />,
    )

    const expand = await screen.findByRole('button', { name: `Expand ${resource.title}` })
    expect(expand).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(expand)
    const collapse = screen.getByRole('button', { name: `Collapse ${resource.title}` })
    expect(collapse).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(collapse)
    expect(screen.getByRole('button', { name: `Expand ${resource.title}` })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    core.dispose()
  })

  it('creates resources with their default title and no inline naming step', async () => {
    const { core } = await shellRuntime(true)

    render(
      <ResourceShell
        ariaLabel="Editable resources"
        runtime={core.runtime}
        workspaceName="DM view"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Create resource' }))
    expect(screen.queryByRole('textbox', { name: 'New resource title' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Folder' }))

    await screen.findByRole('heading', { name: 'Untitled folder' })
    const roots = core.runtime.resources.index.getSnapshot().list({
      parentId: null,
      lifecycle: 'active',
    })
    expect(roots).toMatchObject({ state: 'known', complete: true })
    if (roots.state === 'known') {
      expect(roots.items.filter((item) => item.title === 'Untitled folder')).toHaveLength(1)
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
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete Forever' }))
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
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move to Trash' }))
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

    fireEvent.click(await screen.findByRole('button', { name: 'View as...' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'View as yourself' }))
    expect(await screen.findByText('Viewing as yourself — editing is disabled')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create resource' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'More options' }))
    expect(screen.queryByRole('menuitem', { name: 'Duplicate' })).not.toBeInTheDocument()
    expect(core.runtime.preferences.get()).toMatchObject({
      status: 'ready',
      value: { mode: 'viewer' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Exit view as' }))
    expect(await screen.findByRole('button', { name: 'Create resource' })).toBeInTheDocument()
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
      value: { panels: { leftVisible: true, rightVisible: true } },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Close resource panel' }))
    expect(screen.queryByRole('complementary', { name: 'Resource panel' })).not.toBeInTheDocument()
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

    await createFolderForTest(core.runtime, 'Second folder')
    await createFolderForTest(core.runtime, 'Third folder')
    const sidebar = within(screen.getByRole('navigation', { name: 'Sidebar' }))
    const first = sidebar.getByRole('button', { name: resource.title })
    const second = sidebar.getByRole('button', { name: 'Second folder' })
    const third = sidebar.getByRole('button', { name: 'Third folder' })

    fireEvent.click(first)
    fireEvent.click(second, { ctrlKey: true })
    fireEvent.click(third, { shiftKey: true })
    expect(first).toHaveAttribute('data-selected', 'true')
    expect(second).toHaveAttribute('data-selected', 'true')
    expect(third).toHaveAttribute('data-selected', 'true')

    fireEvent.keyDown(third, { key: 'ArrowDown' })
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

    await createFolderForTest(core.runtime, 'Destination')
    const sidebar = within(screen.getByRole('navigation', { name: 'Sidebar' }))
    fireEvent.contextMenu(sidebar.getByRole('button', { name: resource.title }), {
      clientX: 40,
      clientY: 50,
    })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy' }))
    fireEvent.contextMenu(sidebar.getByRole('button', { name: 'Destination' }), {
      clientX: 80,
      clientY: 90,
    })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Paste' }))

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

  it('moves resources through the folder target picker', async () => {
    const { core, resource } = await shellRuntime(true)

    render(
      <ResourceShell
        ariaLabel="Editable resources"
        runtime={core.runtime}
        workspaceName="DM view"
      />,
    )

    await createFolderForTest(core.runtime, 'Destination')
    const roots = core.runtime.resources.index
      .getSnapshot()
      .list({ parentId: null, lifecycle: 'active' })
    if (roots.state !== 'known') throw new Error('expected loaded roots')
    const destinationId = roots.items.find((item) => item.title === 'Destination')?.id
    if (!destinationId) throw new Error('expected destination folder')
    const sidebar = within(screen.getByRole('navigation', { name: 'Sidebar' }))
    fireEvent.contextMenu(sidebar.getByRole('button', { name: resource.title }), {
      clientX: 40,
      clientY: 50,
    })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move…' }))

    const dialog = within(screen.getByRole('dialog', { name: 'Move resources' }))
    expect(dialog.getByRole('option', { name: /Workspace root/ })).toBeDisabled()
    fireEvent.click(dialog.getByRole('option', { name: /Destination/ }))

    await waitFor(() =>
      expect(core.runtime.resources.index.getSnapshot().lookup(resource.id)).toMatchObject({
        state: 'known',
        value: { displayParentId: destinationId },
      }),
    )
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Move resources' })).not.toBeInTheDocument(),
    )
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

    await createFolderForTest(core.runtime, 'Keyboard source')
    const sidebar = within(screen.getByRole('navigation', { name: 'Sidebar' }))
    const source = sidebar.getByRole('button', { name: 'Keyboard source' })
    fireEvent.click(source)
    fireEvent.keyDown(source, { key: 'c', ctrlKey: true })
    const destination = sidebar.getByRole('button', { name: resource.title })
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

    expect(navigation.current()?.resourceId).toBe(resource.id)
    expect(screen.queryByRole('dialog', { name: 'Search' })).not.toBeInTheDocument()
    core.dispose()
  })

  it('opens search with a recent-resource snapshot', async () => {
    const { core, resource } = await shellRuntime(true)
    if (core.runtime.search.status !== 'available') throw new TypeError('Search is unavailable')
    const recentResources = [resource.id]
    const runtime = {
      ...core.runtime,
      search: {
        status: 'available' as const,
        value: {
          ...core.runtime.search.value,
          recent: () => recentResources,
        },
      },
    }

    render(
      <ResourceShell ariaLabel="Fresh recent resources" runtime={runtime} workspaceName="DM" />,
    )

    fireEvent.keyDown(screen.getByRole('region', { name: 'Fresh recent resources' }), {
      key: 'k',
      ctrlKey: true,
    })

    expect(await screen.findByRole('dialog', { name: 'Search' })).toBeVisible()
    expect(screen.getByRole('option', { name: /Campaign folder/ })).toBeVisible()
    core.dispose()
  })

  it('reports an incomplete bounded search without discarding rank-safe results', async () => {
    const { core, resource } = await shellRuntime(true)
    if (core.runtime.search.status !== 'available') throw new TypeError('Search is unavailable')
    const runtime = {
      ...core.runtime,
      search: {
        status: 'available' as const,
        value: {
          ...core.runtime.search.value,
          search: () =>
            Promise.resolve({
              status: 'incomplete' as const,
              results: [{ resourceId: resource.id, match: { type: 'title' as const } }],
            }),
        },
      },
    }

    render(
      <ResourceShell ariaLabel="Editable resources" runtime={runtime} workspaceName="DM view" />,
    )

    fireEvent.keyDown(screen.getByRole('region', { name: 'Editable resources' }), {
      key: 'k',
      ctrlKey: true,
    })
    fireEvent.change(await screen.findByRole('combobox', { name: 'Search' }), {
      target: { value: 'common' },
    })

    expect(
      await screen.findByText('1 ranked results · refine your search for complete results'),
    ).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Campaign folder/ })).toBeInTheDocument()
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

    const sidebar = within(screen.getByRole('navigation', { name: 'Sidebar' }))
    fireEvent.contextMenu(await sidebar.findByRole('button', { name: resource.title }), {
      clientX: 40,
      clientY: 50,
    })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Bookmark' }))
    if (core.runtime.resources.bookmarks.status !== 'available') {
      throw new Error('Expected bookmarks')
    }
    const bookmarks = core.runtime.resources.bookmarks.value
    await waitFor(() => {
      const bookmarkState = bookmarks.get()
      expect(bookmarkState.state === 'known' && bookmarkState.value.has(resource.id)).toBe(true)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Show bookmarks' }))

    expect(screen.getByRole('button', { name: 'Exit bookmarks' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(sidebar.getByRole('button', { name: resource.title })).toBeInTheDocument()
    core.dispose()
  })

  it('restores a trashed resource from the compact trash surface', async () => {
    const { core, resource } = await shellRuntime(true, 'trashed')

    render(
      <ResourceShell
        ariaLabel="Editable resources"
        runtime={core.runtime}
        workspaceName="DM view"
      />,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Trash' }))
    fireEvent.click(await screen.findByRole('button', { name: `Restore ${resource.title}` }))

    await waitFor(() =>
      expect(core.runtime.resources.index.getSnapshot().lookup(resource.id)).toMatchObject({
        state: 'known',
        value: { lifecycle: 'active', displayParentId: null },
      }),
    )
    expect(
      await within(screen.getByRole('navigation', { name: 'Sidebar' })).findByRole('button', {
        name: resource.title,
      }),
    ).toBeInTheDocument()
    core.dispose()
  })

  it('permanently deletes one trashed resource from the compact trash surface', async () => {
    const { core, resource } = await shellRuntime(true, 'trashed')

    render(
      <ResourceShell
        ariaLabel="Editable resources"
        runtime={core.runtime}
        workspaceName="DM view"
      />,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Trash' }))
    expect(screen.queryByText('Trash', { selector: 'strong' })).not.toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: `Delete ${resource.title} forever` }))
    expect(core.runtime.resources.index.getSnapshot().lookup(resource.id).state).toBe('known')
    fireEvent.click(
      screen.getByRole('button', { name: `Confirm delete ${resource.title} forever` }),
    )

    await waitFor(() =>
      expect(core.runtime.resources.index.getSnapshot().lookup(resource.id).state).toBe('missing'),
    )
    core.dispose()
  })

  it('offers an accessible continuation action for incomplete folder knowledge', async () => {
    const { core, resource } = await shellRuntime(false)
    const summary = authorizedResourceSummaryFromRecord(resource, 'edit')
    const child = {
      ...summary,
      id: generateDomainId(DOMAIN_ID_KIND.resource),
      kind: 'note' as const,
      title: canonicalizeResourceTitle('Child note'),
    }
    const baseSnapshot = core.runtime.resources.index.getSnapshot()
    const snapshot = {
      ...baseSnapshot,
      list: (candidate: Parameters<typeof baseSnapshot.list>[0]) =>
        candidate.parentId === resource.id
          ? { state: 'known' as const, items: [child], complete: false }
          : baseSnapshot.list(candidate),
    }
    const ensureCollection = vi.fn(() => Promise.resolve({ status: 'completed' as const }))
    const runtime = {
      ...core.runtime,
      resources: {
        ...core.runtime.resources,
        loader: { ...core.runtime.resources.loader, ensureCollection },
      },
    }

    render(
      <ResourceViewport
        actions={createWorkspaceActions(runtime, vi.fn())}
        canEdit={false}
        noteHeadingNavigation={{ current: null }}
        resource={summary}
        runtime={runtime}
        selection={EMPTY_WORKSPACE_SELECTION}
        snapshot={snapshot}
        sort={DEFAULT_WORKSPACE_PREFERENCES.sort}
        target={{ kind: 'resource', resourceId: resource.id }}
        onOpenContextMenu={vi.fn()}
        onSelectionChange={vi.fn()}
      />,
    )

    await waitFor(() => expect(ensureCollection).toHaveBeenCalledOnce())
    fireEvent.click(screen.getByRole('button', { name: 'Load more resources' }))
    await waitFor(() => expect(ensureCollection).toHaveBeenCalledTimes(2))
    core.dispose()
  })

  it('subscribes the active kind-owned content viewport and renders its loaded state', async () => {
    const { core, resource } = await shellRuntime(false)
    const summary = {
      ...authorizedResourceSummaryFromRecord(resource, 'edit'),
      kind: 'file' as const,
    }
    let state: ReturnType<typeof core.runtime.content.files.get> = { status: 'loading' }
    const listeners = new Set<() => void>()
    const unsubscribe = vi.fn()
    const subscribe = vi.fn((_resourceId: ResourceRecord['id'], listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
        unsubscribe()
      }
    })
    const runtime = {
      ...core.runtime,
      content: {
        ...core.runtime.content,
        files: {
          ...core.runtime.content.files,
          get: () => state,
          subscribe,
        },
      },
    }
    const view = render(
      <ResourceViewport
        actions={createWorkspaceActions(runtime, vi.fn())}
        canEdit={false}
        noteHeadingNavigation={{ current: null }}
        resource={summary}
        runtime={runtime}
        selection={EMPTY_WORKSPACE_SELECTION}
        snapshot={runtime.resources.index.getSnapshot()}
        sort={DEFAULT_WORKSPACE_PREFERENCES.sort}
        target={{ kind: 'resource', resourceId: resource.id }}
        onOpenContextMenu={vi.fn()}
        onSelectionChange={vi.fn()}
      />,
    )

    expect(subscribe).toHaveBeenCalledWith(resource.id, expect.any(Function))
    await act(async () => {
      state = {
        status: 'ready',
        content: {
          attachment: 'unattached',
          byteSize: 0,
          classification: 'inert_file',
          detectedFormat: null,
          extension: null,
          mediaType: 'application/octet-stream',
          viewerUnavailableReason: 'empty_file',
        },
        version: initialVersion(await sha256Digest(new Uint8Array())),
      }
      for (const listener of listeners) listener()
    })
    expect(screen.getByLabelText('File content')).toBeInTheDocument()
    expect(subscribe).toHaveBeenCalledOnce()

    view.unmount()
    expect(unsubscribe).toHaveBeenCalled()
    core.dispose()
  })
})

async function createFolderForTest(runtime: EditorRuntime, title: string) {
  await act(() => createWorkspaceActions(runtime, vi.fn()).create('folder', null, title))
  await within(screen.getByRole('navigation', { name: 'Sidebar' })).findByRole('button', {
    name: title,
  })
}

type NonNullableTransfer = Extract<EditorRuntime['transfers'], { status: 'available' }>['value']

function withAvailableReferences(runtime: EditorRuntime): EditorRuntime {
  const state = {
    status: 'ready' as const,
    outgoing: { status: 'ready' as const, edges: [] },
    backlinks: { status: 'ready' as const, edges: [] },
  }
  return {
    ...runtime,
    resources: {
      ...runtime.resources,
      references: {
        status: 'available',
        value: {
          get: () => state,
          subscribe: () => () => undefined,
        },
      },
    },
  }
}

async function shellRuntime(
  canEdit: boolean,
  lifecycle: 'active' | 'trashed' = 'active',
  permission: 'edit' | 'view' = canEdit ? 'edit' : 'view',
  kind: ResourceRecord['kind'] = 'folder',
  projection: 'dm' | 'player' | 'view_as_player' = canEdit ? 'dm' : 'player',
) {
  const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
  const actorId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
  const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
  const version = initialVersion(await sha256Digest(new Uint8Array([3])))
  const resource: ResourceRecord = {
    id: resourceId,
    campaignId,
    parentId: null,
    kind,
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
  const emptyBytes = new Uint8Array()
  const fileContent = { ...EMPTY_FILE_CONTENT_METADATA, attachment: 'unattached' as const }
  const mapContent = { image: { status: 'unattached' as const }, layers: [], pins: [] }
  const content =
    kind === 'note'
      ? {
          notes: [
            {
              resourceId,
              content: noteBlocksToYDoc(
                [{ type: 'paragraph', content: [{ type: 'text', text: 'Player note' }] }],
                NOTE_YJS_FRAGMENT,
              ),
              version,
            },
          ],
        }
      : kind === 'file'
        ? {
            files: [
              {
                resourceId,
                content: fileContent,
                version: await initialFileContentVersion(emptyBytes, EMPTY_FILE_CONTENT_METADATA),
                bytes: emptyBytes,
              },
            ],
          }
        : kind === 'map'
          ? {
              maps: [
                {
                  resourceId,
                  content: mapContent,
                  version: await initialMapContentVersion(mapContent),
                  images: [],
                },
              ],
            }
          : undefined
  const core = createInMemoryEditorRuntime({
    scope:
      projection === 'player' || projection === 'view_as_player'
        ? { campaignId, actorId, projection, permission, schema: RESOURCE_INDEX_SCHEMA }
        : { campaignId, actorId, projection, schema: RESOURCE_INDEX_SCHEMA },
    snapshot: {
      campaignId,
      resources: [resource],
      tombstones: [],
      aliases: [],
    },
    ...(content ? { content } : {}),
    navigation,
  })
  return { core, navigation, resource }
}

function createNavigation(initialResourceId: ResourceRecord['id']): ResourceNavigation {
  let target: ReturnType<ResourceNavigation['current']> = {
    kind: 'resource',
    resourceId: initialResourceId,
  }
  const listeners = new Set<() => void>()
  return {
    current: () => target,
    open: (nextTarget) => {
      target = nextTarget
      for (const listener of listeners) listener()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

function withControlledRootReadiness(
  runtime: EditorRuntime,
  loadRoot: () => Promise<ResourceLoadResult>,
): EditorRuntime {
  const baseSnapshot = runtime.resources.index.getSnapshot()
  const roots = baseSnapshot.list({ parentId: null, lifecycle: 'active' })
  if (roots.state !== 'known') throw new Error('Expected known fixture roots')
  const index = new MutableWorkspaceResourceIndex(
    baseSnapshot.scope,
    indexRevision('controlled-empty'),
  )
  const readyProjection: AuthorizedResourceSnapshot = {
    scope: baseSnapshot.scope,
    revision: indexRevision('controlled-ready'),
    resources: roots.items,
    missingResourceIds: [],
    collections: [
      {
        query: { parentId: null, lifecycle: 'active' },
        resourceIds: roots.items.map((resource) => resource.id),
        complete: roots.complete,
      },
    ],
  }
  let inFlight: Promise<ResourceLoadResult> | null = null
  return {
    ...runtime,
    resources: {
      ...runtime.resources,
      index,
      loader: {
        ...runtime.resources.loader,
        ensureCollection: async (query) => {
          if (
            query.parentId !== null ||
            query.lifecycle !== 'active' ||
            query.kinds !== undefined
          ) {
            return await runtime.resources.loader.ensureCollection(query)
          }
          if (inFlight) return await inFlight
          const request = loadRoot()
            .then((result) => {
              if (result.status === 'completed') {
                index.applyAuthoritativeProjectionSnapshot(
                  readyProjection,
                  indexRevision('controlled-applied'),
                )
              }
              return result
            })
            .finally(() => {
              if (inFlight === request) inFlight = null
            })
          inFlight = request
          return await request
        },
      },
    },
  }
}
