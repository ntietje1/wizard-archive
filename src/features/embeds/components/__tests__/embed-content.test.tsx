import { render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import { EmbedAncestryProvider } from '../../context/embed-render-ancestry'
import { EmbedContent } from '../embed-content'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItemWithContent } from 'shared/sidebar-items/model-types'

const useSidebarItemByIdMock = vi.hoisted(() => vi.fn())
const useSidebarItemAvailabilityStateMock = vi.hoisted(() => vi.fn())

vi.mock('~/features/sidebar/hooks/useSidebarItemById', () => ({
  useSidebarItemById: (...args: Array<unknown>) => useSidebarItemByIdMock(...args),
}))

vi.mock('~/features/sidebar/hooks/useSidebarItemAvailabilityState', () => ({
  useSidebarItemAvailabilityState: (...args: Array<unknown>) =>
    useSidebarItemAvailabilityStateMock(...args),
}))

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
    useSidebarItemByIdMock.mockReturnValue({ data: null, isLoading: false, error: null })
    useSidebarItemAvailabilityStateMock.mockReturnValue({
      status: 'not_found',
      label: 'Embedded item',
      message: "This item doesn't exist.",
    })
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
    useSidebarItemByIdMock.mockReturnValue({ data: item, isLoading: false, error: null })
    useSidebarItemAvailabilityStateMock.mockReturnValue({
      status: 'available',
      label: 'Folder A',
      item,
    })

    render(
      <EmbedContent
        target={{ kind: 'sidebarItem', sidebarItemId: 'folder-a' as Id<'sidebarItems'> }}
        sourceItemId={null}
        mode="readonly"
        SidebarItemRenderer={SidebarItemNameRenderer}
      />,
    )

    expect(screen.getByText('Folder A')).toBeInTheDocument()
  })

  it('does not remount sidebar item content when the render callback identity changes', () => {
    const item = {
      _id: 'canvas-a',
      type: SIDEBAR_ITEM_TYPES.canvases,
      name: 'Canvas A',
    }
    const unmountSpy = vi.fn()
    mountProbeUnmountSpy = unmountSpy
    useSidebarItemByIdMock.mockReturnValue({ data: item, isLoading: false, error: null })
    useSidebarItemAvailabilityStateMock.mockReturnValue({
      status: 'available',
      label: 'Canvas A',
      item,
    })

    const { rerender } = render(
      <EmbedContent
        target={{ kind: 'sidebarItem', sidebarItemId: 'canvas-a' as Id<'sidebarItems'> }}
        sourceItemId={null}
        mode="readonly"
        SidebarItemRenderer={MountProbeRenderer}
      />,
    )

    rerender(
      <EmbedContent
        target={{ kind: 'sidebarItem', sidebarItemId: 'canvas-a' as Id<'sidebarItems'> }}
        sourceItemId={null}
        mode="readonly"
        SidebarItemRenderer={MountProbeRenderer}
      />,
    )

    expect(screen.getByText('Canvas A')).toBeInTheDocument()
    expect(unmountSpy).not.toHaveBeenCalled()
  })

  it('renders trashed sidebar item embeds as unavailable instead of rich content', () => {
    const item = {
      _id: 'note-a',
      type: SIDEBAR_ITEM_TYPES.notes,
      name: 'Trashed Note',
    }
    useSidebarItemByIdMock.mockReturnValue({ data: item, isLoading: false, error: null })
    useSidebarItemAvailabilityStateMock.mockReturnValue({
      status: 'trashed',
      label: 'Trashed Note',
      message: 'This item is in the trash.',
    })

    render(
      <EmbedContent
        target={{ kind: 'sidebarItem', sidebarItemId: 'note-a' as Id<'sidebarItems'> }}
        sourceItemId={null}
        mode="readonly"
        SidebarItemRenderer={SidebarItemNameRenderer}
      />,
    )

    expect(screen.getByText('Trashed Note')).toBeInTheDocument()
    expect(screen.getByText('Embedded item is in the trash')).toBeInTheDocument()
  })

  it('renders internal file sidebar targets through shared media handling', () => {
    const item = {
      _id: 'file-a',
      type: SIDEBAR_ITEM_TYPES.files,
      name: 'Theme Song',
      downloadUrl: 'https://example.convex.cloud/api/storage/theme-song',
      contentType: 'audio/mpeg',
      previewUrl: null,
    }
    useSidebarItemByIdMock.mockReturnValue({ data: item, isLoading: false, error: null })
    useSidebarItemAvailabilityStateMock.mockReturnValue({
      status: 'available',
      label: 'Theme Song',
      item,
    })

    render(
      <EmbedContent
        target={{ kind: 'sidebarItem', sidebarItemId: 'file-a' as Id<'sidebarItems'> }}
        sourceItemId={null}
        mode="readonly"
        SidebarItemRenderer={SurfaceFallbackRenderer}
      />,
    )

    expect(document.querySelector('audio')).toHaveAttribute(
      'src',
      'https://example.convex.cloud/api/storage/theme-song',
    )
    expect(screen.queryByText('surface fallback')).not.toBeInTheDocument()
  })

  it('wraps rendered sidebar items with target ancestry', () => {
    const item = {
      _id: 'folder-a',
      type: SIDEBAR_ITEM_TYPES.folders,
      name: 'Folder A',
    }
    useSidebarItemByIdMock.mockReturnValue({ data: item, isLoading: false, error: null })
    useSidebarItemAvailabilityStateMock.mockReturnValue({
      status: 'available',
      label: 'Folder A',
      item,
    })

    render(
      <EmbedContent
        target={{ kind: 'sidebarItem', sidebarItemId: 'folder-a' as Id<'sidebarItems'> }}
        sourceItemId={null}
        mode="readonly"
        SidebarItemRenderer={RecursiveSameTargetRenderer}
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
    useSidebarItemByIdMock.mockReturnValue({ data: item, isLoading: false, error: null })
    useSidebarItemAvailabilityStateMock.mockReturnValue({
      status: 'available',
      label: 'Note B',
      item,
    })

    render(
      <EmbedContent
        target={{ kind: 'sidebarItem', sidebarItemId: 'note-b' as Id<'sidebarItems'> }}
        sourceItemId={'note-a' as Id<'sidebarItems'>}
        mode="readonly"
        SidebarItemRenderer={RecursiveSourceRenderer}
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
