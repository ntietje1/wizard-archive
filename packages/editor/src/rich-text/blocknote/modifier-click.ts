import { createExtension } from '@blocknote/core'
import { Plugin } from '@tiptap/pm/state'

export function createBlockNoteModifierClickSuppressionExtension() {
  return createExtension({
    key: 'suppressModifierClick',
    prosemirrorPlugins: [
      new Plugin({
        props: {
          handleDOMEvents: {
            mousedown: (_view, event) =>
              event instanceof MouseEvent && event.button === 0 && (event.ctrlKey || event.metaKey),
          },
        },
      }),
    ],
  })
}
