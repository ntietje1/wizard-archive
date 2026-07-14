import { testResourceId } from '../../../../../../shared/test/resource-id'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { EmbedNoteContent } from '../canvas-note-content'
import type { CustomBlockNoteEditor } from '../../editor-schema'
import type { NoteItemWithContent } from '../../../notes/item-contract'
import type * as ReactModule from 'react'
import type * as BlockNoteContextMenuModule from '../../context-menu/blocknote-context-menu'
import type * as BlockShareMenuModule from '../../../sharing/block/use-menu'
import type { ReactNode, Ref } from 'react'
import { createNote } from '../../../test/sidebar-item-factory'
import {
  createTestNoteContentSource,
  createTestNotePermissionContentSource,
} from '../../../test/note-content-source-factory'

const mockEditor = vi.hoisted(() => ({ id: 'editor' }) as unknown as CustomBlockNoteEditor)
const mockUseBlockNoteActivationLifecycle = vi.hoisted(() => vi.fn())
const noteContentSpy = vi.hoisted(() => vi.fn())

vi.mock('../../../rich-text/blocknote/activation-lifecycle', () => ({
  useBlockNoteActivationLifecycle: (...args: Array<unknown>) =>
    mockUseBlockNoteActivationLifecycle(...args),
}))

vi.mock('../../content', async () => {
  const React = await vi.importActual<typeof ReactModule>('react')
  const { BlockNoteContextMenuContext } = await vi.importActual<typeof BlockNoteContextMenuModule>(
    '../../context-menu/blocknote-context-menu',
  )
  const { useBlockShareMenu } = await vi.importActual<typeof BlockShareMenuModule>(
    '../../../sharing/block/use-menu',
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

vi.mock('@wizard-archive/ui/shadcn/components/scroll-area', () => ({
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
    const source = createTestNoteContentSource()
    render(
      <EmbedNoteContent
        note={createTestNote()}
        editable={true}
        isExclusivelySelected={true}
        pendingActivationRef={pendingActivationRef}
        documentSource={source.document}
        embeddedNoteContentSource={source.embeddedNotes}
        embedTargetSource={source.embedTargets}
        linkCreationSource={source.linkCreation}
        linkNavigationSource={source.linkNavigation}
        linkResolutionSource={source.linkResolution}
        noteValueReferences={source.valueReferences}
        noteValueStateSource={source.valueState}
        permissionSource={createTestNotePermissionContentSource()}
        playbackSource={source.playback}
        sharingSource={source.sharing}
        textColor="var(--foreground)"
        wikiLinkSource={source.wikiLinks}
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
    const source = createTestNoteContentSource()
    render(
      <EmbedNoteContent
        note={createTestNote()}
        editable={false}
        isExclusivelySelected={true}
        pendingActivationRef={pendingActivationRef}
        documentSource={source.document}
        embeddedNoteContentSource={source.embeddedNotes}
        embedTargetSource={source.embedTargets}
        linkCreationSource={source.linkCreation}
        linkNavigationSource={source.linkNavigation}
        linkResolutionSource={source.linkResolution}
        noteValueReferences={source.valueReferences}
        noteValueStateSource={source.valueState}
        permissionSource={createTestNotePermissionContentSource()}
        playbackSource={source.playback}
        sharingSource={source.sharing}
        textColor="var(--foreground)"
        wikiLinkSource={source.wikiLinks}
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
    const source = createTestNoteContentSource()
    render(
      <EmbedNoteContent
        note={createTestNote()}
        editable={true}
        isExclusivelySelected={false}
        pendingActivationRef={pendingActivationRef}
        documentSource={source.document}
        embeddedNoteContentSource={source.embeddedNotes}
        embedTargetSource={source.embedTargets}
        linkCreationSource={source.linkCreation}
        linkNavigationSource={source.linkNavigation}
        linkResolutionSource={source.linkResolution}
        noteValueReferences={source.valueReferences}
        noteValueStateSource={source.valueState}
        permissionSource={createTestNotePermissionContentSource()}
        playbackSource={source.playback}
        sharingSource={source.sharing}
        textColor="var(--foreground)"
        wikiLinkSource={source.wikiLinks}
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
    const source = createTestNoteContentSource()
    const { unmount } = render(
      <EmbedNoteContent
        note={createTestNote()}
        editable={true}
        isExclusivelySelected={true}
        onCanvasEditorChange={onCanvasEditorChange}
        pendingActivationRef={pendingActivationRef}
        documentSource={source.document}
        embeddedNoteContentSource={source.embeddedNotes}
        embedTargetSource={source.embedTargets}
        linkCreationSource={source.linkCreation}
        linkNavigationSource={source.linkNavigation}
        linkResolutionSource={source.linkResolution}
        noteValueReferences={source.valueReferences}
        noteValueStateSource={source.valueState}
        permissionSource={createTestNotePermissionContentSource()}
        playbackSource={source.playback}
        sharingSource={source.sharing}
        textColor="var(--foreground)"
        wikiLinkSource={source.wikiLinks}
      />,
    )

    expect(onCanvasEditorChange).toHaveBeenCalledWith(mockEditor)

    unmount()

    expect(onCanvasEditorChange).toHaveBeenCalledWith(null)
  })

  it('passes textColor to the embedded BlockNote container as the default editor text color', () => {
    const pendingActivationRef = { current: null }
    const source = createTestNoteContentSource()
    render(
      <EmbedNoteContent
        note={createTestNote()}
        editable={true}
        isExclusivelySelected={true}
        pendingActivationRef={pendingActivationRef}
        documentSource={source.document}
        embeddedNoteContentSource={source.embeddedNotes}
        embedTargetSource={source.embedTargets}
        linkCreationSource={source.linkCreation}
        linkNavigationSource={source.linkNavigation}
        linkResolutionSource={source.linkResolution}
        noteValueReferences={source.valueReferences}
        noteValueStateSource={source.valueState}
        permissionSource={createTestNotePermissionContentSource()}
        playbackSource={source.playback}
        sharingSource={source.sharing}
        textColor="var(--t-purple)"
        wikiLinkSource={source.wikiLinks}
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

function createTestNote(): NoteItemWithContent {
  return {
    ...createNote({ id: testResourceId('note-id') }),
    ancestors: [],
    content: [],
    blockMeta: {},
    blockShareAccessWarnings: [],
  }
}
