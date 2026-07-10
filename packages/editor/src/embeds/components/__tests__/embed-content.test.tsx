import { render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { RESOURCE_TYPES } from '../../../workspace/items-persistence-contract'
import type { AnyItemWithContent } from '../../../workspace/items'
import { ResourceContentSourceProvider } from '../../../filesystem/resource-content-context'
import type {
  ResourceContentSource,
  ResourceContentState,
} from '../../../filesystem/resource-content-source'
import { EmbedAncestryProvider } from '../../context/render-ancestry'
import { EmbedContent } from '../embed-content'
import type { ResourceEmbedSurfaceRenderer } from '../embed-content'
import type { SidebarItemId } from '../../../../../../shared/common/ids'
import type { ComponentProps } from 'react'
const sidebarItemPreviewSurface = vi.hoisted(() => vi.fn())

vi.mock('../../../previews/resource-preview-surface', () => ({
  ResourcePreviewSurface: (props: { item: AnyItemWithContent }) => sidebarItemPreviewSurface(props),
}))

describe('EmbedContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sidebarItemPreviewSurface.mockImplementation(({ item }: { item: AnyItemWithContent }) => (
      <div>{item.name}</div>
    ))
  })

  it('renders empty state for empty targets', () => {
    render(
      <EmbedContent
        target={{ kind: 'empty' }}
        sourceItemId={'note-a' as SidebarItemId}
        mode="editable"
        onUpload={vi.fn()}
        onLinkExternal={vi.fn()}
      />,
    )

    expect(screen.getByText(/drag and drop/i)).toBeInTheDocument()
  })

  it('renders upload progress instead of empty controls while an embed is pending', () => {
    render(
      <EmbedContent
        target={{ kind: 'empty' }}
        sourceItemId={'note-a' as SidebarItemId}
        mode="editable"
        loadingLabel="Uploading portrait.png"
        onUpload={vi.fn()}
        onLinkExternal={vi.fn()}
      />,
    )

    expect(screen.getByRole('status', { name: 'Uploading portrait.png' })).toBeInTheDocument()
    expect(screen.queryByTestId('embed-empty-state')).not.toBeInTheDocument()
  })

  it('does not expose creation actions for readonly empty embeds', () => {
    render(
      <EmbedContent
        target={{ kind: 'empty' }}
        sourceItemId={'note-a' as SidebarItemId}
        mode="readonly"
        onUpload={vi.fn()}
        onLinkExternal={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: /upload/i })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /link to an external file/i }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/drag and drop/i)).not.toBeInTheDocument()
  })

  it('renders external URL targets', () => {
    render(
      <EmbedContent
        target={{ kind: 'externalUrl', url: 'https://x.test/a.png', name: 'a.png' }}
        sourceItemId={null}
        mode="readonly"
      />,
    )

    expect(screen.getByRole('img', { name: 'a.png' })).toHaveAttribute(
      'src',
      'https://x.test/a.png',
    )
  })

  it('renders recursive state when the target is already in ancestry', () => {
    render(
      <EmbedAncestryProvider itemId={'note-a' as SidebarItemId}>
        <EmbedContent
          target={{ kind: 'resource', resourceId: 'note-a' as SidebarItemId }}
          sourceItemId={'note-b' as SidebarItemId}
          mode="readonly"
        />
      </EmbedAncestryProvider>,
    )

    expect(screen.getByText(/recursive embed/i)).toBeInTheDocument()
  })

  it('does not allow a note to embed itself', () => {
    render(
      <EmbedContent
        target={{ kind: 'resource', resourceId: 'note-a' as SidebarItemId }}
        sourceItemId={'note-a' as SidebarItemId}
        mode="readonly"
      />,
    )

    expect(screen.getByText(/recursive embed/i)).toBeInTheDocument()
  })

  it('renders missing content-provider wiring as unavailable infrastructure', () => {
    render(
      <EmbedContent
        target={{ kind: 'resource', resourceId: 'note-a' as SidebarItemId }}
        sourceItemId={null}
        mode="readonly"
      />,
    )

    expect(screen.getByText('Embedded content is unavailable in this view')).toBeInTheDocument()
    expect(screen.queryByText('Embedded item unavailable')).not.toBeInTheDocument()
  })

  it('renders ready resource content through the package-owned resource preview surface', () => {
    const item = {
      id: 'folder-a',
      type: RESOURCE_TYPES.folders,
      name: 'Folder A',
    }
    const folderChild = {
      id: 'note-child',
      type: RESOURCE_TYPES.notes,
      name: 'Child Note',
      content: { type: 'doc', content: [] },
    } as unknown as AnyItemWithContent

    render(
      <ResolvedEmbedContent
        target={{ kind: 'resource', resourceId: 'folder-a' as SidebarItemId }}
        sourceItemId={null}
        mode="readonly"
        resourceContentState={readyContentState(item as AnyItemWithContent, [folderChild])}
      />,
    )

    expect(screen.getByText('Folder A')).toBeInTheDocument()
    expect(sidebarItemPreviewSurface).toHaveBeenCalledWith(
      expect.objectContaining({
        item: expect.objectContaining({ id: 'folder-a' }),
        folderChildren: [folderChild],
      }),
    )
  })

  it('resolves resource targets through ResourceContentSourceProvider', () => {
    const item = {
      id: 'folder-a',
      type: RESOURCE_TYPES.folders,
      name: 'Folder A',
    }
    const ensureContentState = vi.fn()
    const source: ResourceContentSource = {
      status: 'available',
      ensureContentState,
      getContentState: (itemId, fallbackLabel) => {
        expect(itemId).toBe('folder-a')
        expect(fallbackLabel).toBe('Embedded item')
        return readyContentState(item as AnyItemWithContent)
      },
      resolveItem: () => item as AnyItemWithContent,
    }

    render(
      <ResourceContentSourceProvider source={source}>
        <EmbedContent
          target={{ kind: 'resource', resourceId: 'folder-a' as SidebarItemId }}
          sourceItemId={null}
          mode="readonly"
        />
      </ResourceContentSourceProvider>,
    )

    expect(screen.getByText('Folder A')).toBeInTheDocument()
    expect(ensureContentState).toHaveBeenCalledWith('folder-a')
  })

  it('lets runtimes customize only the resolved resource content surface through context', () => {
    const renderEmbedSurface = vi.fn<ResourceEmbedSurfaceRenderer>(({ item }) => (
      <div>custom surface for {item.name}</div>
    ))
    const item = {
      id: 'folder-a',
      type: RESOURCE_TYPES.folders,
      name: 'Folder A',
    }

    render(
      <ResolvedEmbedContent
        target={{ kind: 'resource', resourceId: 'folder-a' as SidebarItemId }}
        sourceItemId={null}
        mode="readonly"
        resourceContentState={readyContentState(item as AnyItemWithContent)}
        renderResourceSurface={renderEmbedSurface}
      />,
    )

    expect(screen.getByText('custom surface for Folder A')).toBeInTheDocument()
    expect(renderEmbedSurface).toHaveBeenCalledWith(
      expect.objectContaining({
        item: expect.objectContaining({ id: 'folder-a' }),
        allowInnerScroll: true,
      }),
    )
  })

  it('renders loading resource content embeds as stable loading placeholders', () => {
    render(
      <ResolvedEmbedContent
        target={{ kind: 'resource', resourceId: 'file-a' as SidebarItemId }}
        sourceItemId={null}
        mode="readonly"
        resourceContentState={loadingContentState('Map PDF')}
      />,
    )

    expect(screen.getByTestId('embed-loading-state')).toHaveAttribute(
      'aria-label',
      'Loading Map PDF',
    )
    expect(screen.queryByText('Embedded item unavailable')).not.toBeInTheDocument()
  })

  it('announces loading resource content embeds as status content', () => {
    render(
      <ResolvedEmbedContent
        target={{ kind: 'resource', resourceId: 'file-a' as SidebarItemId }}
        sourceItemId={null}
        mode="readonly"
        resourceContentState={loadingContentState('Map PDF')}
      />,
    )

    expect(screen.getByRole('status', { name: 'Loading Map PDF' })).toBeInTheDocument()
  })

  it('renders idle resource content embeds as stable loading placeholders', () => {
    render(
      <ResolvedEmbedContent
        target={{ kind: 'resource', resourceId: 'file-a' as SidebarItemId }}
        sourceItemId={null}
        mode="readonly"
        resourceContentState={idleContentState('Map PDF')}
      />,
    )

    expect(screen.getByRole('status', { name: 'Loading Map PDF' })).toBeInTheDocument()
  })

  it('does not remount sidebar item content when the package-owned surface rerenders', () => {
    sidebarItemPreviewSurface.mockImplementation(({ item }: { item: AnyItemWithContent }) => (
      <MountProbe label={item.name} onUnmount={mountProbeUnmountSpy} />
    ))
    const item = {
      id: 'canvas-a',
      type: RESOURCE_TYPES.canvases,
      name: 'Canvas A',
    }
    const unmountSpy = vi.fn()
    mountProbeUnmountSpy = unmountSpy

    const { rerender } = render(
      <ResolvedEmbedContent
        target={{ kind: 'resource', resourceId: 'canvas-a' as SidebarItemId }}
        sourceItemId={null}
        mode="readonly"
        resourceContentState={readyContentState(item as AnyItemWithContent)}
      />,
    )

    rerender(
      <ResolvedEmbedContent
        target={{ kind: 'resource', resourceId: 'canvas-a' as SidebarItemId }}
        sourceItemId={null}
        mode="readonly"
        resourceContentState={readyContentState(item as AnyItemWithContent)}
      />,
    )

    expect(screen.getByText('Canvas A')).toBeInTheDocument()
    expect(unmountSpy).not.toHaveBeenCalled()
  })

  it('renders trashed resource content embeds as unavailable instead of rich content', () => {
    render(
      <ResolvedEmbedContent
        target={{ kind: 'resource', resourceId: 'note-a' as SidebarItemId }}
        sourceItemId={null}
        mode="readonly"
        resourceContentState={unavailableContentState('trashed', 'Trashed Note')}
      />,
    )

    expect(screen.getByText('Trashed Note')).toBeInTheDocument()
    expect(screen.getByText('Embedded item is in the trash')).toBeInTheDocument()
  })

  it('renders not-shared resource content embeds as unavailable permission content', () => {
    render(
      <ResolvedEmbedContent
        target={{ kind: 'resource', resourceId: 'note-a' as SidebarItemId }}
        sourceItemId={null}
        mode="readonly"
        resourceContentState={unavailableContentState('not_shared', 'Private Note')}
      />,
    )

    expect(screen.getByText('Private Note')).toBeInTheDocument()
    expect(screen.getByText("This embedded item isn't shared with you")).toBeInTheDocument()
  })

  it('passes internal file sidebar targets through the package-owned sidebar item surface', () => {
    sidebarItemPreviewSurface.mockImplementationOnce(() => <div>surface fallback</div>)
    const item = {
      id: 'file-a',
      type: RESOURCE_TYPES.files,
      name: 'Theme Song',
      downloadUrl: 'https://example.convex.cloud/api/storage/theme-song',
      contentType: 'audio/mpeg',
      previewUrl: null,
    }

    render(
      <ResolvedEmbedContent
        target={{ kind: 'resource', resourceId: 'file-a' as SidebarItemId }}
        sourceItemId={null}
        mode="readonly"
        resourceContentState={readyContentState(item as AnyItemWithContent)}
      />,
    )

    expect(screen.getByText('surface fallback')).toBeInTheDocument()
    expect(document.querySelector('audio')).not.toBeInTheDocument()
  })

  it('wraps rendered sidebar items with target ancestry', () => {
    sidebarItemPreviewSurface.mockImplementationOnce(RecursiveSameTargetSurface)
    const item = {
      id: 'folder-a',
      type: RESOURCE_TYPES.folders,
      name: 'Folder A',
    }

    render(
      <ResolvedEmbedContent
        target={{ kind: 'resource', resourceId: 'folder-a' as SidebarItemId }}
        sourceItemId={null}
        mode="readonly"
        resourceContentState={readyContentState(item as AnyItemWithContent)}
      />,
    )

    expect(screen.getByText(/recursive embed/i)).toBeInTheDocument()
    expect(screen.queryByText('recursive child')).not.toBeInTheDocument()
  })

  it('seeds source ancestry so multi-hop cycles are blocked by the shared orchestrator', () => {
    sidebarItemPreviewSurface.mockImplementationOnce(RecursiveSourceSurface)
    const item = {
      id: 'note-b',
      type: RESOURCE_TYPES.notes,
      name: 'Note B',
    }

    render(
      <ResolvedEmbedContent
        target={{ kind: 'resource', resourceId: 'note-b' as SidebarItemId }}
        sourceItemId={'note-a' as SidebarItemId}
        mode="readonly"
        resourceContentState={readyContentState(item as AnyItemWithContent)}
      />,
    )

    expect(screen.getByText(/recursive embed/i)).toBeInTheDocument()
    expect(screen.queryByText('recursive child')).not.toBeInTheDocument()
  })
})

