import type { DragEvent, RefObject } from 'react'

interface FileUploadMetadata {
  name: string
  type: string
  size: number
}

export interface FileUploadControl {
  file: File | null
  preview: string
  fileMetadata: FileUploadMetadata | null
  isUploading: boolean
  uploadError: string
  isDragActive: boolean
  uploadProgress: { percentage: number }
  fileInputRef: RefObject<HTMLInputElement | null>
  handleFileSelect: (file: File) => unknown
  handleDrag: (event: DragEvent<HTMLDivElement>) => void
  handleDrop: (event: DragEvent<HTMLDivElement>) => void
}
