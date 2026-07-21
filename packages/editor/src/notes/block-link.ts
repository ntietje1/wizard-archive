import type { NoteBlockId, ResourceId } from '../resources/domain-id'

type BlockLinkReport = (message: string, retry?: () => void) => void

export async function copyNoteBlockLink(
  noteId: ResourceId,
  blockId: NoteBlockId,
  report: BlockLinkReport | null,
) {
  if (!globalThis.navigator?.clipboard) {
    report?.('Copy block link is unavailable')
    return
  }

  const url = new URL(globalThis.location?.href ?? 'https://wizard-archive.invalid/')
  url.hash = ''
  url.search = ''
  url.searchParams.set('resource', noteId)
  url.searchParams.set('target', 'noteBlock')
  url.searchParams.set('targetId', blockId)
  url.searchParams.set('presentation', 'block')

  try {
    await navigator.clipboard.writeText(url.href)
    report?.('Block link copied')
  } catch {
    report?.('Failed to copy block link', () => {
      void copyNoteBlockLink(noteId, blockId, report)
    })
  }
}
