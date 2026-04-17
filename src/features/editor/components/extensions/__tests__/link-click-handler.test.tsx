import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { LinkClickHandler } from '../link-click-handler'
import type { LinkType } from '~/features/editor/utils/link-decoration'

const {
  createFolderMock,
  createMapMock,
  createNoteMock,
  createFileMock,
  createCanvasMock,
  deleteSidebarItemMock,
  getLinkAtMock,
  handleErrorMock,
  loggerErrorMock,
  moveSidebarItemMock,
  navigateMock,
  navigateToItemMock,
  useCampaignMock,
  useEditorDomElementMock,
  useEditorModeMock,
  useActiveSidebarItemsMock,
  openMock,
} = vi.hoisted(() => ({
  createFolderMock: vi.fn(),
  createMapMock: vi.fn(),
  createNoteMock: vi.fn(),
  createFileMock: vi.fn(),
  createCanvasMock: vi.fn(),
  deleteSidebarItemMock: vi.fn(),
  getLinkAtMock: vi.fn(),
  handleErrorMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  moveSidebarItemMock: vi.fn(),
  navigateMock: vi.fn(),
  navigateToItemMock: vi.fn(),
  useCampaignMock: vi.fn(),
  useEditorDomElementMock: vi.fn(),
  useEditorModeMock: vi.fn(),
  useActiveSidebarItemsMock: vi.fn(),
  openMock: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))

vi.mock('convex/_generated/api', () => ({
  api: {
    notes: {
      mutations: {
        createNote: 'createNote',
      },
    },
    folders: {
      mutations: {
        createFolder: 'createFolder',
      },
    },
    gameMaps: {
      mutations: {
        createMap: 'createMap',
      },
    },
    files: {
      mutations: {
        createFile: 'createFile',
      },
    },
    canvases: {
      mutations: {
        createCanvas: 'createCanvas',
      },
    },
    sidebarItems: {
      mutations: {
        moveSidebarItem: 'moveSidebarItem',
        permanentlyDeleteSidebarItem: 'permanentlyDeleteSidebarItem',
      },
    },
  },
}))

const mutationMap = {
  createFolder: createFolderMock,
  createMap: createMapMock,
  createFile: createFileMock,
  createCanvas: createCanvasMock,
  moveSidebarItem: moveSidebarItemMock,
  permanentlyDeleteSidebarItem: deleteSidebarItemMock,
  createNote: createNoteMock,
} satisfies Record<string, ReturnType<typeof vi.fn>>

vi.mock('~/shared/hooks/useAppMutation', () => ({
  useAppMutation: (mutation: string) => ({
    mutateAsync:
      mutationMap[mutation as keyof typeof mutationMap] ??
      (() => {
        throw new Error(`Unexpected mutation: ${mutation}`)
      }),
  }),
}))

vi.mock('~/shared/utils/logger', () => ({
  handleError: (...args: Array<unknown>) => handleErrorMock(...args),
  logger: {
    error: (...args: Array<unknown>) => loggerErrorMock(...args),
  },
}))

vi.mock('~/features/sidebar/hooks/useEditorNavigation', () => ({
  useEditorNavigation: () => ({ navigateToItem: navigateToItemMock }),
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => useCampaignMock(),
}))

vi.mock('~/features/sidebar/hooks/useEditorMode', () => ({
  useEditorMode: () => useEditorModeMock(),
}))

vi.mock('~/features/editor/hooks/useEditorDomElement', () => ({
  useEditorDomElement: () => useEditorDomElementMock(),
}))

vi.mock('~/features/sidebar/hooks/useSidebarItems', () => ({
  useActiveSidebarItems: () => useActiveSidebarItemsMock(),
}))

vi.mock('~/features/editor/utils/link-hit-testing', () => ({
  getLinkAt: (...args: Array<unknown>) => getLinkAtMock(...args),
}))

function createLink({
  exists,
  type,
  pathKind = 'global',
  href = null,
  itemPath = [],
  itemName = null,
  heading = null,
}: {
  exists: boolean
  type: LinkType
  pathKind?: 'global' | 'relative'
  href?: string | null
  itemPath?: Array<string>
  itemName?: string | null
  heading?: string | null
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
    itemName,
    href,
    heading,
    type,
  }
}

describe('LinkClickHandler', () => {
  let editorEl: HTMLDivElement

  beforeEach(() => {
    editorEl = document.createElement('div')
    document.body.appendChild(editorEl)
    useEditorDomElementMock.mockReturnValue(editorEl)
    useCampaignMock.mockReturnValue({ campaign: { data: { _id: 'campaign-1' } } })
    useEditorModeMock.mockReturnValue({ editorMode: 'editor' })
    useActiveSidebarItemsMock.mockReturnValue({
      data: [
        { _id: 'folder-1', name: 'Lore', parentId: null, type: SIDEBAR_ITEM_TYPES.folders },
        {
          _id: 'folder-2',
          name: 'Capital',
          parentId: 'folder-1',
          type: SIDEBAR_ITEM_TYPES.folders,
        },
      ],
      itemsMap: new Map([
        [
          'folder-1',
          { _id: 'folder-1', name: 'Lore', parentId: null, type: SIDEBAR_ITEM_TYPES.folders },
        ],
        [
          'folder-2',
          {
            _id: 'folder-2',
            name: 'Capital',
            parentId: 'folder-1',
            type: SIDEBAR_ITEM_TYPES.folders,
          },
        ],
      ]),
      parentItemsMap: new Map([
        [
          null,
          [{ _id: 'folder-1', name: 'Lore', parentId: null, type: SIDEBAR_ITEM_TYPES.folders }],
        ],
        [
          'folder-1',
          [
            {
              _id: 'folder-2',
              name: 'Capital',
              parentId: 'folder-1',
              type: SIDEBAR_ITEM_TYPES.folders,
            },
          ],
        ],
        ['folder-2', []],
      ]),
    })
    createNoteMock.mockReset()
    createNoteMock.mockResolvedValue({ noteId: 'note-1', slug: 'new-note' })
    createFolderMock.mockReset()
    createFolderMock.mockImplementation(({ name }: { name: string }) => ({
      folderId: `created-${name.toLowerCase().replace(/\s+/g, '-')}`,
      slug: name.toLowerCase().replace(/\s+/g, '-'),
    }))
    createMapMock.mockReset()
    createFileMock.mockReset()
    createCanvasMock.mockReset()
    moveSidebarItemMock.mockReset()
    moveSidebarItemMock.mockResolvedValue('moved-item')
    deleteSidebarItemMock.mockReset()
    deleteSidebarItemMock.mockResolvedValue(null)
    getLinkAtMock.mockReset()
    handleErrorMock.mockReset()
    loggerErrorMock.mockReset()
    navigateMock.mockReset()
    navigateToItemMock.mockReset()
    openMock.mockReset()
    vi.stubGlobal('open', openMock)
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it('requires ctrl/cmd for existing wiki links in editor mode', () => {
    getLinkAtMock.mockReturnValue(
      createLink({ exists: true, type: 'wiki', href: '/dest?item=lore' }),
    )

    render(<LinkClickHandler editor={{} as CustomBlockNoteEditor} />)

    fireEvent.mouseDown(editorEl, { clientX: 10, clientY: 20 })
    expect(navigateMock).not.toHaveBeenCalled()

    fireEvent.mouseDown(editorEl, { clientX: 10, clientY: 20, ctrlKey: true })
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/dest',
      search: { item: 'lore' },
    })
  })

  it('shows a click-to-open tooltip for existing wiki links on ctrl hover in editor mode', () => {
    getLinkAtMock.mockReturnValue(
      createLink({ exists: true, type: 'wiki', href: '/dest?item=lore' }),
    )

    render(<LinkClickHandler editor={{} as CustomBlockNoteEditor} />)

    fireEvent.mouseMove(editorEl, { clientX: 10, clientY: 20 })
    fireEvent.keyDown(document, { key: 'Control' })

    expect(screen.getByText('Click to open')).toBeInTheDocument()
  })

  it('navigates on plain click and opens a new tab on ctrl/cmd click in viewer mode', () => {
    useEditorModeMock.mockReturnValue({ editorMode: 'viewer' })
    getLinkAtMock.mockReturnValue(
      createLink({ exists: true, type: 'wiki', href: '/dest?item=lore' }),
    )

    render(<LinkClickHandler editor={{} as CustomBlockNoteEditor} />)

    fireEvent.mouseDown(editorEl, { clientX: 10, clientY: 20 })
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/dest',
      search: { item: 'lore' },
    })

    fireEvent.mouseDown(editorEl, { clientX: 10, clientY: 20, ctrlKey: true })
    expect(openMock).toHaveBeenCalledWith(
      expect.stringContaining('/dest?item=lore'),
      '_blank',
      'noopener,noreferrer',
    )
  })

  it('does not show a click-to-open tooltip for existing links in viewer mode', () => {
    useEditorModeMock.mockReturnValue({ editorMode: 'viewer' })
    getLinkAtMock.mockReturnValue(
      createLink({ exists: true, type: 'wiki', href: '/dest?item=lore' }),
    )

    render(<LinkClickHandler editor={{} as CustomBlockNoteEditor} />)

    fireEvent.mouseMove(editorEl, { clientX: 10, clientY: 20 })
    fireEvent.keyDown(document, { key: 'Control' })

    expect(screen.queryByText('Click to open')).not.toBeInTheDocument()
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

    render(<LinkClickHandler editor={{} as CustomBlockNoteEditor} />)

    fireEvent.mouseDown(editorEl, { clientX: 10, clientY: 20, ctrlKey: true })

    await waitFor(() => {
      expect(createNoteMock).toHaveBeenCalledTimes(1)
    })
    expect(createFolderMock).not.toHaveBeenCalled()
    expect(createNoteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: 'campaign-1',
        name: 'Ghost Note',
        parentTarget: {
          kind: 'path',
          baseParentId: null,
          pathSegments: ['Lore', 'Capital', 'Districts'],
        },
      }),
    )
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

    render(<LinkClickHandler editor={{} as CustomBlockNoteEditor} />)

    fireEvent.mouseMove(editorEl, { clientX: 10, clientY: 20 })
    fireEvent.keyDown(document, { key: 'Control' })

    expect(screen.getByText('Click to create note: "Ghost Note"')).toBeInTheDocument()

    fireEvent.mouseDown(editorEl, { clientX: 10, clientY: 20, ctrlKey: true })
    fireEvent.mouseDown(editorEl, { clientX: 10, clientY: 20, ctrlKey: true })
    await waitFor(() => {
      expect(createNoteMock).toHaveBeenCalledTimes(1)
    })
    expect(createFolderMock).not.toHaveBeenCalled()
    expect(createNoteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: 'campaign-1',
        name: 'Ghost Note',
        parentTarget: {
          kind: 'path',
          baseParentId: null,
          pathSegments: ['Lore', 'Capital', 'Districts'],
        },
      }),
    )

    resolveCreate?.({ noteId: 'note-1', slug: 'ghost-note' })
    await waitFor(() => {
      expect(navigateToItemMock).toHaveBeenCalledWith('ghost-note')
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

    render(<LinkClickHandler editor={{} as CustomBlockNoteEditor} />)

    fireEvent.mouseDown(editorEl, { clientX: 10, clientY: 20, ctrlKey: true })
    fireEvent.mouseDown(editorEl, { clientX: 30, clientY: 40, ctrlKey: true })

    await waitFor(() => {
      expect(createNoteMock).toHaveBeenCalledTimes(2)
    })
    expect(createNoteMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        campaignId: 'campaign-1',
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
        campaignId: 'campaign-1',
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

    await waitFor(() => {
      expect(navigateToItemMock).toHaveBeenCalledWith('districts-ghost-note')
      expect(navigateToItemMock).toHaveBeenCalledWith('north-ghost-note')
    })
  })

  it('routes create-note failures through handleError', async () => {
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

    render(<LinkClickHandler editor={{} as CustomBlockNoteEditor} />)

    fireEvent.mouseDown(editorEl, { clientX: 10, clientY: 20, ctrlKey: true })

    await waitFor(() => {
      expect(handleErrorMock).toHaveBeenCalledWith(error, 'Failed to create note')
    })
    expect(createNoteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: 'campaign-1',
        name: 'Ghost Note',
        parentTarget: {
          kind: 'path',
          baseParentId: null,
          pathSegments: ['Lore', 'Capital', 'Districts'],
        },
      }),
    )
    expect(createFolderMock).not.toHaveBeenCalled()
    expect(moveSidebarItemMock).not.toHaveBeenCalled()
    expect(deleteSidebarItemMock).not.toHaveBeenCalled()
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

    render(<LinkClickHandler editor={{} as CustomBlockNoteEditor} />)

    fireEvent.mouseDown(editorEl, { clientX: 10, clientY: 20, ctrlKey: true })

    await waitFor(() => {
      expect(createNoteMock).toHaveBeenCalledTimes(1)
    })
    expect(createFolderMock).not.toHaveBeenCalled()
    expect(createNoteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: 'campaign-1',
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
    const error = new Error('"Test" already exists here and is not a folder')
    createNoteMock.mockRejectedValue(error)
    getLinkAtMock.mockReturnValue(
      createLink({
        exists: false,
        type: 'wiki',
        itemPath: ['Test', 'Child', 'Ghost Note'],
        itemName: 'Ghost Note',
      }),
    )

    render(<LinkClickHandler editor={{} as CustomBlockNoteEditor} />)

    fireEvent.mouseDown(editorEl, { clientX: 10, clientY: 20, ctrlKey: true })

    await waitFor(() => {
      expect(handleErrorMock).toHaveBeenCalledWith(error, 'Failed to create note')
    })
    expect(createFolderMock).not.toHaveBeenCalled()
    expect(createNoteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: 'campaign-1',
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
    useActiveSidebarItemsMock.mockReturnValue({
      data: [
        { _id: 'folder-1', name: 'Lore', parentId: null, type: SIDEBAR_ITEM_TYPES.folders },
        {
          _id: 'folder-2',
          name: 'Capital',
          parentId: 'folder-1',
          type: SIDEBAR_ITEM_TYPES.folders,
        },
        {
          _id: 'note-source',
          name: 'Source Note',
          parentId: 'folder-2',
          type: SIDEBAR_ITEM_TYPES.notes,
        },
      ],
      itemsMap: new Map([
        [
          'folder-1',
          { _id: 'folder-1', name: 'Lore', parentId: null, type: SIDEBAR_ITEM_TYPES.folders },
        ],
        [
          'folder-2',
          {
            _id: 'folder-2',
            name: 'Capital',
            parentId: 'folder-1',
            type: SIDEBAR_ITEM_TYPES.folders,
          },
        ],
        [
          'note-source',
          {
            _id: 'note-source',
            name: 'Source Note',
            parentId: 'folder-2',
            type: SIDEBAR_ITEM_TYPES.notes,
          },
        ],
      ]),
      parentItemsMap: new Map(),
    })
    getLinkAtMock.mockReturnValue(
      createLink({
        exists: false,
        type: 'wiki',
        pathKind: 'relative',
        itemPath: ['..', 'Districts', 'Ghost Note'],
        itemName: 'Ghost Note',
      }),
    )

    render(
      <LinkClickHandler
        editor={{} as CustomBlockNoteEditor}
        sourceNoteId={'note-source' as never}
      />,
    )

    fireEvent.mouseDown(editorEl, { clientX: 10, clientY: 20, ctrlKey: true })

    await waitFor(() => {
      expect(createNoteMock).toHaveBeenCalledTimes(1)
    })
    expect(createNoteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: 'campaign-1',
        name: 'Ghost Note',
        parentTarget: {
          kind: 'path',
          baseParentId: 'folder-2',
          pathSegments: ['..', 'Districts'],
        },
      }),
    )
  })

  it('shows validation feedback and does not create for traversal-only relative paths', async () => {
    getLinkAtMock.mockReturnValue(
      createLink({
        exists: false,
        type: 'wiki',
        pathKind: 'relative',
        itemPath: ['..', '..', '..'],
        itemName: '..',
      }),
    )

    render(<LinkClickHandler editor={{} as CustomBlockNoteEditor} />)

    fireEvent.mouseMove(editorEl, { clientX: 10, clientY: 20 })
    fireEvent.keyDown(document, { key: 'Control' })

    expect(screen.getByText('Path cannot traverse above the campaign root')).toBeInTheDocument()

    fireEvent.mouseDown(editorEl, { clientX: 10, clientY: 20, ctrlKey: true })

    await waitFor(() => {
      expect(createNoteMock).not.toHaveBeenCalled()
    })
  })

  it('shows sibling conflict validation feedback on ctrl hover', async () => {
    getLinkAtMock.mockReturnValue(
      createLink({
        exists: false,
        type: 'wiki',
        itemPath: ['Lore', 'Capital'],
        itemName: 'Capital',
      }),
    )

    render(<LinkClickHandler editor={{} as CustomBlockNoteEditor} />)

    fireEvent.mouseMove(editorEl, { clientX: 10, clientY: 20 })
    fireEvent.keyDown(document, { key: 'Control' })

    expect(screen.getByText('An item with this name already exists here')).toBeInTheDocument()
    fireEvent.mouseDown(editorEl, { clientX: 10, clientY: 20, ctrlKey: true })

    await waitFor(() => {
      expect(createNoteMock).not.toHaveBeenCalled()
    })
  })

  it('does not show ghost-link validation feedback on ctrl hover in viewer mode', () => {
    useEditorModeMock.mockReturnValue({ editorMode: 'viewer' })
    getLinkAtMock.mockReturnValue(
      createLink({
        exists: false,
        type: 'wiki',
        itemPath: ['Lore', 'Capital'],
        itemName: 'Capital',
      }),
    )

    render(<LinkClickHandler editor={{} as CustomBlockNoteEditor} />)

    fireEvent.mouseMove(editorEl, { clientX: 10, clientY: 20 })
    fireEvent.keyDown(document, { key: 'Control' })

    expect(screen.queryByText('An item with this name already exists here')).not.toBeInTheDocument()
  })

  it('requires ctrl/cmd for md external links in editor mode and opens directly in viewer mode', () => {
    getLinkAtMock.mockReturnValue(
      createLink({ exists: true, type: 'md-external', href: 'https://example.com/docs' }),
    )

    const { unmount } = render(<LinkClickHandler editor={{} as CustomBlockNoteEditor} />)

    fireEvent.mouseDown(editorEl, { clientX: 10, clientY: 20 })
    expect(openMock).not.toHaveBeenCalled()

    fireEvent.mouseDown(editorEl, { clientX: 10, clientY: 20, metaKey: true })
    expect(openMock).toHaveBeenCalledWith(
      'https://example.com/docs',
      '_blank',
      'noopener,noreferrer',
    )

    unmount()
    openMock.mockReset()
    useEditorModeMock.mockReturnValue({ editorMode: 'viewer' })

    render(<LinkClickHandler editor={{} as CustomBlockNoteEditor} />)

    fireEvent.mouseDown(editorEl, { clientX: 10, clientY: 20 })
    expect(openMock).toHaveBeenCalledWith(
      'https://example.com/docs',
      '_blank',
      'noopener,noreferrer',
    )
  })

  it('shows a click-to-open tooltip for existing external links on ctrl hover in editor mode', () => {
    getLinkAtMock.mockReturnValue(
      createLink({ exists: true, type: 'md-external', href: 'https://example.com/docs' }),
    )

    render(<LinkClickHandler editor={{} as CustomBlockNoteEditor} />)

    fireEvent.mouseMove(editorEl, { clientX: 10, clientY: 20 })
    fireEvent.keyDown(document, { key: 'Control' })

    expect(screen.getByText('Click to open')).toBeInTheDocument()
  })
})
