export const FILE_CLASSIFICATION = {
  inert: 'inert_file',
  image: 'viewable_image',
  pdf: 'viewable_pdf',
  audio: 'viewable_audio',
  video: 'viewable_video',
} as const

export type FileClassification = (typeof FILE_CLASSIFICATION)[keyof typeof FILE_CLASSIFICATION]

export const FILE_VIEWER_UNAVAILABLE_REASON = {
  empty: 'empty_file',
  unsupportedFormat: 'unsupported_format',
  invalidUtf8: 'invalid_utf8',
  nulByte: 'nul_byte',
  noteSizeLimit: 'note_size_limit',
} as const

export type FileViewerUnavailableReason =
  (typeof FILE_VIEWER_UNAVAILABLE_REASON)[keyof typeof FILE_VIEWER_UNAVAILABLE_REASON]

export type FileOwnedMetadata = Readonly<{
  classification: FileClassification
  byteSize: number
  detectedFormat: string | null
  extension: string | null
  mediaType: string
  viewerUnavailableReason: FileViewerUnavailableReason | null
}>

export const EMPTY_FILE_CONTENT_METADATA = {
  classification: FILE_CLASSIFICATION.inert,
  byteSize: 0,
  detectedFormat: null,
  extension: null,
  mediaType: 'application/octet-stream',
  viewerUnavailableReason: FILE_VIEWER_UNAVAILABLE_REASON.empty,
} as const satisfies FileOwnedMetadata
