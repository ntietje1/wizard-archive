import type { ContentExportResult } from './content-session-contract'

export type ContentObjectUrlState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'failed' }>
  | Exclude<ContentExportResult, { status: 'ready' }>
  | Readonly<{ status: 'ready'; url: string }>

export function beginContentObjectUrlLoad(
  load: () => ContentExportResult | Promise<ContentExportResult>,
  apply: (state: ContentObjectUrlState) => void,
): () => void {
  let active = true
  let objectUrl: string | null = null
  apply({ status: 'loading' })
  void Promise.resolve(load()).then(
    (result) => {
      if (!active) return
      if (result.status !== 'ready') {
        apply(result)
        return
      }
      objectUrl = URL.createObjectURL(
        new Blob([Uint8Array.from(result.bytes)], { type: result.mediaType }),
      )
      apply({ status: 'ready', url: objectUrl })
    },
    () => {
      if (active) apply({ status: 'failed' })
    },
  )
  return () => {
    active = false
    if (objectUrl) URL.revokeObjectURL(objectUrl)
  }
}
