import type { ResourceId } from '../../resources/domain-id'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { CustomBlockNoteEditor } from '../editor-schema'
import { RESOURCE_STATUS, RESOURCE_TYPES } from '../../workspace/items-persistence-contract'
import { validateCreateItemLocally } from '../../workspace/items/local-create-validation'
import type { AnyItem } from '../../workspace/items'
import { NoteLinkClickHandler as LinkClickHandler } from '../document-runtime'
import { createTestWorkspaceRuntime } from '../../test/workspace-runtime-factory'
import { createRuntimeNoteContentSource } from '../runtime-content-source'
import type { LinkStatus, LinkType } from '../links/decoration'

import type { FileSystemOperations } from '../../filesystem/operations'
import type { WorkspaceNavigation, WorkspaceRuntime } from '../../workspace/runtime'
import { getWorkspaceResourceId } from '../../workspace/runtime'

const {
  createNoteMock,
  getLinkAtMock,
  navigateMock,
  toastErrorMock,
  useEditorDomElementMock,
  openMock,
} = vi.hoisted(() => ({
  createNoteMock: vi.fn(),
  getLinkAtMock: vi.fn(),
  navigateMock: vi.fn(),
  toastErrorMock: vi.fn(),
  useEditorDomElementMock: vi.fn(),
  openMock: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    error: (...args: Array<unknown>) => toastErrorMock(...args),
  },
}))

vi.mock('../../rich-text/blocknote/use-editor-dom-element', () => ({
  useEditorDomElement: () => useEditorDomElementMock(),
}))

vi.mock('../links/hit-testing', () => ({
  getLinkAt: (...args: Array<unknown>) => getLinkAtMock(...args),
}))

let sidebarItems: Array<AnyItem>

function createLink({
  exists,
  type,
  pathKind = 'global',
  href = null,
  itemPath = [],
  itemId = null,
  itemName = null,
  itemSlug = null,
  heading = null,
  status,
}: {
  exists: boolean
  type: LinkType
  pathKind?: 'global' | 'relative'
  href?: string | null
  itemPath?: Array<string>
  itemId?: ResourceId | null
  itemName?: string | null
  itemSlug?: string | null
  heading?: string | null
  status?: LinkStatus
}) {
  const element = document.createElement('span')
  Object.defineProperty(element, 'getBoundingClientRect', {
    value: () => ({ left: 10, bottom: 20 }),
  })

  return {
    element,
    exists,
    pathKind,
    itemPath,
    itemId,
    itemName,
    itemSlug,
    href,
    heading,
    type,
    status: status ?? (type === 'md-external' ? 'external' : exists ? 'exists' : 'ghost'),
  }
}