let mountProbeUnmountSpy = () => {}

function RecursiveSameTargetSurface() {
  return (
    <EmbedContent
      target={{ kind: 'resource', resourceId: 'folder-a' as SidebarItemId }}
      sourceItemId={null}
      mode="readonly"
    />
  )
}

function RecursiveSourceSurface() {
  return (
    <EmbedContent
      target={{ kind: 'resource', resourceId: 'note-a' as SidebarItemId }}
      sourceItemId={'note-b' as SidebarItemId}
      mode="readonly"
    />
  )
}

function MountProbe({ label, onUnmount }: { label: string; onUnmount: () => void }) {
  useEffect(() => onUnmount, [onUnmount])
  return <div>{label}</div>
}

function ResolvedEmbedContent({
  resourceContentState,
  ...props
}: ComponentProps<typeof EmbedContent> & {
  resourceContentState: ResourceContentState
}) {
  return <EmbedContent resolvedResourceContentState={resourceContentState} {...props} />
}

function readyContentState(
  item: AnyItemWithContent,
  folderChildren: ResourceContentState['folderChildren'] = [],
): ResourceContentState {
  return {
    status: 'ready',
    label: item.name,
    item,
    folderChildren,
    isLoading: false,
    error: null,
  }
}

function loadingContentState(label: string): ResourceContentState {
  return {
    status: 'loading',
    label,
    item: undefined,
    folderChildren: [],
    isLoading: true,
    error: null,
  }
}

function idleContentState(label: string): ResourceContentState {
  return {
    status: 'idle',
    label,
    item: undefined,
    folderChildren: [],
    isLoading: false,
    error: null,
  }
}

function unavailableContentState(
  status: 'not_shared' | 'trashed',
  label: string,
): ResourceContentState {
  return {
    status: 'unavailable',
    label,
    item: undefined,
    folderChildren: [],
    isLoading: false,
    error: null,
    availabilityState: {
      status,
      label,
      message:
        status === 'not_shared'
          ? 'You do not have permission to view this item.'
          : 'This item is in the trash.',
    },
  }
}
