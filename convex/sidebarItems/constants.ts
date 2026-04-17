export const SIDEBAR_ITEM_NAME_MAX_LENGTH = 255
export const SIDEBAR_ITEM_SLUG_MAX_LENGTH = 255

export const SIDEBAR_ITEM_FORBIDDEN_NAME_CHARS = /[/\\:*?"<>[\]#|]/
export const SIDEBAR_ITEM_FORBIDDEN_NAME_CHARS_DISPLAY = '/ \\ : * ? " < > [ ] # |'

export function hasSidebarItemControlChars(value: string): boolean {
  for (const char of value) {
    const codePoint = char.codePointAt(0)
    if (
      codePoint !== undefined &&
      (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f))
    ) {
      return true
    }
  }

  return false
}
