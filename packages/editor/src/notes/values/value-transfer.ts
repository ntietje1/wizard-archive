import { Fragment, Slice } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { createExtension } from '@blocknote/core'
import { copyNoteValueProps, createCopiedNoteValueIdMap } from './value-copy'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { EditorView } from '@tiptap/pm/view'

const VALUE_NODE_TYPE = 'value'
const valueTransferPluginKey = new PluginKey('canonicalNoteValueTransfer')

export const noteValueTransferExtension = createExtension(() => ({
  key: 'canonicalNoteValueTransfer',
  prosemirrorPlugins: [createNoteValueTransferPlugin()],
}))()

function createNoteValueTransferPlugin() {
  return new Plugin({
    key: valueTransferPluginKey,
    props: {
      transformPasted: (slice, view) => (isInternalMove(view) ? slice : copyNoteValues(slice)),
    },
  })
}

function isInternalMove(view: EditorView) {
  return view.dragging?.move === true
}

function copyNoteValues(slice: Slice) {
  const copiedIdByOriginalId = collectCopiedIds(slice.content)
  if (copiedIdByOriginalId.size === 0) return slice
  return new Slice(
    rewriteCopiedValues(slice.content, copiedIdByOriginalId),
    slice.openStart,
    slice.openEnd,
  )
}

function collectCopiedIds(fragment: Fragment) {
  const originalValueIds: Array<string> = []
  fragment.descendants((node) => {
    if (node.type.name !== VALUE_NODE_TYPE) return
    const valueId = String(node.attrs.valueId ?? '')
    if (valueId) originalValueIds.push(valueId)
  })
  return createCopiedNoteValueIdMap(originalValueIds)
}

function rewriteCopiedValues(
  fragment: Fragment,
  copiedIdByOriginalId: ReadonlyMap<string, string>,
): Fragment {
  const nodes: Array<ProseMirrorNode> = []
  fragment.forEach((node) => {
    if (node.isText) {
      nodes.push(node)
      return
    }
    const content = rewriteCopiedValues(node.content, copiedIdByOriginalId)
    if (node.type.name !== VALUE_NODE_TYPE) {
      nodes.push(content === node.content ? node : node.copy(content))
      return
    }
    const copiedProps = copyNoteValueProps(
      {
        valueId: String(node.attrs.valueId ?? ''),
        label: String(node.attrs.label ?? ''),
        expressionSource: String(node.attrs.expressionSource ?? ''),
      },
      copiedIdByOriginalId,
    )
    nodes.push(
      node.type.create(
        {
          ...node.attrs,
          ...copiedProps,
        },
        content,
        node.marks,
      ),
    )
  })
  return Fragment.from(nodes)
}
