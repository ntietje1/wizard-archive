import type { DragEvent, RefObject } from 'react'

export interface FileUploadControl {
  file: File | null
  preview: string
  fileMetadata: { name: string; type: string; size: number } | null
  isUploading: boolean
  uploadError: string
  isDragActive: boolean
  uploadProgress: { percentage: number }
  fileInputRef: RefObject<HTMLInputElement | null>
  handleFileSelect: (file: File) => unknown
  handleDrag: (event: DragEvent<HTMLDivElement>) => void
  handleDrop: (event: DragEvent<HTMLDivElement>) => void
}
