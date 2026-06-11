import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EmbedNoteContent } from '~/features/embeds/components/canvas-embed-note-content'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import type { NoteWithContent } from 'shared/notes/types'
import type * as ReactModule from 'react'
import type * as BlockNoteContextMenuModule from '~/features/editor/hooks/useBlockNoteContextMenu'
import type * as BlockShareMenuModule from '~/features/sharing/contexts/useBlockShareMenu'
import type { ReactNode, Ref } from 'react'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { testId } from '~/test/helpers/test-id'

const mockEditor = vi.hoisted(() => ({ id: 'editor' }) as unknown as CustomBlockNoteEditor)
const mockUseBlockNoteActivationLifecycle = vi.hoisted(() => vi.fn())
const noteContentSpy = vi.hoisted(() => vi.fn())

vi.mock('~/features/embeds/hooks/use-blocknote-activation-lifecycle', () => ({
  useBlockNoteActivationLifecycle: (...args: Array<unknown>) =>
    mockUseBlockNoteActivationLifecycle(...args),
}))

vi.mock('~/features/editor/components/note-content', async () => {
  const React = await vi.importActual<typeof ReactModule>('react')
  const { BlockNoteContextMenuContext } = await vi.importActual<typeof BlockNoteContextMenuModule>(
    '~/features/editor/hooks/useBlockNoteContextMenu',
  )
  const { useBlockShareMenu } = await vi.importActual<typeof BlockShareMenuModule>(
    '~/features/sharing/contexts/useBlockShareMenu',
  )

  return {
    NoteContent: ({
      onEditorChange,
      ...props
    }: {
      onEditorChange?: (editor: CustomBlockNoteEditor | null, doc: null) => void
      style?: React.CSSProperties
    }) => {
      const onEditorChangeRef = React.useRef(onEditorChange)
      onEditorChangeRef.current = onEditorChange
      const blockShareMenu = useBlockShareMenu()
      const blockNoteContextMenu = React.useContext(BlockNoteContextMenuContext)
      noteContentSpy({
        ...props,
        blockNoteContextMenuAvailable: blockNoteContextMenu !== null,
        blockShareMenuAvailable: typeof blockShareMenu.open === 'function',
      })
      React.useEffect(() => {
        onEditorChangeRef.current?.(mockEditor, null)
        return () => onEditorChangeRef.current?.(null, null)
      }, [])

      return <div data-testid="embed-note-content-editor" />
    },
  }
})

vi.mock('~/features/shadcn/components/scroll-area', () => ({
  ScrollArea: ({
    children,
    contentClassName,
    viewportRef,
  }: {
    children: ReactNode
    contentClassName?: string
    viewportRef?: Ref<HTMLDivElement>
  }) => (
    <div
      ref={viewportRef}
      data-testid="embed-note-scroll-area"
      data-content-class-name={contentClassName}
    >
      {children}
    </div>
  ),
}))

describe('EmbedNoteContent', () => {
  beforeEach(() => {
    mockUseBlockNoteActivationLifecycle.mockReset()
    noteContentSpy.mockReset()
  })

  it('renders without pointer-based note focus plumbing', () => {
    const pendingActivationRef = { current: null }
    render(
      <EmbedNoteContent
        note={createTestNote()}
        editable={true}
        isExclusivelySelected={true}
        pendingActivationRef={pendingActivationRef}
        textColor="var(--foreground)"
      />,
    )

    expect(screen.getByTestId('embed-note-content-editor')).toBeInTheDocument()
    expect(screen.getByTestId('embed-note-content-wrapper')).toHaveClass('nowheel')
    expect(screen.getByTestId('embed-note-scroll-area')).toHaveAttribute(
      'data-content-class-name',
      'note-editor-scroll-content',
    )
    expect(noteContentSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        blockNoteContextMenuAvailable: true,
        blockShareMenuAvailable: true,
        fillHeight: true,
      }),
    )
    expect(mockUseBlockNoteActivationLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({
        editable: true,
        editor: mockEditor,
        pendingActivationRef,
      }),
    )

    const lifecycleCallCount = mockUseBlockNoteActivationLifecycle.mock.calls.length
    const wrapper = screen.getByTestId('embed-note-content-wrapper')
    fireEvent.pointerDown(wrapper, { button: 0, clientX: 25, clientY: 40 })
    fireEvent.pointerUp(wrapper, { button: 0, clientX: 25, clientY: 40 })

    expect(mockUseBlockNoteActivationLifecycle).toHaveBeenCalledTimes(lifecycleCallCount)
  })

  it('passes read-only editability through to the activation lifecycle', () => {
    const pendingActivationRef = { current: null }
    render(
      <EmbedNoteContent
        note={createTestNote()}
        editable={false}
        isExclusivelySelected={true}
        pendingActivationRef={pendingActivationRef}
        textColor="var(--foreground)"
      />,
    )

    expect(screen.getByTestId('embed-note-content-wrapper')).not.toHaveClass('nodrag')
    expect(mockUseBlockNoteActivationLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({
        editable: false,
        editor: mockEditor,
        pendingActivationRef,
      }),
    )
  })

  it('omits wheel suppression when the embed is not exclusively selected', () => {
    const pendingActivationRef = { current: null }
    render(
      <EmbedNoteContent
        note={createTestNote()}
        editable={true}
        isExclusivelySelected={false}
        pendingActivationRef={pendingActivationRef}
        textColor="var(--foreground)"
      />,
    )

    expect(screen.getByTestId('embed-note-content-wrapper')).toHaveClass('nodrag', 'nopan')
    expect(screen.getByTestId('embed-note-content-wrapper')).not.toHaveClass('nowheel')
    expect(mockUseBlockNoteActivationLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({
        editable: true,
        editor: mockEditor,
        pendingActivationRef,
      }),
    )
  })

  it('notifies the canvas when the embedded editor unmounts', () => {
    const onCanvasEditorChange = vi.fn()
    const pendingActivationRef = { current: null }
    const { unmount } = render(
      <EmbedNoteContent
        note={createTestNote()}
        editable={true}
        isExclusivelySelected={true}
        onCanvasEditorChange={onCanvasEditorChange}
        pendingActivationRef={pendingActivationRef}
        textColor="var(--foreground)"
      />,
    )

    expect(onCanvasEditorChange).toHaveBeenCalledWith(mockEditor)

    unmount()

    expect(onCanvasEditorChange).toHaveBeenCalledWith(null)
  })

  it('passes textColor to the embedded BlockNote container as the default editor text color', () => {
    const pendingActivationRef = { current: null }
    render(
      <EmbedNoteContent
        note={createTestNote()}
        editable={true}
        isExclusivelySelected={true}
        pendingActivationRef={pendingActivationRef}
        textColor="var(--t-purple)"
      />,
    )

    expect(noteContentSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        style: expect.objectContaining({
          '--editor-text-color': 'var(--t-purple)',
          color: 'var(--t-purple)',
        }),
      }),
    )
  })
})

function createTestNote(): NoteWithContent {
  return {
    ...createNote({ _id: testId<'sidebarItems'>('note-id') }),
    ancestors: [],
    content: [],
    blockMeta: {},
    blockShareAccessWarnings: [],
  }
}
