import { useEffect, useRef } from 'react'
import { Fragment, Slice } from '@tiptap/pm/model'
import { NodeSelection, Plugin, PluginKey, Selection, TextSelection } from '@tiptap/pm/state'
import { dropPoint } from '@tiptap/pm/transform'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { SelectionBookmark } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { rewriteSameNoteValueReferences } from '../../../../shared/note-values/authoring'
import { getUniqueValueSlug, sanitizeValueSlug } from '../../../../shared/note-values/constants'

const VALUE_NODE_TYPE = 'value'
const VALUE_ID_ATTR = 'valueId'
const VALUE_SLUG_ATTR = 'slug'
const VALUE_EXPRESSION_ATTR = 'expressionSource'

const valueTransferPluginKey = new PluginKey('valueTransfer')

type PendingValueMove = {
  selection: SelectionBookmark
  slice: Slice
}

interface ValuePastePluginOptions {
  createId?: () => string
  getExistingSlugs?: () => Iterable<string>
}

interface TiptapEditorLike {
  view: EditorView | undefined
  registerPlugin: (
    plugin: Plugin,
    handlePlugins?: (newPlugin: Plugin, plugins: Array<Plugin>) => Array<Plugin>,
  ) => void
}

export function createValueTransferPlugin({
  createId = () => crypto.randomUUID(),
  getExistingSlugs = () => [],
}: ValuePastePluginOptions = {}) {
  let pendingValueMove: PendingValueMove | null = null

  const clearPendingValueMove = () => {
    pendingValueMove = null
  }

  return new Plugin({
    key: valueTransferPluginKey,
    state: {
      init: () => null,
      apply: (_tr, value) => value,
    },
    view: (view) => {
      const handleDragStart = (event: DragEvent) => {
        pendingValueMove = getPendingValueMove(view, event)
      }
      const handleDragEnd = () => {
        clearPendingValueMove()
      }
      const handleDrop = (event: DragEvent) => {
        if (!pendingValueMove || isCopyDrop(event)) {
          clearPendingValueMove()
          return
        }

        if (movePendingValueSelection(view, event, pendingValueMove)) {
          event.stopPropagation()
        }
        clearPendingValueMove()
      }

      view.dom.addEventListener('dragstart', handleDragStart, true)
      view.dom.addEventListener('dragend', handleDragEnd, true)
      view.dom.addEventListener('drop', handleDrop, true)
      return {
        destroy: () => {
          view.dom.removeEventListener('dragstart', handleDragStart, true)
          view.dom.removeEventListener('dragend', handleDragEnd, true)
          view.dom.removeEventListener('drop', handleDrop, true)
        },
      }
    },
    props: {
      transformPasted: (slice, view) => {
        if (isInternalMoveDrag(view)) return slice
        return refreshValueInstancesInSlice(slice, createId, getExistingSlugs)
      },
    },
  })
}

function isInternalMoveDrag(view: EditorView) {
  const dragging = (view as EditorView & { dragging?: { move?: boolean; slice?: Slice } | null })
    .dragging
  return dragging?.move === true
}

export function useValueTransferBehavior(
  editor: { _tiptapEditor?: TiptapEditorLike },
  enabled: boolean,
  getExistingSlugs: () => Iterable<string> = () => [],
) {
  const getExistingSlugsRef = useRef(getExistingSlugs)
  getExistingSlugsRef.current = getExistingSlugs

  useEffect(() => {
    if (!enabled) return
    return registerValueTransferPlugin(
      () => editor._tiptapEditor,
      () => getExistingSlugsRef.current(),
    )
  }, [editor, enabled])
}

function refreshValueInstancesInSlice(
  slice: Slice,
  createId: () => string,
  getExistingSlugs: () => Iterable<string>,
) {
  const usedSlugs = new Set(getExistingSlugs())
  const copiedSlugs = collectCopiedValueSlugs(slice.content, usedSlugs)
  const refreshed = refreshValueInstancesInFragment(slice.content, createId, copiedSlugs)
  return refreshed === slice.content ? slice : new Slice(refreshed, slice.openStart, slice.openEnd)
}

function sliceContainsValue(slice: Slice) {
  let containsValue = false
  slice.content.descendants((node) => {
    if (node.type.name === VALUE_NODE_TYPE) {
      containsValue = true
      return false
    }
    return !containsValue
  })
  return containsValue
}

function getPendingValueMove(view: EditorView, event: DragEvent): PendingValueMove | null {
  const selection = getDomSelection(view) ?? getTargetValueSelection(view, event.target)
  if (!selection || selection.empty) return null

  const slice = selection.content()
  if (!sliceContainsValue(slice)) return null

  return {
    selection: selection.getBookmark(),
    slice,
  }
}

function getTargetValueSelection(view: EditorView, target: EventTarget | null): Selection | null {
  if (!(target instanceof Element)) return null

  const valueElement = target.closest<HTMLElement>('[data-note-value-id]')
  const valueId = valueElement?.dataset.noteValueId
  if (!valueId) return null

  let selection: Selection | null = null
  view.state.doc.descendants((node, pos) => {
    if (node.type.name === VALUE_NODE_TYPE && node.attrs[VALUE_ID_ATTR] === valueId) {
      selection = NodeSelection.create(view.state.doc, pos)
      return false
    }
    return true
  })
  return selection
}

function getDomSelection(view: EditorView): Selection | null {
  const domSelection = view.dom.ownerDocument.getSelection()
  if (!domSelection || domSelection.rangeCount === 0) return null

  const range = domSelection.getRangeAt(0)
  if (range.collapsed || !view.dom.contains(range.commonAncestorContainer)) return null

  try {
    const start = view.posAtDOM(range.startContainer, range.startOffset)
    const end = view.posAtDOM(range.endContainer, range.endOffset)
    const from = Math.min(start, end)
    const to = Math.max(start, end)
    if (from === to) return null
    return TextSelection.between(view.state.doc.resolve(from), view.state.doc.resolve(to))
  } catch {
    return null
  }
}

