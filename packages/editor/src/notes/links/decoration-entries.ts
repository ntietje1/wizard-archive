import { Decoration } from '@tiptap/pm/view'

export interface BuildLinkDecorationEntriesOptions {
  isViewerMode: boolean
  isActive: boolean
}

export function appendLinkDecoration(
  decorations: Array<Decoration>,
  from: number,
  to: number,
  attrs: Record<string, string | undefined>,
) {
  if (from >= to) return
  decorations.push(Decoration.inline(from, to, attrs))
}
