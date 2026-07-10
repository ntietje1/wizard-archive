import { Schema } from '@tiptap/pm/model'
import { EditorState, Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { describe, expect, it } from 'vite-plus/test'
import { createSelectionStabilizerPlugin } from '../selection-stabilizer'

const schema = new Schema({
  nodes: {
    doc: { content: 'text*' },
    text: { group: 'inline' },
  },
})

function createState({
  key = new PluginKey('linkSelectionStabilizer'),
  plugins = [],
}: {
  key?: PluginKey
  plugins?: Array<Plugin>
} = {}) {
  return EditorState.create({
    schema,
    doc: schema.node('doc', null, [schema.text('abcdefghijklmnop')]),
    plugins: [createSelectionStabilizerPlugin(key), ...plugins],
  })
}

function applySelection(state: EditorState, from: number, to = from) {
  return state.apply(state.tr.setSelection(TextSelection.create(state.doc, from, to)))
}

describe('createSelectionStabilizerPlugin', () => {
  it('keeps oscillation history across meta-only transactions', () => {
    let state = createState()
    state = applySelection(state, 2)
    state = applySelection(state, 3)
    state = state.apply(state.tr.setMeta('unrelated', true))
    state = applySelection(state, 2)
    state = applySelection(state, 3)

    expect(state.selection.from).toBe(2)
  })

  it('clears oscillation history after document changes', () => {
    let state = createState()
    state = applySelection(state, 2)
    state = applySelection(state, 3)
    state = state.apply(state.tr.insertText('x', 1))
    state = applySelection(state, 2)
    state = applySelection(state, 3)

    expect(state.selection.from).toBe(3)
  })

  it('allows repeated nearby anchors when range endpoints are not adjacent', () => {
    let state = createState()
    state = applySelection(state, 2, 8)
    state = applySelection(state, 3, 14)
    state = applySelection(state, 2, 8)
    state = applySelection(state, 3, 14)

    expect(state.selection.from).toBe(3)
    expect(state.selection.to).toBe(14)
  })

  it('blocks the fourth move in an oscillating adjacent selection sequence', () => {
    let state = createState()
    state = applySelection(state, 2)
    state = applySelection(state, 3)
    state = applySelection(state, 2)
    state = applySelection(state, 3)

    expect(state.selection.from).toBe(2)
  })

  it('keeps rejected transactions out of the oscillation history', () => {
    const stabilizerKey = new PluginKey('linkSelectionStabilizer')
    const rejectingPlugin = new Plugin({
      filterTransaction(tr) {
        return tr.getMeta('reject-selection') !== true
      },
    })
    let state = createState({ key: stabilizerKey, plugins: [rejectingPlugin] })
    state = applySelection(state, 2)
    state = applySelection(state, 3)
    const rejected = state.tr
      .setSelection(TextSelection.create(state.doc, 2))
      .setMeta('reject-selection', true)
    state = state.apply(rejected)

    expect(stabilizerKey.getState(state)).toEqual([
      { from: 2, to: 2 },
      { from: 3, to: 3 },
    ])
  })
})
