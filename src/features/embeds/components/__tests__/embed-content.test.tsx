import { render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import { EmbedAncestryProvider } from '../../context/embed-render-ancestry'
import { EmbedContent } from '../embed-content'
import type { EmbedSidebarItemState } from '../../context/embed-sidebar-item-resolution'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItemWithContent } from 'shared/sidebar-items/model-types'

vi.mock('~/features/editor/components/viewer/file/pdf-file-viewer', () => ({
  PdfFileViewer: ({ pdfUrl }: { pdfUrl: string }) => (
    <div data-testid="pdf-viewer" data-url={pdfUrl} />
  ),
}))

vi.mock('~/features/file-upload/utils/file-url-validation', () => ({
  isValidFileUrl: () => true,
}))

describe('EmbedContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders empty state for empty targets', () => {
    render(
      <EmbedContent
        target={{ kind: 'empty' }}
        sourceItemId={'note-a' as Id<'sidebarItems'>}
        mode="editable"
        onUpload={vi.fn()}
        onLinkExternal={vi.fn()}
        SidebarItemRenderer={NullSidebarItemRenderer}
      />,
    )

    expect(screen.getByText(/drag and drop/i)).toBeInTheDocument()
  })

  it('does not expose creation actions for readonly empty embeds', () => {
    render(
      <EmbedContent
        target={{ kind: 'empty' }}
        sourceItemId={'note-a' as Id<'sidebarItems'>}
        mode="readonly"
        onUpload={vi.fn()}
        onLinkExternal={vi.fn()}
        SidebarItemRenderer={NullSidebarItemRenderer}
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
        SidebarItemRenderer={NullSidebarItemRenderer}
      />,
    )

    expect(screen.getByRole('img', { name: 'a.png' })).toHaveAttribute(
      'src',
      'https://x.test/a.png',
    )
  })

  it('renders recursive state when the target is already in ancestry', () => {
    render(
      <EmbedAncestryProvider itemId={'note-a' as Id<'sidebarItems'>}>
        <EmbedContent
          target={{ kind: 'sidebarItem', sidebarItemId: 'note-a' as Id<'sidebarItems'> }}
          sourceItemId={'note-b' as Id<'sidebarItems'>}
          mode="readonly"
          SidebarItemRenderer={NullSidebarItemRenderer}
        />
      </EmbedAncestryProvider>,
    )

    expect(screen.getByText(/recursive embed/i)).toBeInTheDocument()
  })

  it('does not allow a note to embed itself', () => {
    render(
      <EmbedContent
        target={{ kind: 'sidebarItem', sidebarItemId: 'note-a' as Id<'sidebarItems'> }}
        sourceItemId={'note-a' as Id<'sidebarItems'>}
        mode="readonly"
        SidebarItemRenderer={NullSidebarItemRenderer}
      />,
    )

    expect(screen.getByText(/recursive embed/i)).toBeInTheDocument()
  })

  it('renders available sidebar items through the supplied surface renderer', () => {
    const item = {
      _id: 'folder-a',
      type: SIDEBAR_ITEM_TYPES.folders,
      name: 'Folder A',
    }

    render(
      <EmbedContent
        target={{ kind: 'sidebarItem', sidebarItemId: 'folder-a' as Id<'sidebarItems'> }}
        sourceItemId={null}
        mode="readonly"
        SidebarItemRenderer={SidebarItemNameRenderer}
        resolvedSidebarItemState={availableItemState(item as AnySidebarItemWithContent)}
      />,
    )

    expect(screen.getByText('Folder A')).toBeInTheDocument()
  })

  it('renders loading sidebar item embeds as stable loading placeholders', () => {
    render(
      <EmbedContent
        target={{ kind: 'sidebarItem', sidebarItemId: 'file-a' as Id<'sidebarItems'> }}
        sourceItemId={null}
        mode="readonly"
        SidebarItemRenderer={SidebarItemNameRenderer}
        resolvedSidebarItemState={{ status: 'loading', label: 'Map PDF' }}
      />,
    )

    expect(screen.getByTestId('embed-loading-state')).toHaveAttribute(
      'aria-label',
      'Loading Map PDF',
    )
    expect(screen.queryByText('Embedded item unavailable')).not.toBeInTheDocument()
  })

  it('renders unresolved static sidebar item embeds without live sidebar lookup', () => {
    render(
      <EmbedContent
        target={{ kind: 'sidebarItem', sidebarItemId: 'file-a' as Id<'sidebarItems'> }}
        sourceItemId={null}
        mode="readonly"
        SidebarItemRenderer={SidebarItemNameRenderer}
      />,
    )

    expect(screen.getByText('Embedded item unavailable')).toBeInTheDocument()
  })

  it('does not remount sidebar item content when the render callback identity changes', () => {
    const item = {
      _id: 'canvas-a',
      type: SIDEBAR_ITEM_TYPES.canvases,
      name: 'Canvas A',
    }
    const unmountSpy = vi.fn()
    mountProbeUnmountSpy = unmountSpy

    const { rerender } = render(
      <EmbedContent
        target={{ kind: 'sidebarItem', sidebarItemId: 'canvas-a' as Id<'sidebarItems'> }}
        sourceItemId={null}
        mode="readonly"
        SidebarItemRenderer={MountProbeRenderer}
        resolvedSidebarItemState={availableItemState(item as AnySidebarItemWithContent)}
      />,
    )

    rerender(
      <EmbedContent
        target={{ kind: 'sidebarItem', sidebarItemId: 'canvas-a' as Id<'sidebarItems'> }}
        sourceItemId={null}
        mode="readonly"
        SidebarItemRenderer={MountProbeRenderer}
        resolvedSidebarItemState={availableItemState(item as AnySidebarItemWithContent)}
      />,
    )

    expect(screen.getByText('Canvas A')).toBeInTheDocument()
    expect(unmountSpy).not.toHaveBeenCalled()
  })

  it('renders trashed sidebar item embeds as unavailable instead of rich content', () => {
    render(
      <EmbedContent
        target={{ kind: 'sidebarItem', sidebarItemId: 'note-a' as Id<'sidebarItems'> }}
        sourceItemId={null}
        mode="readonly"
        SidebarItemRenderer={SidebarItemNameRenderer}
        resolvedSidebarItemState={{
          status: 'trashed',
          label: 'Trashed Note',
          message: 'This item is in the trash.',
        }}
      />,
    )

    expect(screen.getByText('Trashed Note')).toBeInTheDocument()
    expect(screen.getByText('Embedded item is in the trash')).toBeInTheDocument()
  })

  it('passes internal file sidebar targets through the supplied surface renderer', () => {
    const item = {
      _id: 'file-a',
      type: SIDEBAR_ITEM_TYPES.files,
      name: 'Theme Song',
      downloadUrl: 'https://example.convex.cloud/api/storage/theme-song',
      contentType: 'audio/mpeg',
      previewUrl: null,
    }

    render(
      <EmbedContent
        target={{ kind: 'sidebarItem', sidebarItemId: 'file-a' as Id<'sidebarItems'> }}
        sourceItemId={null}
        mode="readonly"
        SidebarItemRenderer={SurfaceFallbackRenderer}
        resolvedSidebarItemState={availableItemState(item as AnySidebarItemWithContent)}
      />,
    )

    expect(screen.getByText('surface fallback')).toBeInTheDocument()
    expect(document.querySelector('audio')).not.toBeInTheDocument()
  })

  it('wraps rendered sidebar items with target ancestry', () => {
    const item = {
      _id: 'folder-a',
      type: SIDEBAR_ITEM_TYPES.folders,
      name: 'Folder A',
    }

    render(
      <EmbedContent
        target={{ kind: 'sidebarItem', sidebarItemId: 'folder-a' as Id<'sidebarItems'> }}
        sourceItemId={null}
        mode="readonly"
        SidebarItemRenderer={RecursiveSameTargetRenderer}
        resolvedSidebarItemState={availableItemState(item as AnySidebarItemWithContent)}
      />,
    )

    expect(screen.getByText(/recursive embed/i)).toBeInTheDocument()
    expect(screen.queryByText('recursive child')).not.toBeInTheDocument()
  })

  it('seeds source ancestry so multi-hop cycles are blocked by the shared orchestrator', () => {
    const item = {
      _id: 'note-b',
      type: SIDEBAR_ITEM_TYPES.notes,
      name: 'Note B',
    }

    render(
      <EmbedContent
        target={{ kind: 'sidebarItem', sidebarItemId: 'note-b' as Id<'sidebarItems'> }}
        sourceItemId={'note-a' as Id<'sidebarItems'>}
        mode="readonly"
        SidebarItemRenderer={RecursiveSourceRenderer}
        resolvedSidebarItemState={availableItemState(item as AnySidebarItemWithContent)}
      />,
    )

    expect(screen.getByText(/recursive embed/i)).toBeInTheDocument()
    expect(screen.queryByText('recursive child')).not.toBeInTheDocument()
  })
})

