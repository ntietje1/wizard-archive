import { useCallback, useEffect, useRef, useState } from 'react'
import { useConvex } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { useFileUpload } from './useFileUpload'
import type { Id } from 'convex/_generated/dataModel'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export interface FileWithPreviewOptions {
  isOpen: boolean
  fileStorageId?: Id<'_storage'>
  uploadOnSelect?: boolean
  fileTypeValidator?: (file: File) => { success: boolean; error?: string }
  maxFileSize?: number
}

export type UseFileWithPreviewReturn = ReturnType<typeof useFileWithPreview>

export const useFileWithPreview = (options: FileWithPreviewOptions) => {
  const {
    isOpen,
    fileStorageId,
    uploadOnSelect = true,
    fileTypeValidator,
    maxFileSize = MAX_FILE_SIZE,
  } = options
  const convex = useConvex()
  const { uploadFile, uploadProgress, commitUpload } = useFileUpload()

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string>('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string>('')
  const [isDragActive, setIsDragActive] = useState(false)
  const [isFileRemoved, setIsFileRemoved] = useState(false)
  const [storageId, setStorageId] = useState<Id<'_storage'> | undefined>()
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen && fileStorageId && !isFileRemoved) {
      convex
        .query(api.storage.queries.getDownloadUrl, {
          storageId: fileStorageId,
        })
        .then((url) => {
          if (url) setPreview(url)
        })
        .catch(console.error)
    }
  }, [isOpen, fileStorageId, isFileRemoved, convex])

  useEffect(() => {
    if (!isOpen) {
      setIsFileRemoved(false)
      setStorageId(undefined)
    }
  }, [isOpen])

  const verifyFile = useCallback(
    (fileToVerify: File): { success: boolean; error?: string } => {
      if (fileTypeValidator) {
        return fileTypeValidator(fileToVerify)
      }

      if (fileToVerify.size > maxFileSize) {
        const maxSizeMB = maxFileSize / (1024 * 1024)
        setUploadError(`File must be less than ${maxSizeMB}MB`)
        return {
          success: false,
          error: `File must be less than ${maxSizeMB}MB`,
        }
      }
      return { success: true, error: undefined }
    },
    [fileTypeValidator, maxFileSize],
  )

  const handleUpload = useCallback(
    async (fileToUpload: File) => {
      const { error: verifyError } = verifyFile(fileToUpload)
      if (verifyError) {
        setUploadError(verifyError)
        throw new Error(verifyError)
      }
      setIsUploading(true)
      setUploadError('')

      try {
        const storageIdResult = await uploadFile.mutateAsync(fileToUpload)
        return storageIdResult
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to upload file'
        setUploadError(errorMessage)
        throw error
      } finally {
        setIsUploading(false)
      }
    },
    [verifyFile, uploadFile],
  )

  const handleFileSelect = useCallback(
    (selectedFile: File) => {
      const { error: verifyError } = verifyFile(selectedFile)
      if (verifyError) {
        setUploadError(verifyError)
        return { success: false, error: verifyError }
      }

      setFile(selectedFile)
      setUploadError('')

      const reader = new FileReader()
      reader.onload = (event: ProgressEvent<FileReader>) => {
        setPreview(event.target?.result as string)
      }
      reader.readAsDataURL(selectedFile)

      if (uploadOnSelect) {
        setIsUploading(true)
        uploadFile
          .mutateAsync(selectedFile)
          .then((uploadedStorageId) => {
            setStorageId(uploadedStorageId)
          })
          .catch((error) => {
            console.error('Failed to upload file:', error)
            setUploadError(
              error instanceof Error ? error.message : 'Upload failed',
            )
          })
          .finally(() => {
            setIsUploading(false)
          })
      }

      return { success: true }
    },
    [verifyFile, uploadOnSelect, uploadFile],
  )

  const handleDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(e.type === 'dragenter' || e.type === 'dragover')
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragActive(false)

      const files = e.dataTransfer.files
      const firstFile = files[0]
      handleFileSelect(firstFile)
    },
    [handleFileSelect],
  )

  const removeFile = useCallback(() => {
    setFile(null)
    setPreview('')
    setUploadError('')
    setIsFileRemoved(true)
    setStorageId(undefined)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const handleSubmit = useCallback(async (): Promise<Id<'_storage'>> => {
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
      const { error } = verifyFile(file)
      if (error) {
        setUploadError(error)
        throw new Error(error)
      }

      const uploadedStorageId = await handleUpload(file)
      await commitUpload.mutateAsync({ storageId: uploadedStorageId })
      setStorageId(uploadedStorageId)
      return uploadedStorageId
    }
  }, [file, handleUpload, uploadOnSelect, storageId, commitUpload, isUploading, verifyFile])

  return {
    file,
    preview,
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
