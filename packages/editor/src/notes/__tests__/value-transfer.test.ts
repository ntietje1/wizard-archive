import { Fragment, Schema, Slice } from '@tiptap/pm/model'
import { describe, expect, it } from 'vite-plus/test'
import { noteValueTransferExtension } from '../values/value-transfer'
import type { BlockNoteEditor } from '@blocknote/core'
import type { Plugin } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { content: 'inline*', group: 'block' },
    text: { group: 'inline' },
    value: {
      group: 'inline',
      inline: true,
      atom: true,
      attrs: {
        valueId: { default: '' },
        label: { default: '' },
        expressionSource: { default: '' },
      },
    },
  },
})

describe('note value transfer', () => {
  it('assigns copied values new identities and rewrites copied dependencies', () => {
    const sourceId = 'source-id'
    const dependentId = 'dependent-id'
    const slice = new Slice(
      Fragment.from(
        schema.node('paragraph', null, [
          schema.node('value', {
            valueId: sourceId,
            label: 'Source',
            expressionSource: '10',
          }),
          schema.text(' '),
          schema.node('value', {
            valueId: dependentId,
            label: 'Dependent',
            expressionSource: `{{${sourceId}}} * 2`,
          }),
        ]),
      ),
      0,
      0,
    )

    const plugin = transferPlugin()
    const copied = plugin.props.transformPasted!.call(plugin, slice, editorView(), false)
    const values: Array<Record<string, unknown>> = []
    copied.content.descendants((node) => {
      if (node.type.name === 'value') values.push(node.attrs)
    })

    expect(values).toHaveLength(2)
    expect(values[0]).toMatchObject({ label: 'Source', expressionSource: '10' })
    expect(values[1]).toMatchObject({
      label: 'Dependent',
      expressionSource: `{{${String(values[0]!.valueId)}}} * 2`,
    })
    expect(values[0]!.valueId).not.toBe(sourceId)
    expect(values[1]!.valueId).not.toBe(dependentId)
  })

  it('preserves internal moves', () => {
    const slice = new Slice(
      Fragment.from(
        schema.node('paragraph', null, [
          schema.node('value', {
            valueId: 'moved-id',
            label: 'Moved',
            expressionSource: '10',
          }),
        ]),
      ),
      0,
      0,
    )
    const plugin = transferPlugin()

    expect(plugin.props.transformPasted!.call(plugin, slice, editorView(true), false)).toBe(slice)
  })
})

function transferPlugin() {
  const extension = noteValueTransferExtension({ editor: {} as BlockNoteEditor })
  const plugin = extension.prosemirrorPlugins?.[0] as Plugin | undefined
  if (!plugin) throw new Error('Expected the value transfer plugin to register')
  return plugin
}

function editorView(internalMove = false) {
  return { dragging: internalMove ? { move: true } : null } as unknown as EditorView
}
