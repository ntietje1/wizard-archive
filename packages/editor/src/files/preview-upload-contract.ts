import type { SidebarItemId } from '../../../../shared/common/ids'

type PreviewUploadResult =
  | { status: 'success' }
  | { status: 'not-claimed' }
  | { status: 'stale' }
  | { status: 'error'; error: unknown }

export type PreviewUpload = (
  itemId: SidebarItemId,
  generate: () => Promise<Blob>,
  options?: { signal?: AbortSignal },
) => Promise<PreviewUploadResult>

export type PreviewUploadCapability =
  | {
      status: 'available'
      upload: PreviewUpload
    }
  | {
      status: 'unsupported'
    }
