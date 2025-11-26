import { filterSuggestionItems } from '@blocknote/core'
import {
  type DefaultReactSuggestionItem,
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
} from '@blocknote/react'
import type { CustomBlockNoteEditor } from '~/lib/editor-schema'

// // Custom Slash Menu item to insert a block after the current one.
// const insertHelloWorldItem = (editor: CustomBlockNoteEditor) => ({
//   title: "Insert Hello World",
//   onItemClick: () =>
//     // If the block containing the text caret is empty, `insertOrUpdateBlock`
//     // changes its type to the provided block. Otherwise, it inserts the new
//     // block below and moves the text caret to it. We use this function with
//     // a block containing 'Hello World' in bold.
//     insertOrUpdateBlock(editor, {
//       type: "paragraph",
//       content: [{ type: "text", text: "Hello World", styles: { bold: true } }],
//     }),
//   aliases: ["helloworld", "hw"],
//   group: "Other",
//   icon: <Globe size={18} />,
//   subtext: "Used to insert a block with 'Hello World' below.",
// });

// List containing all default Slash Menu Items, as well as our custom one.
const getCustomSlashMenuItems = (
  editor: CustomBlockNoteEditor,
): Array<DefaultReactSuggestionItem> => [
  ...getDefaultReactSlashMenuItems(editor),
  // .filter((item) => {
  //     return item.title !== "Heading 2"
  // }),
  // insertHelloWorldItem(editor),
]

export const SlashMenu = ({ editor }: { editor: CustomBlockNoteEditor }) => {
  return (
    <SuggestionMenuController
      triggerCharacter={'/'}
      // Replaces the default Slash Menu items with our custom ones.
      getItems={async (query) =>
        filterSuggestionItems(getCustomSlashMenuItems(editor), query)
      }
    />
  )
}
