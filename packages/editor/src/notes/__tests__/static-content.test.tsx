import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { StaticNoteContent } from '../static-content'
import {
  standaloneEmbeddedNoteContentSource,
  standaloneNoteEmbedTargetSource,
  standaloneNoteLinkNavigationSource,
  standaloneNoteLinkResolutionSource,
  standaloneNoteValueReferences,
  standaloneNoteValueStateSource,
} from '../standalone-note-content-sources'
import type * as BlockNoteCore from '@blocknote/core'
import type { NoteBlock } from '../document/model'
import type { NoteItemWithContent } from '../../notes/item-contract'
import type { CustomBlockNoteEditor } from '../editor-schema'
import type { EmbeddedNotePreviewRenderer } from '../embeds/embedded-note-preview-renderer'
import type { ReactNode } from 'react'
import { testNoteBlockId } from '../../test/blocknote-id'

const { blockNoteCreateMock } = vi.hoisted(() => ({
  blockNoteCreateMock: vi.fn((options: { initialContent?: Array<unknown> }) => ({
    document: options.initialContent ?? [],
    replaceBlocks: vi.fn(),
    _tiptapEditor: {
      destroy: vi.fn(),
      off: vi.fn(),
      on: vi.fn(),
      extensionManager: {
        extensions: [],
      },
      registerPlugin: vi.fn(),
    },
  })),
}))

vi.mock('@blocknote/core', async (importOriginal) => {
  const actual = await importOriginal<typeof BlockNoteCore>()
  return {
    ...actual,
    BlockNoteEditor: {
      create: blockNoteCreateMock,
    },
  }
})

vi.mock('../view', () => ({
  NoteView: ({
    editor,
    children,
    renderEmbeddedNotePreview,
  }: {
    editor: CustomBlockNoteEditor
    children?: ReactNode
    renderEmbeddedNotePreview?: EmbeddedNotePreviewRenderer
  }) => (
    <MockNoteView editor={editor} renderEmbeddedNotePreview={renderEmbeddedNotePreview}>
      {children}
    </MockNoteView>
  ),
}))

function MockNoteView({
  children,
  editor,
  renderEmbeddedNotePreview,
}: {
  children?: ReactNode
  editor: CustomBlockNoteEditor
  renderEmbeddedNotePreview?: EmbeddedNotePreviewRenderer
}) {
  return (
    <div data-testid="note-view">
      <div>
        {editor.document.flatMap((block) => {
          if (block.type === 'embed') {
            const props = block.props as {
              note?: NoteItemWithContent
              targetKind?: string
              url?: string
            }
            if (props.targetKind === 'note' && props.note && renderEmbeddedNotePreview) {
              return [renderEmbeddedNotePreview({ allowInnerScroll: false, note: props.note })]
            }
            return [props.url ?? props.targetKind]
          }
          return Array.isArray(block.content)
            ? block.content.map((item) => {
                if (item.type === 'value') return item.props.slug
                if (item.type === 'text') return (item as { text: string }).text
                return ''
              })
            : []
        })}
      </div>
      {children}
    </div>
  )
}

