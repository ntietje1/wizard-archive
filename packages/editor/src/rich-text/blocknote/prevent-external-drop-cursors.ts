export function removeProseMirrorDropCursors(root: Element) {
  root
    .querySelectorAll('.prosemirror-dropcursor-block, .prosemirror-dropcursor-inline')
    .forEach((element) => element.remove())
}
