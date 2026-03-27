import { useEffect, useRef, useState } from 'react'
import { useConvex } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { MAX_FILE_SIZE } from 'convex/storage/validation'
import { useFileUpload } from './useFileUpload'
import type { Id } from 'convex/_generated/dataModel'
import { logger } from '~/shared/utils/logger'

export interface FileWithPreviewOptions {
  isOpen: boolean
  fileStorageId?: Id<'_storage'>
  uploadOnSelect?: boolean
  fileTypeValidator?: (
    file: File,
  ) => { valid: true } | { valid: false; error: string }
  maxFileSize?: number
  onUploadComplete?: (storageId: Id<'_storage'>) => void | Promise<void>
}

export interface FileMetadata {
  name: string
  type: string
  size: number
}

export type UseFileWithPreviewReturn = ReturnType<typeof useFileWithPreview>

function getFileType(
  file: File,
): 'image' | 'pdf' | 'video' | 'audio' | 'other' {
  const mimeType = file.type.toLowerCase()
  const fileName = file.name.toLowerCase()

  if (
    mimeType.startsWith('image/') ||
    /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(fileName)
  ) {
    return 'image'
  }
  if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
    return 'pdf'
  }
  if (
    mimeType.startsWith('video/') ||
    /\.(mp4|webm|ogg|mov|avi|wmv|flv)$/i.test(fileName)
  ) {
    return 'video'
  }
  if (
    mimeType.startsWith('audio/') ||
    /\.(mp3|wav|ogg|aac|flac|m4a)$/i.test(fileName)
  ) {
    return 'audio'
  }
  return 'other'
}

export const useFileWithPreview = (options: FileWithPreviewOptions) => {
  const {
    isOpen,
    fileStorageId,
    uploadOnSelect = true,
    fileTypeValidator,
    maxFileSize = MAX_FILE_SIZE,
    onUploadComplete,
  } = options
  const convex = useConvex()
  const { uploadFile, uploadProgress, commitUpload } = useFileUpload()

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string>('')
  const [fileMetadata, setFileMetadata] = useState<FileMetadata | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string>('')
  const [isDragActive, setIsDragActive] = useState(false)
  const [isFileRemoved, setIsFileRemoved] = useState(false)
  const [storageId, setStorageId] = useState<Id<'_storage'> | undefined>()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const objectUrlRef = useRef<string | null>(null)

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (isOpen && fileStorageId && !isFileRemoved) {
      convex
        .query(api.storage.queries.getDownloadUrl, {
          storageId: fileStorageId,
        })
        .then((url) => {
          if (url) {
            setPreview(url)
            // Try to get metadata if available
            convex
              .query(api.storage.queries.getStorageMetadata, {
                storageId: fileStorageId,
              })
              .then((metadata) => {
                if (metadata) {
                  setFileMetadata({
                    name: metadata.originalFileName || 'File',
                    type: metadata.contentType || 'application/octet-stream',
                    size: metadata.size || 0,
                  })
                }
              })
              .catch(() => {
                // Metadata not available, that's okay
              })
          }
        })
        .catch((error) => logger.error(error))
    }
  }, [isOpen, fileStorageId, isFileRemoved, convex])

  useEffect(() => {
    if (!isOpen) {
      setIsFileRemoved(false)
      setStorageId(undefined)
      setPreview('')
      setFileMetadata(null)
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [isOpen])

  const verifyFile = (
    fileToVerify: File,
  ): { valid: true } | { valid: false; error: string } => {
    if (fileTypeValidator) {
      return fileTypeValidator(fileToVerify)
    }

    if (fileToVerify.size > maxFileSize) {
      const maxSizeMB = maxFileSize / (1024 * 1024)
      return {
        valid: false,
        error: `File must be less than ${maxSizeMB}MB`,
      }
    }
    return { valid: true }
  }

  // assumes file is already validated
  const handleUpload = async (fileToUpload: File) => {
    setIsUploading(true)
    setUploadError('')

    try {
      const storageIdResult = await uploadFile.mutateAsync(fileToUpload)
      return storageIdResult
    } catch (error) {
      logger.error(error)
      setUploadError(
        error instanceof Error ? error.message : 'Failed to upload file',
      )
      throw error
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileSelect = (selectedFile: File) => {
    const result = verifyFile(selectedFile)
    if (!result.valid) {
      setUploadError(result.error)
      return { valid: false, error: result.error }
    }

    setFile(selectedFile)
    setUploadError('')

    // Store file metadata
    setFileMetadata({
      name: selectedFile.name,
      type: selectedFile.type || 'application/octet-stream',
      size: selectedFile.size,
    })

    // Clean up previous object URL
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }

    // Create preview based on file type
    const fileType = getFileType(selectedFile)
    if (fileType === 'image') {
      // Use data URL for images (works well for previews)
      const reader = new FileReader()
      reader.onload = (event: ProgressEvent<FileReader>) => {
        setPreview(event.target?.result as string)
      }
      reader.readAsDataURL(selectedFile)
    } else {
      // Use object URL for videos, audio, PDFs, and other files
      const objectUrl = URL.createObjectURL(selectedFile)
      objectUrlRef.current = objectUrl
      setPreview(objectUrl)
    }

    if (uploadOnSelect) {
      setIsUploading(true)
      uploadFile
        .mutateAsync(selectedFile)
        .then(async (uploadedStorageId) => {
          setStorageId(uploadedStorageId)
          if (onUploadComplete) {
            await commitUpload.mutateAsync({ storageId: uploadedStorageId })
            await onUploadComplete(uploadedStorageId)
          }
          setIsUploading(false)
        })
        .catch((error) => {
          logger.error(error)
          setUploadError(
            error instanceof Error ? error.message : 'Upload failed',
          )
          setIsUploading(false)
        })
    }

    return { success: true }
  }

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(e.type === 'dragenter' || e.type === 'dragover')
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      const firstFile = files[0]
      handleFileSelect(firstFile)
    }
  }

  const removeFile = () => {
    setFile(null)
    setPreview('')
    setFileMetadata(null)
    setUploadError('')
    setIsFileRemoved(true)
    setStorageId(undefined)
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (): Promise<Id<'_storage'>> => {
    if (uploadOnSelect) {
      // File should already have been uploaded, just commit
      if (isUploading) {
        throw new Error('File is still uploading, please wait')
      }
      if (!storageId) {
        throw new Error('No file uploaded')
      }
      await commitUpload.mutateAsync({ storageId })
      return storageId
    } else {
      // Upload + commit
      if (!file) {
        throw new Error('No file selected')
      }
      const result = verifyFile(file)
      if (!result.valid) {
        setUploadError(result.error)
        throw new Error(result.error)
      }

      const uploadedStorageId = await handleUpload(file)
      await commitUpload.mutateAsync({ storageId: uploadedStorageId })
      setStorageId(uploadedStorageId)
      return uploadedStorageId
    }
  }

  return {
    file,
    preview,
    fileMetadata,
    isUploading,
    uploadError,
    isDragActive,
    uploadProgress,
    removed: isFileRemoved,

    fileInputRef,

    handleFileSelect,
    handleDrag,
    handleDrop,
    removeFile,
    handleSubmit,
  }
}
