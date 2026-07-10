import { Fragment, Schema, Slice } from '@tiptap/pm/model'
import { renderHook } from '@testing-library/react'
import { EditorState } from '@tiptap/pm/state'
import type { Plugin } from '@tiptap/pm/state'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { noteValueInlineConfig } from '../../values/block-config'
import { useValueTransferBehavior } from '../value-transfer-plugin'

const schema = new Schema({
  nodes: {
    doc: { content: 'inline*' },
    text: { group: 'inline' },
    value: {
      group: 'inline',
      inline: true,
      atom: true,
      attrs: {
        valueId: {},
        slug: {},
        expressionSource: {},
      },
    },
  },
  marks: {},
})

describe('value transfer plugin', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        callback(0)
        return 1
      }),
    )
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('marks value inline content as draggable editor content', () => {
    expect(noteValueInlineConfig.meta).toMatchObject({ draggable: true })
  })

  it('refreshes copied value ids, slugs, and same-note references on paste', () => {
    const copiedValueId = '00000000-0000-4000-8000-000000000000'
    const randomUuidSpy = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(copiedValueId)
    const registeredPlugins: Array<Plugin> = []
    const editor = {
      _tiptapEditor: {
        view: {
          dom: document.createElement('div'),
          state: EditorState.create({ schema }),
        } as never,
        registerPlugin: (plugin: Plugin) => {
          registeredPlugins.push(plugin)
        },
      },
    }
    renderHook(() => useValueTransferBehavior(editor, true, () => ['prof_bonus']))
    const plugin = registeredPlugins[0]
    const copiedValue = schema.nodes.value.create({
      valueId: 'value-source',
      slug: 'prof_bonus',
      expressionSource: '[[prof_bonus]] + 1',
    })
    const copiedSlice = new Slice(Fragment.from(copiedValue), 0, 0)

    const transformed =
      plugin.props.transformPasted?.call(plugin, copiedSlice, {} as never, false) ?? copiedSlice

    expect(transformed.content.firstChild?.attrs).toMatchObject({
      valueId: copiedValueId,
      slug: 'prof_bonus-1',
      expressionSource: '[[prof_bonus-1]] + 1',
    })
    randomUuidSpy.mockRestore()
  })

  it('keeps non-conflicting copied slugs and unregisters the plugin on cleanup', () => {
    const copiedValueId = '00000000-0000-4000-8000-000000000001'
    const randomUuidSpy = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(copiedValueId)
    const registeredPlugins: Array<Plugin> = []
    const unregisterPlugin = vi.fn()
    const editor = {
      _tiptapEditor: {
        view: {
          dom: document.createElement('div'),
          state: EditorState.create({ schema }),
        } as never,
        registerPlugin: (plugin: Plugin) => {
          registeredPlugins.push(plugin)
        },
        unregisterPlugin,
      },
    }
    const { unmount } = renderHook(() => useValueTransferBehavior(editor, true, () => []))
    const plugin = registeredPlugins[0]
    const copiedValue = schema.nodes.value.create({
      valueId: 'value-source',
      slug: 'prof_bonus',
      expressionSource: '[[other_note.prof_bonus]] + [[prof_bonus]]',
    })
    const copiedSlice = new Slice(Fragment.from(copiedValue), 0, 0)

    const transformed =
      plugin.props.transformPasted?.call(plugin, copiedSlice, {} as never, false) ?? copiedSlice
    unmount()

    expect(transformed.content.firstChild?.attrs).toMatchObject({
      valueId: copiedValueId,
      slug: 'prof_bonus',
      expressionSource: '[[other_note.prof_bonus]] + [[prof_bonus]]',
    })
    expect(unregisterPlugin).toHaveBeenCalled()
    randomUuidSpy.mockRestore()
  })
})
