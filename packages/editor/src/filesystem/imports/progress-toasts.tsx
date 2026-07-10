export interface UploadProgress {
  toastId: string | number
  totalFiles: number
  totalFolders: number
  processedFiles: number
  processedFolders: number
  skippedFiles: number
}