function isCopyDrop(event: DragEvent) {
  return event.ctrlKey || event.altKey
}

function movePendingValueSelection(
  view: EditorView,
  event: DragEvent,
  pendingMove: PendingValueMove,
) {
  const eventPos = view.posAtCoords({
    left: event.clientX,
    top: event.clientY,
  })
  if (!eventPos) return false

  const selection = pendingMove.selection.resolve(view.state.doc)
  if (selection.empty) return false

  const insertPos = dropPoint(view.state.doc, eventPos.pos, pendingMove.slice) ?? eventPos.pos
  let tr = view.state.tr.setSelection(selection).deleteSelection()
  const mappedInsertPos = tr.mapping.map(insertPos)
  const beforeInsert = tr.doc
  tr = tr.replaceRange(mappedInsertPos, mappedInsertPos, pendingMove.slice)
  if (tr.doc.eq(beforeInsert)) return false

  const selectionPos = Math.min(mappedInsertPos + pendingMove.slice.size, tr.doc.content.size)
  tr = tr.setSelection(Selection.near(tr.doc.resolve(selectionPos))).setMeta('uiEvent', 'drop')
  event.preventDefault()
  view.focus()
  view.dispatch(tr)
  return true
}

function refreshValueInstancesInFragment(
  fragment: Fragment,
  createId: () => string,
  copiedSlugs: CopiedValueSlugs,
): Fragment {
  const nodes: Array<ProseMirrorNode> = []
  let changed = false
  fragment.forEach((node) => {
    if (node.isText) {
      nodes.push(node)
      return
    }

    const content = refreshValueInstancesInFragment(node.content, createId, copiedSlugs)
    if (node.type.name !== VALUE_NODE_TYPE) {
      nodes.push(content === node.content ? node : node.copy(content))
      changed ||= content !== node.content
      return
    }

    const slug = sanitizeValueSlug(node.attrs[VALUE_SLUG_ATTR])
    const valueId = String(node.attrs[VALUE_ID_ATTR] ?? '')
    const nextSlug = copiedSlugs.byValueId.get(valueId) ?? slug
    const expressionSource = String(node.attrs[VALUE_EXPRESSION_ATTR] ?? '')
    changed = true
    nodes.push(
      node.type.create(
        {
          ...node.attrs,
          [VALUE_ID_ATTR]: createId(),
          [VALUE_SLUG_ATTR]: nextSlug,
          [VALUE_EXPRESSION_ATTR]: rewriteSameNoteValueReferences(
            expressionSource,
            copiedSlugs.byReferencedSlug,
          ),
        },
        content,
        node.marks,
      ),
    )
  })
  return changed ? Fragment.from(nodes) : fragment
}

interface CopiedValueSlugs {
  byValueId: Map<string, string>
  byReferencedSlug: Map<string, string>
}

function collectCopiedValueSlugs(
  fragment: Fragment,
  usedSlugs: Set<string>,
  copiedSlugs: CopiedValueSlugs = {
    byValueId: new Map(),
    byReferencedSlug: new Map(),
  },
): CopiedValueSlugs {
  fragment.forEach((node) => {
    if (node.isText) return

    if (node.type.name === VALUE_NODE_TYPE) {
      const valueId = String(node.attrs[VALUE_ID_ATTR] ?? '')
      const slug = sanitizeValueSlug(node.attrs[VALUE_SLUG_ATTR])
      const nextSlug = getUniqueValueSlug(slug, usedSlugs)
      usedSlugs.add(nextSlug)
      copiedSlugs.byValueId.set(valueId, nextSlug)
      if (!copiedSlugs.byReferencedSlug.has(slug)) {
        copiedSlugs.byReferencedSlug.set(slug, nextSlug)
      }
    }

    collectCopiedValueSlugs(node.content, usedSlugs, copiedSlugs)
  })
  return copiedSlugs
}

function registerValueTransferPlugin(
  getTiptapEditor: () => TiptapEditorLike | undefined,
  getExistingSlugs: () => Iterable<string>,
): () => void {
  let cancelled = false
  let frameId: number | null = null

  const registerWhenReady = () => {
    if (cancelled) return
    const tiptapEditor = getTiptapEditor()
    if (!tiptapEditor) {
      if (!cancelled) frameId = requestAnimationFrame(registerWhenReady)
      return
    }
    const view = getMountedEditorView(tiptapEditor)
    if (!view) {
      if (!cancelled) frameId = requestAnimationFrame(registerWhenReady)
      return
    }
    if (cancelled || valueTransferPluginKey.getState(view.state) !== undefined) {
      return
    }

    tiptapEditor.registerPlugin(
      createValueTransferPlugin({ getExistingSlugs }),
      replaceValueTransferPlugin,
    )
  }

  frameId = requestAnimationFrame(registerWhenReady)
  return () => {
    cancelled = true
    if (frameId !== null) {
      cancelAnimationFrame(frameId)
    }
  }
}

function replaceValueTransferPlugin(newPlugin: Plugin, plugins: Array<Plugin>): Array<Plugin> {
  const pluginKeyName = (valueTransferPluginKey as unknown as { key: string }).key
  return [
    ...plugins.filter(
      (plugin) => !String((plugin as { key?: unknown }).key).startsWith(pluginKeyName),
    ),
    newPlugin,
  ]
}

function getMountedEditorView(tiptapEditor: TiptapEditorLike) {
  try {
    const view = tiptapEditor.view
    if (!view) return undefined
    void view.dom
    return view
  } catch {
    return undefined
  }
}
