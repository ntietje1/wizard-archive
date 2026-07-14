import type { ResourceId } from '../resources/domain-id'
type PreviewUploadResult =
  | { status: 'success' }
  | { status: 'not-claimed' }
  | { status: 'stale' }
  | { status: 'error'; error: unknown }

export type PreviewUpload = (
  itemId: ResourceId,
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
