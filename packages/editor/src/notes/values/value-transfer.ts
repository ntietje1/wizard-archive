import { Fragment, Slice } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { createExtension } from '@blocknote/core'
import { generateUuidV7 } from '../../resources/domain-id'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { EditorView } from '@tiptap/pm/view'

const VALUE_NODE_TYPE = 'value'
const valueTransferPluginKey = new PluginKey('canonicalNoteValueTransfer')

export const noteValueTransferExtension = createExtension(() => ({
  key: 'canonicalNoteValueTransfer',
  prosemirrorPlugins: [createNoteValueTransferPlugin()],
}))()

function rewriteCopiedNoteValueFormula(
  expressionSource: string,
  copiedIdByOriginalId: ReadonlyMap<string, string>,
) {
  return expressionSource.replace(/\{\{([^}]+)}}/g, (reference, rawValueId: string) => {
    const copiedId = copiedIdByOriginalId.get(rawValueId.trim())
    return copiedId ? `{{${copiedId}}}` : reference
  })
}

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
  const copiedIdByOriginalId = new Map<string, string>()
  fragment.descendants((node) => {
    if (node.type.name !== VALUE_NODE_TYPE) return
    const valueId = String(node.attrs.valueId ?? '')
    if (valueId && !copiedIdByOriginalId.has(valueId)) {
      copiedIdByOriginalId.set(valueId, generateUuidV7())
    }
  })
  return copiedIdByOriginalId
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
    const originalId = String(node.attrs.valueId ?? '')
    nodes.push(
      node.type.create(
        {
          ...node.attrs,
          valueId: copiedIdByOriginalId.get(originalId) ?? generateUuidV7(),
          expressionSource: rewriteCopiedNoteValueFormula(
            String(node.attrs.expressionSource ?? ''),
            copiedIdByOriginalId,
          ),
        },
        content,
        node.marks,
      ),
    )
  })
  return Fragment.from(nodes)
}
