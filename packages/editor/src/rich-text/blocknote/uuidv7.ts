import { UniqueID, createExtension } from '@blocknote/core'
import { combineTransactionSteps, findChildrenInRange, getChangedRanges } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { generateUuidV7, isUuidV7 } from '../../resources/domain-id'

const BLOCK_ID_NODE_TYPES = new Set(['blockContainer', 'columnList', 'column'])

export function createBlockNoteUuidV7Extension(setIdAttribute: boolean) {
  return createExtension({
    key: 'canonicalBlockIdentity',
    tiptapExtensions: [
      UniqueID.configure({
        types: [...BLOCK_ID_NODE_TYPES],
        generateID: generateUuidV7,
        setIdAttribute,
      }),
    ],
    prosemirrorPlugins: [canonicalBlockIdentityPlugin()],
  })
}

function canonicalBlockIdentityPlugin() {
  return new Plugin({
    appendTransaction: (transactions, _oldState, newState) => {
      if (!transactions.some((transaction) => transaction.docChanged)) return null
      const transaction = newState.tr
      const changes = combineTransactionSteps(_oldState.doc, [...transactions])
      for (const { newRange } of getChangedRanges(changes)) {
        for (const { node, pos } of findChildrenInRange(newState.doc, newRange, (candidate) =>
          BLOCK_ID_NODE_TYPES.has(candidate.type.name),
        )) {
          if (isUuidV7(node.attrs.id)) continue
          transaction.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            id: generateUuidV7(),
          })
        }
      }
      if (transaction.steps.length === 0) return null
      return transaction.setMeta('addToHistory', false)
    },
  })
}
