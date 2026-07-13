import { useEffect, useRef, useState } from 'react'
import { MAX_FILE_SIZE } from 'shared/storage/validation'
import type { FileUploadControl } from '@wizard-archive/ui/file-upload/control'
import { useFileDropControl } from '../use-file-drop-control'

interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

interface FileMetadata {
  name: string
  type: string
  size: number
}

interface FileUploadControlOptions {
  existingContentType?: string | null
  existingName?: string | null
  existingPreviewUrl?: string | null
  existingSize?: number | null
  fileTypeValidator?: (file: File) => { valid: true } | { valid: false; error: string }
  isOpen: boolean
  maxFileSize?: number
}

export function useFileUploadControl({
  existingContentType,
  existingName,
  existingPreviewUrl,
  existingSize,
  fileTypeValidator,
  isOpen,
  maxFileSize = MAX_FILE_SIZE,
}: FileUploadControlOptions): FileUploadControl {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string>('')
  const [fileMetadata, setFileMetadata] = useState<FileMetadata | null>(null)
  const [uploadError, setUploadError] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const objectUrlRef = useRef<string | null>(null)
  const selectedFileRef = useRef<File | null>(null)

  const revokeCurrentObjectUrl = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }

  useEffect(() => {
    return revokeCurrentObjectUrl
  }, [])

  useEffect(() => {
    if (!isOpen || !existingName || selectedFileRef.current) return

    setPreview(existingPreviewUrl ?? '')
    setFileMetadata({
      name: existingName,
      type: existingContentType || 'application/octet-stream',
      size: existingSize || 0,
    })
  }, [existingContentType, existingName, existingPreviewUrl, existingSize, isOpen])

  useEffect(() => {
    if (isOpen) return

    selectedFileRef.current = null
    setFile(null)
    setPreview('')
    setFileMetadata(null)
    setUploadError('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    revokeCurrentObjectUrl()
  }, [isOpen])

  const verifyFile = (fileToVerify: File): { valid: true } | { valid: false; error: string } => {
    if (fileToVerify.size > maxFileSize) {
      return {
        valid: false,
        error: `File must be at most ${formatMaxFileSizeMB(maxFileSize)}MB`,
      }
    }

    if (fileTypeValidator) {
      return fileTypeValidator(fileToVerify)
    }

    return { valid: true }
  }

  const handleFileSelect = (selectedFile: File) => {
    const result = verifyFile(selectedFile)
    if (!result.valid) {
      selectedFileRef.current = null
      setFile(null)
      setPreview('')
      setFileMetadata(null)
      setUploadError(result.error)
      revokeCurrentObjectUrl()
      return { valid: false, error: result.error }
    }

    selectedFileRef.current = selectedFile
    setFile(selectedFile)
    setUploadError('')
    setFileMetadata({
      name: selectedFile.name,
      type: selectedFile.type || 'application/octet-stream',
      size: selectedFile.size,
    })

    revokeCurrentObjectUrl()
    const objectUrl = URL.createObjectURL(selectedFile)
    objectUrlRef.current = objectUrl
    setPreview(objectUrl)

    return { valid: true }
  }

  const { handleDrag, handleDrop, isDragActive } = useFileDropControl(handleFileSelect, {
    onDropRejected: setUploadError,
  })

  return {
    file,
    fileInputRef,
    fileMetadata,
    handleDrag,
    handleDrop,
    handleFileSelect,
    isDragActive,
    isUploading: false,
    preview,
    uploadError,
    uploadProgress: emptyUploadProgress,
  }
}

const emptyUploadProgress: UploadProgress = {
  loaded: 0,
  total: 0,
  percentage: 0,
}

function formatMaxFileSizeMB(maxFileSize: number) {
  const maxSizeMB = maxFileSize / (1024 * 1024)
  if (maxSizeMB >= 1) {
    return maxSizeMB.toFixed(1).replace(/\.0$/, '')
  }
  return maxSizeMB.toPrecision(2)
}
