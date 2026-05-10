const SIDEBAR_ITEM_ROW_BASE_PADDING_PX = 4
const SIDEBAR_ITEM_INDENT_PX = 16

export function sidebarItemRowPaddingStyle(indentLevel: number) {
  return {
    paddingLeft: `${SIDEBAR_ITEM_ROW_BASE_PADDING_PX + indentLevel * SIDEBAR_ITEM_INDENT_PX}px`,
    paddingRight: `${SIDEBAR_ITEM_ROW_BASE_PADDING_PX}px`,
  }
}