describe('StaticNoteContent', () => {
  it('keeps embedded preview framing outside the static editor lifecycle module', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'packages/editor/src/notes/static-content.tsx'),
      'utf8',
    )

    expect(source).toContain('createEmbeddedNotePreviewRenderer')
    expect(source).not.toContain('ScrollArea')
    expect(source).not.toContain('function EmbeddedNoteBlockPreviewContent')
    expect(source).not.toContain("from '@blocknote/core'")
    expect(source).not.toContain('BlockNoteEditor.create')
    expect(source).not.toContain('createEditorSchema')
    expect(source).not.toContain('destroyBlockNoteEditor')
    expect(source).not.toContain('useOwnedBlockNoteEditor')
    expect(source).not.toContain('NoteDocumentRuntime')
    expect(source).not.toContain('NoteLinkClickHandler')
    expect(source).not.toContain('NoteView')
    expect(source).not.toContain('function StaticNoteContentBody')
    expect(source).not.toContain('useStaticNoteContentEditor')
    expect(source).not.toContain('StaticNoteRuntimeSurface')
    expect(source).toContain('StaticNoteEditorSurface')
  })

  it('keeps recursive embedded note previews on the lightweight readonly path', () => {
    const rendererSource = readFileSync(
      path.resolve(
        process.cwd(),
        'packages/editor/src/notes/embeds/embedded-note-preview-renderer.ts',
      ),
      'utf8',
    )
    const blockPreviewSource = readFileSync(
      path.resolve(
        process.cwd(),
        'packages/editor/src/notes/embeds/embedded-note-block-preview-content.tsx',
      ),
      'utf8',
    )

    expect(rendererSource).not.toContain('StaticNoteContent')
    expect(blockPreviewSource).toContain('ReadonlyNoteBlocksSurface')
    expect(blockPreviewSource).not.toContain('StaticNoteContent')
  })

  it('renders inline values through the shared note editor core', () => {
    render(
      <StaticNoteContent
        content={[
          {
            id: 'paragraph-1',
            type: 'paragraph',
            props: {},
            content: [
              {
                type: 'value',
                props: {
                  valueId: 'value-1',
                  slug: 'strength',
                  expressionSource: '16',
                },
              },
            ],
            children: [],
          } as unknown as NoteBlock,
        ]}
        embeddedNoteContentSource={standaloneEmbeddedNoteContentSource}
        embedTargetSource={standaloneNoteEmbedTargetSource}
        linkNavigationSource={standaloneNoteLinkNavigationSource}
        linkResolutionSource={standaloneNoteLinkResolutionSource}
        noteValueReferences={standaloneNoteValueReferences}
        noteValueStateSource={standaloneNoteValueStateSource}
      />,
    )

    expect(screen.getByTestId('note-view')).toHaveTextContent('strength')
    const editorOptions = blockNoteCreateMock.mock.calls[0][0]
    expect(editorOptions).toEqual(
      expect.objectContaining({
        disableExtensions: ['link'],
        initialContent: expect.any(Array),
      }),
    )
  })

  it('renders embed blocks through the shared note editor core', async () => {
    render(
      <StaticNoteContent
        content={
          [
            {
              id: 'embed-1',
              type: 'embed',
              props: {
                targetKind: 'externalUrl',
                url: 'https://example.com/file.pdf',
                name: 'file.pdf',
                textAlignment: 'left',
                backgroundColor: 'default',
              },
              content: undefined,
              children: [],
            },
          ] as never
        }
        embeddedNoteContentSource={standaloneEmbeddedNoteContentSource}
        embedTargetSource={standaloneNoteEmbedTargetSource}
        linkNavigationSource={standaloneNoteLinkNavigationSource}
        linkResolutionSource={standaloneNoteLinkResolutionSource}
        noteValueReferences={standaloneNoteValueReferences}
        noteValueStateSource={standaloneNoteValueStateSource}
      />,
    )

    expect(await screen.findByTestId('note-view')).toHaveTextContent('https://example.com/file.pdf')
  })

  it('renders embedded note previews from source-projected content', async () => {
    const visibleBlock = createParagraphBlock('visible-block', 'Visible')
    const hiddenBlock = createParagraphBlock('hidden-block', 'Hidden')
    const note = {
      id: 'note-2',
      content: [visibleBlock, hiddenBlock],
      blockMeta: {},
    }
    const getEmbeddedNoteContent = vi.fn(() => [visibleBlock])

    render(
      <StaticNoteContent
        content={
          [
            {
              id: 'embed-1',
              type: 'embed',
              props: {
                targetKind: 'note',
                note,
              },
              content: undefined,
              children: [],
            },
          ] as never
        }
        embeddedNoteContentSource={{ getEmbeddedNoteContent }}
        embedTargetSource={standaloneNoteEmbedTargetSource}
        linkNavigationSource={standaloneNoteLinkNavigationSource}
        linkResolutionSource={standaloneNoteLinkResolutionSource}
        noteValueReferences={standaloneNoteValueReferences}
        noteValueStateSource={standaloneNoteValueStateSource}
      />,
    )

    expect(await screen.findByText('Visible')).toBeInTheDocument()
    expect(screen.queryByText('Hidden')).toBeNull()
    expect(getEmbeddedNoteContent).toHaveBeenCalledWith(note)
  })
})

function createParagraphBlock(id: string, text: string): NoteBlock {
  return {
    id: testNoteBlockId(id),
    type: 'paragraph',
    props: {},
    content: [
      {
        type: 'text',
        text,
        styles: {},
      },
    ],
    children: [],
  }
}
