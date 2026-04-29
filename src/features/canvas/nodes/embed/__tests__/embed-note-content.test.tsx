import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EmbedNoteContent } from '../embed-note-content'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import type * as ReactModule from 'react'
import type { ReactNode, Ref } from 'react'
import { testId } from '~/test/helpers/test-id'

const mockEditor = vi.hoisted(() => ({ id: 'editor' }) as unknown as CustomBlockNoteEditor)
const mockUseBlockNoteActivationLifecycle = vi.hoisted(() => vi.fn())

vi.mock('../../shared/use-blocknote-activation-lifecycle', () => ({
  useBlockNoteActivationLifecycle: (...args: Array<unknown>) =>
    mockUseBlockNoteActivationLifecycle(...args),
}))

vi.mock('~/features/editor/components/note-content', async () => {
  const React = await vi.importActual<typeof ReactModule>('react')

  return {
    NoteContent: ({
      onEditorChange,
    }: {
      onEditorChange?: (editor: CustomBlockNoteEditor | null, doc: null) => void
    }) => {
      React.useEffect(() => {
        onEditorChange?.(mockEditor, null)
        return () => onEditorChange?.(null, null)
      }, [onEditorChange])

      return <div data-testid="embed-note-content-editor" />
    },
  }
})

vi.mock('~/features/shadcn/components/scroll-area', () => ({
  ScrollArea: ({
    children,
    viewportRef,
  }: {
    children: ReactNode
    viewportRef?: Ref<HTMLDivElement>
  }) => (
    <div ref={viewportRef} data-testid="embed-note-scroll-area">
      {children}
    </div>
  ),
}))

describe('EmbedNoteContent', () => {
  beforeEach(() => {
    mockUseBlockNoteActivationLifecycle.mockReset()
  })

  it('renders without pointer-based note focus plumbing', () => {
    const pendingActivationRef = { current: null }
    render(
      <EmbedNoteContent
        noteId={testId<'sidebarItems'>('note-id')}
        content={[]}
        editable={true}
        isExclusivelySelected={true}
        pendingActivationRef={pendingActivationRef}
      />,
    )

    expect(screen.getByTestId('embed-note-content-editor')).toBeInTheDocument()
    expect(screen.getByTestId('embed-note-content-wrapper')).toHaveClass('nowheel')
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
        noteId={testId<'sidebarItems'>('note-id')}
        content={[]}
        editable={false}
        isExclusivelySelected={true}
        pendingActivationRef={pendingActivationRef}
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
        noteId={testId<'sidebarItems'>('note-id')}
        content={[]}
        editable={true}
        isExclusivelySelected={false}
        pendingActivationRef={pendingActivationRef}
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
        noteId={testId<'sidebarItems'>('note-id')}
        content={[]}
        editable={true}
        isExclusivelySelected={true}
        onCanvasEditorChange={onCanvasEditorChange}
        pendingActivationRef={pendingActivationRef}
      />,
    )

    expect(onCanvasEditorChange).toHaveBeenCalledWith(mockEditor)

    unmount()

    expect(onCanvasEditorChange).toHaveBeenCalledWith(null)
  })
})