let mountProbeUnmountSpy = () => {}

function NullSidebarItemRenderer() {
  return null
}

function SidebarItemNameRenderer({ item }: { item: AnySidebarItemWithContent }) {
  return <div>{item.name}</div>
}

function SurfaceFallbackRenderer() {
  return <div>surface fallback</div>
}

function RecursiveChildRenderer() {
  return <div>recursive child</div>
}

function RecursiveSameTargetRenderer() {
  return (
    <EmbedContent
      target={{ kind: 'sidebarItem', sidebarItemId: 'folder-a' as Id<'sidebarItems'> }}
      sourceItemId={null}
      mode="readonly"
      SidebarItemRenderer={RecursiveChildRenderer}
    />
  )
}

function RecursiveSourceRenderer() {
  return (
    <EmbedContent
      target={{ kind: 'sidebarItem', sidebarItemId: 'note-a' as Id<'sidebarItems'> }}
      sourceItemId={'note-b' as Id<'sidebarItems'>}
      mode="readonly"
      SidebarItemRenderer={RecursiveChildRenderer}
    />
  )
}

function MountProbeRenderer({ item }: { item: AnySidebarItemWithContent }) {
  return <MountProbe label={item.name} onUnmount={mountProbeUnmountSpy} />
}

function MountProbe({ label, onUnmount }: { label: string; onUnmount: () => void }) {
  useEffect(() => onUnmount, [onUnmount])
  return <div>{label}</div>
}

function availableItemState(item: AnySidebarItemWithContent): EmbedSidebarItemState {
  return {
    status: 'available',
    label: item.name,
    item,
  }
}