describe('LinkClickHandler', () => {
  let editorEl: HTMLDivElement

  beforeEach(() => {
    editorEl = document.createElement('div')
    document.body.appendChild(editorEl)
    useEditorDomElementMock.mockReturnValue(editorEl)
    sidebarItems = [
      sidebarItem({
        id: 'folder-1',
        name: 'Lore',
        parentId: null,
        type: RESOURCE_TYPES.folders,
      }),
      sidebarItem({
        id: 'folder-2',
        name: 'Capital',
        parentId: 'folder-1',
        type: RESOURCE_TYPES.folders,
      }),
    ]
    createNoteMock.mockReset()
    createNoteMock.mockResolvedValue({ noteId: 'note-1', slug: 'new-note' })
    getLinkAtMock.mockReset()
    navigateMock.mockReset()
    toastErrorMock.mockReset()
    openMock.mockReset()
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it('requires ctrl/cmd for existing wiki links in editor mode', () => {
    getLinkAtMock.mockReturnValue(
      createLink({
        exists: true,
        type: 'wiki',
        href: '/dest?item=lore',
        itemId: 'lore-id' as ResourceId,
        itemSlug: 'lore',
      }),
    )

    renderLinkClickHandler()

    fireEvent.mouseDown(editorEl, { clientX: 10, clientY: 20 })
    expect(navigateMock).not.toHaveBeenCalled()

    fireEvent.mouseDown(editorEl, { clientX: 10, clientY: 20, ctrlKey: true })
    expect(navigateMock).toHaveBeenCalledWith('lore-id', { heading: undefined })
  })

  it('leaves non-primary mouse buttons to native browser behavior', () => {
    renderLinkClickHandler()

    fireEvent.mouseDown(editorEl, { button: 2, clientX: 10, clientY: 20 })

    expect(getLinkAtMock).not.toHaveBeenCalled()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('shows a click-to-open tooltip for existing wiki links on ctrl hover in editor mode', () => {
    getLinkAtMock.mockReturnValue(
      createLink({
        exists: true,
        type: 'wiki',
        href: '/dest?item=lore',
        itemId: 'lore-id' as ResourceId,
        itemSlug: 'lore',
      }),
    )

    renderLinkClickHandler()

    fireEvent.mouseMove(editorEl, { clientX: 10, clientY: 20 })
    fireEvent.keyDown(document, { key: 'Control' })

    expect(screen.getByText('Click to open')).toBeInTheDocument()
  })

  it('navigates on plain click and opens a new tab on ctrl/cmd click in viewer mode', () => {
    getLinkAtMock.mockReturnValue(
      createLink({
        exists: true,
        type: 'wiki',
        href: '/dest?item=lore',
        itemId: 'lore-id' as ResourceId,
        itemSlug: 'lore',
      }),
    )

    renderLinkClickHandler({ editorMode: 'viewer' })

    fireEvent.mouseDown(editorEl, { clientX: 10, clientY: 20 })
    expect(navigateMock).toHaveBeenCalledWith('lore-id', { heading: undefined })

    fireEvent.mouseDown(editorEl, { clientX: 10, clientY: 20, ctrlKey: true })
    expect(openMock).toHaveBeenCalledWith('lore-id', {
      heading: undefined,
      target: 'separate',
    })
  })

  it('passes the missing ancestor path when creating a ghost note', async () => {
    getLinkAtMock.mockReturnValue(
      createLink({
        exists: false,
        type: 'wiki',
        itemPath: ['Lore', 'Capital', 'Districts', 'Ghost Note'],
        itemName: 'Ghost Note',
      }),
    )

    renderLinkClickHandler()

    fireEvent.mouseDown(editorEl, { clientX: 10, clientY: 20, ctrlKey: true })

    await waitFor(() => {
      expect(createNoteMock).toHaveBeenCalledTimes(1)
    })
    expect(createNoteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Ghost Note',
        parentTarget: {
          kind: 'path',
          baseParentId: null,
          pathSegments: ['Lore', 'Capital', 'Districts'],
        },
      }),
    )
  })

  it('opens autocomplete for ghost wiki links on plain editor click', async () => {
    const forceOpenLinkPopover = vi.fn()
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    getLinkAtMock.mockReturnValue(
      createLink({
        exists: false,
        type: 'wiki',
        itemPath: ['Lore', 'Capital', 'Ghost Note'],
        itemName: 'Ghost Note',
      }),
    )

    renderLinkClickHandler({ forceOpenLinkPopover })

    fireEvent.mouseDown(editorEl, { clientX: 10, clientY: 20 })

    await waitFor(() => {
      expect(forceOpenLinkPopover).toHaveBeenCalledOnce()
    })
    expect(createNoteMock).not.toHaveBeenCalled()
  })

  it('shows the ghost tooltip and ignores duplicate create clicks while a creation is in flight', async () => {
    let resolveCreate: ((value: { noteId: string; slug: string }) => void) | undefined
    createNoteMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve
        }),
    )
    getLinkAtMock.mockReturnValue(
      createLink({
        exists: false,
        type: 'wiki',
        itemPath: ['Lore', 'Capital', 'Districts', 'Ghost Note'],
        itemName: 'Ghost Note',
      }),
    )

    renderLinkClickHandler()

    fireEvent.mouseMove(editorEl, { clientX: 10, clientY: 20 })
    fireEvent.keyDown(document, { key: 'Control' })

    expect(screen.getByText('Click to create note: "Ghost Note"')).toBeInTheDocument()

    fireEvent.mouseDown(editorEl, { clientX: 10, clientY: 20, ctrlKey: true })
    fireEvent.mouseDown(editorEl, { clientX: 10, clientY: 20, ctrlKey: true })
    await waitFor(() => {
      expect(createNoteMock).toHaveBeenCalledTimes(1)
    })
    expect(createNoteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Ghost Note',
        parentTarget: {
          kind: 'path',
          baseParentId: null,
          pathSegments: ['Lore', 'Capital', 'Districts'],
        },
      }),
    )

    resolveCreate?.({ noteId: 'note-1', slug: 'ghost-note' })
    await expect(createNoteMock.mock.results[0]?.value).resolves.toEqual({
      noteId: 'note-1',
      slug: 'ghost-note',
    })
  })

  it('allows concurrent ghost note creation for different link targets', async () => {
    const resolvers = new Map<string, (value: { noteId: string; slug: string }) => void>()
    createNoteMock.mockImplementation(
      ({ parentTarget }: { parentTarget?: { pathSegments?: Array<string> } }) =>
        new Promise((resolve) => {
          resolvers.set(parentTarget?.pathSegments?.join('/') ?? 'root', resolve)
        }),
    )
    getLinkAtMock
      .mockReturnValueOnce(
        createLink({
          exists: false,
          type: 'wiki',
          itemPath: ['Lore', 'Capital', 'Districts', 'Ghost Note'],
          itemName: 'Ghost Note',
        }),
      )
      .mockReturnValueOnce(
        createLink({
          exists: false,
          type: 'wiki',
          itemPath: ['Worldbuilding', 'Regions', 'North', 'Ghost Note'],
          itemName: 'Ghost Note',
        }),
      )

    renderLinkClickHandler()

    fireEvent.mouseDown(editorEl, { clientX: 10, clientY: 20, ctrlKey: true })
    fireEvent.mouseDown(editorEl, { clientX: 30, clientY: 40, ctrlKey: true })

    await waitFor(() => {
      expect(createNoteMock).toHaveBeenCalledTimes(2)
    })
    expect(createNoteMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        name: 'Ghost Note',
        parentTarget: {
          kind: 'path',
          baseParentId: null,
          pathSegments: ['Lore', 'Capital', 'Districts'],
        },
      }),
    )
    expect(createNoteMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        name: 'Ghost Note',
        parentTarget: {
          kind: 'path',
          baseParentId: null,
          pathSegments: ['Worldbuilding', 'Regions', 'North'],
        },
      }),
    )

    resolvers.get('Lore/Capital/Districts')?.({ noteId: 'note-1', slug: 'districts-ghost-note' })
    resolvers.get('Worldbuilding/Regions/North')?.({
      noteId: 'note-2',
      slug: 'north-ghost-note',
    })

    await expect(createNoteMock.mock.results[0]?.value).resolves.toEqual({
      noteId: 'note-1',
      slug: 'districts-ghost-note',
    })
    await expect(createNoteMock.mock.results[1]?.value).resolves.toEqual({
      noteId: 'note-2',
      slug: 'north-ghost-note',
    })
  })

  it('reports create-note failures with a stable toast message', async () => {
    const error = new Error('creation failed')
    createNoteMock.mockRejectedValue(error)
    getLinkAtMock.mockReturnValue(
      createLink({
        exists: false,
        type: 'wiki',
        itemPath: ['Lore', 'Capital', 'Districts', 'Ghost Note'],
        itemName: 'Ghost Note',
      }),
    )

    renderLinkClickHandler()

    fireEvent.mouseDown(editorEl, { clientX: 10, clientY: 20, ctrlKey: true })

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Could not create note. Please try again.')
    })
    expect(createNoteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Ghost Note',
        parentTarget: {
          kind: 'path',
          baseParentId: null,
          pathSegments: ['Lore', 'Capital', 'Districts'],
        },
      }),
    )
  })

  it('passes the full missing folder chain when creating the note', async () => {
    getLinkAtMock.mockReturnValue(
      createLink({
        exists: false,
        type: 'wiki',
        itemPath: ['Worldbuilding', 'Regions', 'North', 'Ghost Note'],
        itemName: 'Ghost Note',
      }),
    )

    renderLinkClickHandler()

    fireEvent.mouseDown(editorEl, { clientX: 10, clientY: 20, ctrlKey: true })

    await waitFor(() => {
      expect(createNoteMock).toHaveBeenCalledTimes(1)
    })
    expect(createNoteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Ghost Note',
        parentTarget: {
          kind: 'path',
          baseParentId: null,
          pathSegments: ['Worldbuilding', 'Regions', 'North'],
        },
      }),
    )
  })

  it('routes parent-path conflicts through handleError', async () => {
    const error = new Error('The selected parent cannot contain this note')
    createNoteMock.mockRejectedValue(error)
    getLinkAtMock.mockReturnValue(
      createLink({
        exists: false,
        type: 'wiki',
        itemPath: ['Test', 'Child', 'Ghost Note'],
        itemName: 'Ghost Note',
      }),
    )

    renderLinkClickHandler()

    fireEvent.mouseDown(editorEl, { clientX: 10, clientY: 20, ctrlKey: true })

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Could not create note. Please try again.')
    })
    expect(createNoteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Ghost Note',
        parentTarget: {
          kind: 'path',
          baseParentId: null,
          pathSegments: ['Test', 'Child'],
        },
      }),
    )
  })

  it('creates relative ghost notes from the source note parent folder', async () => {
    sidebarItems = [
      sidebarItem({
        id: 'folder-1',
        name: 'Lore',
        parentId: null,
        type: RESOURCE_TYPES.folders,
      }),
      sidebarItem({
        id: 'folder-2',
        name: 'Capital',
        parentId: 'folder-1',
        type: RESOURCE_TYPES.folders,
      }),
      sidebarItem({
        id: 'note-source',
        name: 'Source Note',
        parentId: 'folder-2',
        type: RESOURCE_TYPES.notes,
      }),
    ]
    getLinkAtMock.mockReturnValue(
      createLink({
        exists: false,
        type: 'wiki',
        pathKind: 'relative',
        itemPath: ['..', 'Districts', 'Ghost Note'],
        itemName: 'Ghost Note',
      }),
    )

    renderLinkClickHandler({ sourceNoteId: 'note-source' as ResourceId })

    fireEvent.mouseDown(editorEl, { clientX: 10, clientY: 20, ctrlKey: true })

    await waitFor(() => {
      expect(createNoteMock).toHaveBeenCalledTimes(1)
    })
    expect(createNoteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Ghost Note',
        parentTarget: {
          kind: 'path',
          baseParentId: 'folder-2',
          pathSegments: ['..', 'Districts'],
        },
      }),
    )
  })

  it('shows validation feedback for traversal-only relative paths', () => {
    getLinkAtMock.mockReturnValue(
      createLink({
        exists: false,
        type: 'wiki',
        pathKind: 'relative',
        itemPath: ['..', '..', '..'],
        itemName: '..',
      }),
    )

    renderLinkClickHandler()

    fireEvent.mouseMove(editorEl, { clientX: 10, clientY: 20 })
    fireEvent.keyDown(document, { key: 'Control' })

    expect(screen.getByText('Path cannot traverse above the workspace root')).toBeInTheDocument()
  })

  it('allows creating a note whose title duplicates a sibling', () => {
    getLinkAtMock.mockReturnValue(
      createLink({
        exists: false,
        type: 'wiki',
        itemPath: ['Lore', 'Capital'],
        itemName: 'Capital',
      }),
    )

    renderLinkClickHandler()

    fireEvent.mouseMove(editorEl, { clientX: 10, clientY: 20 })
    fireEvent.keyDown(document, { key: 'Control' })

    expect(screen.getByText('Click to create note: "Capital"')).toBeInTheDocument()
  })

  it('uses create-note feedback for valid ghost links', () => {
    sidebarItems = [
      sidebarItem({
        id: 'folder-1',
        name: 'Lore',
        parentId: null,
        type: RESOURCE_TYPES.folders,
      }),
    ]
    getLinkAtMock.mockReturnValue(
      createLink({
        exists: false,
        type: 'wiki',
        itemPath: ['Lore', 'Hidden Note'],
        itemName: 'Hidden Note',
      }),
    )

    renderLinkClickHandler()

    fireEvent.mouseMove(editorEl, { clientX: 10, clientY: 20 })
    fireEvent.keyDown(document, { key: 'Control' })

    expect(screen.getByText('Click to create note: "Hidden Note"')).toBeInTheDocument()
  })

  it('requires ctrl/cmd for md external links in editor mode and opens directly in viewer mode', () => {
    getLinkAtMock.mockReturnValue(
      createLink({ exists: true, type: 'md-external', href: 'https://example.com/docs' }),
    )

    const { unmount } = renderLinkClickHandler()

    fireEvent.mouseDown(editorEl, { clientX: 10, clientY: 20 })

    fireEvent.mouseDown(editorEl, { clientX: 10, clientY: 20, metaKey: true })
    expect(openMock).toHaveBeenCalledWith(
      'https://example.com/docs',
      '_blank',
      'noopener,noreferrer',
    )

    unmount()
    openMock.mockReset()

    renderLinkClickHandler({ editorMode: 'viewer' })

    fireEvent.mouseDown(editorEl, { clientX: 10, clientY: 20 })
    expect(openMock).toHaveBeenCalledWith(
      'https://example.com/docs',
      '_blank',
      'noopener,noreferrer',
    )
  })

  it('blocks rejected external links and reports the security outcome on hover', () => {
    getLinkAtMock.mockReturnValue(
      createLink({ exists: false, type: 'md-external', status: 'rejected' }),
    )

    renderLinkClickHandler()

    fireEvent.mouseDown(editorEl, { clientX: 10, clientY: 20, ctrlKey: true })
    fireEvent.mouseMove(editorEl, { clientX: 10, clientY: 20 })
    fireEvent.keyDown(document, { key: 'Control' })

    expect(openMock).not.toHaveBeenCalled()
    expect(screen.getByText('Blocked unsafe link')).toBeInTheDocument()
  })

  it('opens existing internal links by item id even when no browser href is available', () => {
    getLinkAtMock.mockReturnValue(
      createLink({
        exists: true,
        type: 'wiki',
        href: null,
        itemId: 'capital-id' as ResourceId,
        itemSlug: 'capital',
        heading: 'Overview',
      }),
    )

    renderLinkClickHandler()

    fireEvent.mouseDown(editorEl, { clientX: 10, clientY: 20, ctrlKey: true })

    expect(navigateMock).toHaveBeenCalledWith('capital-id', { heading: 'Overview' })
  })

  it('opens existing viewer links separately by item id even when no browser href is available', () => {
    getLinkAtMock.mockReturnValue(
      createLink({
        exists: true,
        type: 'wiki',
        href: null,
        itemId: 'capital-id' as ResourceId,
        itemSlug: 'capital',
        heading: 'Overview',
      }),
    )

    renderLinkClickHandler({ editorMode: 'viewer' })

    fireEvent.mouseDown(editorEl, { clientX: 10, clientY: 20, ctrlKey: true })

    expect(openMock).toHaveBeenCalledWith('capital-id', {
      heading: 'Overview',
      target: 'separate',
    })
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('shows a click-to-open tooltip for existing external links on ctrl hover in editor mode', () => {
    getLinkAtMock.mockReturnValue(
      createLink({ exists: true, type: 'md-external', href: 'https://example.com/docs' }),
    )

    renderLinkClickHandler()

    fireEvent.mouseMove(editorEl, { clientX: 10, clientY: 20 })
    fireEvent.keyDown(document, { key: 'Control' })

    expect(screen.getByText('Click to open')).toBeInTheDocument()
  })
})

