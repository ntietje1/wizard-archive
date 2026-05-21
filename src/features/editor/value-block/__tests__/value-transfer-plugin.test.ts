import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Fragment, Schema, Slice } from '@tiptap/pm/model'
import { noteValueInlineConfig } from '../../../../../shared/note-values/block-config'
import { createValueTransferPlugin, useValueTransferBehavior } from '../value-transfer-plugin'
import type { EditorView } from '@tiptap/pm/view'

const schema = new Schema({
  nodes: {
    doc: { content: 'paragraph+' },
    paragraph: {
      content: 'inline*',
      group: 'block',
      toDOM: () => ['p', 0],
      parseDOM: [{ tag: 'p' }],
    },
    text: { group: 'inline' },
    value: {
      inline: true,
      group: 'inline',
      atom: true,
      attrs: {
        valueId: { default: '' },
        slug: { default: '' },
        expressionSource: { default: '' },
      },
      toDOM: (node) => ['span', node.attrs],
      parseDOM: [{ tag: 'span' }],
    },
  },
})

function valueNode(valueId: string, slug = 'prof_bonus', expressionSource = '3') {
  return schema.nodes.value.create({
    valueId,
    slug,
    expressionSource,
  })
}

function pastedSlice() {
  return new Slice(
    Fragment.from(
      schema.nodes.paragraph.create(null, [
        schema.text('Bonus '),
        valueNode('copied-value-id', 'prof_bonus'),
        schema.text(' and '),
        valueNode('second-copied-value-id', 'prof_bonus'),
      ]),
    ),
    0,
    0,
  )
}

function valuePropsFromSlice(slice: Slice) {
  const valueProps: Array<{ valueId: string; slug: string; expressionSource: string }> = []
  slice.content.descendants((node) => {
    if (node.type.name === 'value') {
      valueProps.push({
        valueId: node.attrs.valueId,
        slug: node.attrs.slug,
        expressionSource: node.attrs.expressionSource,
      })
    }
  })
  return valueProps
}

function transformPastedSlice(
  plugin: ReturnType<typeof createValueTransferPlugin>,
  slice: Slice,
  view = {} as EditorView,
) {
  const transformPasted = plugin.props.transformPasted
  expect(transformPasted).toBeDefined()
  return transformPasted?.call(plugin, slice, view, false)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('value transfer plugin', () => {
  it('marks value inline content as draggable editor content', () => {
    expect(noteValueInlineConfig.meta).toMatchObject({ draggable: true })
  })

  it('assigns fresh value IDs and next slugs to pasted value inline content', () => {
    const ids = ['new-value-1', 'new-value-2']
    const plugin = createValueTransferPlugin({
      createId: () => ids.shift() ?? 'unexpected-id',
      getExistingSlugs: () => ['prof_bonus'],
    })

    const transformed = transformPastedSlice(plugin, pastedSlice())

    expect(transformed).toBeInstanceOf(Slice)
    expect(valuePropsFromSlice(transformed as Slice)).toEqual([
      { valueId: 'new-value-1', slug: 'prof_bonus-1', expressionSource: '3' },
      { valueId: 'new-value-2', slug: 'prof_bonus-2', expressionSource: '3' },
    ])
  })

  it('rewrites copied same-note value references to the copied slugs', () => {
    const ids = ['new-base', 'new-total']
    const plugin = createValueTransferPlugin({
      createId: () => ids.shift() ?? 'unexpected-id',
      getExistingSlugs: () => ['base', 'total'],
    })
    const slice = new Slice(
      Fragment.from(
        schema.nodes.paragraph.create(null, [
          valueNode('base-id', 'base', '1'),
          valueNode('total-id', 'total', '[[base]] + [[External.base]]'),
        ]),
      ),
      0,
      0,
    )

    const transformed = transformPastedSlice(plugin, slice)

    expect(valuePropsFromSlice(transformed as Slice)).toEqual([
      { valueId: 'new-base', slug: 'base-1', expressionSource: '1' },
      { valueId: 'new-total', slug: 'total-1', expressionSource: '[[base-1]] + [[External.base]]' },
    ])
  })

  it('leaves slices without value inline content unchanged', () => {
    const plugin = createValueTransferPlugin({ createId: () => 'new-value-id' })
    const textOnlySlice = new Slice(
      Fragment.from(schema.nodes.paragraph.create(null, [schema.text('Text')])),
      0,
      0,
    )

    const transformed = transformPastedSlice(plugin, textOnlySlice)

    expect(transformed).toBe(textOnlySlice)
  })

  it('does not refresh IDs for internal editor drags', () => {
    const plugin = createValueTransferPlugin({ createId: () => 'new-value-id' })
    const slice = pastedSlice()
    const draggingView = { dragging: { slice, move: true } } as unknown as EditorView

    const transformed = transformPastedSlice(plugin, slice, draggingView)

    expect(transformed).toBe(slice)
  })

  it('assigns fresh IDs for internal copy-drags', () => {
    const ids = ['copy-value-1', 'copy-value-2']
    const plugin = createValueTransferPlugin({
      createId: () => ids.shift() ?? 'unexpected-id',
      getExistingSlugs: () => ['prof_bonus'],
    })
    const slice = pastedSlice()
    const draggingView = { dragging: { slice, move: false } } as unknown as EditorView

    const transformed = transformPastedSlice(plugin, slice, draggingView)

    expect(transformed).toBeInstanceOf(Slice)
    expect(transformed).not.toBe(slice)
    expect(valuePropsFromSlice(transformed as Slice)).toEqual([
      { valueId: 'copy-value-1', slug: 'prof_bonus-1', expressionSource: '3' },
      { valueId: 'copy-value-2', slug: 'prof_bonus-2', expressionSource: '3' },
    ])
  })

  it('does not refresh IDs when another transform cloned an internal move drag slice first', () => {
    const plugin = createValueTransferPlugin({ createId: () => 'new-value-id' })
    const originalSlice = pastedSlice()
    const transformedByAnotherPlugin = new Slice(
      originalSlice.content,
      originalSlice.openStart,
      originalSlice.openEnd,
    )
    const draggingView = { dragging: { slice: originalSlice, move: true } } as unknown as EditorView

    const transformed = transformPastedSlice(plugin, transformedByAnotherPlugin, draggingView)

    expect(transformed).toBe(transformedByAnotherPlugin)
  })

  it('does not route value selection drops through ProseMirror handleDrop props', () => {
    const plugin = createValueTransferPlugin()

    expect(plugin.props.handleDrop).toBeUndefined()
  })

  it('does not schedule a plugin registration retry after cleanup', () => {
    const requestAnimationFrameMock = vi.fn((_callback: FrameRequestCallback) => 1)
    const cancelAnimationFrameMock = vi.fn()
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrameMock)
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrameMock)
    const editor: { _tiptapEditor?: never } = {}

    const { unmount } = renderHook(() => useValueTransferBehavior(editor, true))

    expect(requestAnimationFrameMock).toHaveBeenCalledOnce()
    unmount()
    requestAnimationFrameMock.mock.calls[0][0](0)

    expect(cancelAnimationFrameMock).toHaveBeenCalledWith(1)
    expect(requestAnimationFrameMock).toHaveBeenCalledOnce()
  })
})
