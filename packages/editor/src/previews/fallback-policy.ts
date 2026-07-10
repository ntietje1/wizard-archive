type PreviewFallbackSurface = 'embed' | 'history' | 'search'

export type PreviewFallbackReason =
  | 'corruptedSnapshot'
  | 'loadError'
  | 'loading'
  | 'mapImageError'
  | 'mapImageLoading'
  | 'missing'
  | 'noMapImage'
  | 'noPreview'
  | 'permission'
  | 'recursive'
  | 'selectResult'
  | 'trashed'
  | 'unavailableContentProvider'
  | 'unavailableVersion'
  | 'unsupportedExternalUrl'
  | 'unsupportedFileType'
  | 'unsupportedSnapshot'

type ResourceUnavailableStatus = 'error' | 'not_found' | 'not_shared' | 'trashed'

const FALLBACK_COPY = {
  embed: {
    missing: 'Embedded item unavailable',
    permission: "This embedded item isn't shared with you",
    recursive: 'Recursive embed hidden',
    trashed: 'Embedded item is in the trash',
    unsupportedExternalUrl: 'External file link is invalid',
    unsupportedFileType: 'This file type cannot be previewed',
    unavailableContentProvider: 'Embedded content is unavailable in this view',
  },
  history: {
    corruptedSnapshot: 'Snapshot data is corrupted.',
    loadError: 'Failed to load history preview.',
    mapImageError: 'Failed to load map image.',
    mapImageLoading: 'Loading map image.',
    noMapImage: 'No map image in this version.',
    unavailableVersion: 'Preview not available for this version.',
    unsupportedSnapshot: 'Preview not available for this snapshot type.',
  },
  search: {
    loadError: 'Failed to load preview. You can still open this result.',
    loading: 'Loading preview…',
    noPreview: 'No preview available',
    selectResult: 'Select a result to preview',
  },
} satisfies Record<PreviewFallbackSurface, Partial<Record<PreviewFallbackReason, string>>>

export function getPreviewFallbackCopy({
  reason,
  surface,
}: {
  reason: PreviewFallbackReason
  surface: PreviewFallbackSurface
}): string {
  const surfaceCopy: Partial<Record<PreviewFallbackReason, string>> = FALLBACK_COPY[surface]
  const copy = surfaceCopy[reason]
  if (copy === undefined) {
    throw new Error(`Missing ${surface} preview fallback copy for "${reason}"`)
  }
  return copy
}

export function getResourceUnavailableFallbackReason(
  status: ResourceUnavailableStatus,
): Extract<PreviewFallbackReason, 'missing' | 'permission' | 'trashed'> {
  if (status === 'not_shared') return 'permission'
  if (status === 'trashed') return 'trashed'
  return 'missing'
}