function renderLinkClickHandler({
  canEdit = true,
  editorMode = 'editor',
  forceOpenLinkPopover,
  sourceNoteId,
}: {
  canEdit?: boolean
  editorMode?: 'editor' | 'viewer'
  forceOpenLinkPopover?: () => void
  sourceNoteId?: ResourceId
} = {}) {
  const runtime = createWorkspaceRuntime({ canEdit })
  const source = createNoteContentSource(runtime)
  return render(
    <LinkClickHandler
      editor={{} as CustomBlockNoteEditor}
      editorMode={editorMode}
      forceOpenLinkPopover={forceOpenLinkPopover}
      linkCreation={source.linkCreation}
      linkNavigationSource={source.linkNavigation}
      sourceNoteId={sourceNoteId}
    />,
  )
}

function createNoteContentSource(runtime: WorkspaceRuntime) {
  return createRuntimeNoteContentSource({
    ...runtime,
    sessions: {
      noteDocument: runtime.sessions.note.document,
      noteHeadings: runtime.sessions.noteHeadings.headings,
      notePlayback: runtime.sessions.notePlayback.playback,
      noteValues: runtime.sessions.noteValues.values,
    },
  })
}

function createWorkspaceRuntime({ canEdit }: { canEdit: boolean }): WorkspaceRuntime {
  const validationSource = buildCreateValidationSource(sidebarItems)
  const runtime = createTestWorkspaceRuntime({ activeItems: sidebarItems, canEdit })
  const openItem: WorkspaceNavigation['openItem'] = (resource, options) =>
    options?.target === 'separate'
      ? openMock(getWorkspaceResourceId(resource), options)
      : navigateMock(getWorkspaceResourceId(resource), options)
  const openExternalUrl: WorkspaceNavigation['openExternalUrl'] = (url) =>
    openMock(url, '_blank', 'noopener,noreferrer')
  const operations: FileSystemOperations = {
    ...runtime.filesystem.operations,
    createItem: (args) => createNoteMock(args),
    validateCreateItem: ({ name, parentTarget }) =>
      validateCreateItemLocally({ name, parentTarget }, validationSource),
  }

  const source = {
    ...runtime,
    filesystem: {
      ...runtime.filesystem,
      operations,
    },
    navigation: {
      ...runtime.navigation,
      openItem,
      openExternalUrl,
    },
  }

  return source
}

function buildCreateValidationSource(items: Array<AnyItem>) {
  const itemsById = new Map(items.map((item) => [item.id, item] as const))
  const parentItemsMap = new Map<ResourceId | null, Array<AnyItem>>()

  for (const item of items) {
    const parentId = item.parentId ?? null
    parentItemsMap.set(parentId, [...(parentItemsMap.get(parentId) ?? []), item])
  }

  return {
    getItemById: (itemId: ResourceId) => itemsById.get(itemId),
    getActiveChildren: (parentId: ResourceId | null) => parentItemsMap.get(parentId) ?? [],
  }
}

function sidebarItem({
  id,
  name,
  parentId,
  type,
}: {
  id: string
  name: string
  parentId: string | null
  type: AnyItem['type']
}): AnyItem {
  return {
    createdAt: 1,
    id: id as ResourceId,
    name,
    parentId: parentId as ResourceId | null,
    slug: id,
    status: RESOURCE_STATUS.active,
    type,
  } as AnyItem
}
