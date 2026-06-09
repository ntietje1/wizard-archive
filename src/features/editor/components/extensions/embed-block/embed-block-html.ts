export const NOTE_EMBED_EXTERNAL_HTML_ATTRIBUTE = 'data-note-embed-external-html'

export function containsExternalEmbedBlockHtml(html: string) {
  return Boolean(
    new DOMParser()
      .parseFromString(html, 'text/html')
      .querySelector(`[${NOTE_EMBED_EXTERNAL_HTML_ATTRIBUTE}]`),
  )
}
