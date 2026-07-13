import { useEffect, useRef, useState } from 'react'
import { Image } from 'lucide-react'
import { toast } from 'sonner'
import { FileUploadEmptyState } from '@wizard-archive/ui/file-upload/empty-state'
import type { FileUploadControl } from '@wizard-archive/ui/file-upload/control'
import type { MaybePromise } from '../../../../../shared/common/async'
import type { ResourceOperationResult } from '../../filesystem/transaction-contract'
import { useResourceReplacementController } from '../../filesystem/resource-replacement'
import { useFileDropControl } from '../../files/use-file-drop-control'

export function MapImageUpload({
  onUpload,
}: {
  onUpload: (file: File) => MaybePromise<ResourceOperationResult>
}) {
  const fileUpload = useMapImageUploadControl({
    onUpload,
  })

  return (
    <FileUploadEmptyState
      fileUpload={fileUpload}
      icon={Image}
      title="Upload Map Image"
      description="Upload an image to create your map. You can pin items to it later."
      isSubmitting={fileUpload.isUploading}
      acceptPattern="image/*"
      dragDropText="Drag an image here or click to browse"
    />
  )
}

function useMapImageUploadControl({
  onUpload,
}: {
  onUpload: (file: File) => MaybePromise<ResourceOperationResult>
}): FileUploadControl {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewUrlRef = useRef<string | null>(null)

  useEffect(() => {
    return () => revokePreviewUrl(previewUrlRef)
  }, [])

  const clearSelection = () => {
    setFile(null)
    setPreview('')
    revokePreviewUrl(previewUrlRef)
  }

  const {
    attemptReplacement: handleFileSelect,
    isReplacing: isUploading,
    rejectReplacement,
    replacementError: uploadError,
  } = useResourceReplacementController({
    disabledMessage: 'Map image uploads are disabled',
    enabled: true,
    failureMessage: 'Failed to update map',
    inProgressMessage: 'Map image upload already in progress',
    onAcceptedFile: (selectedFile) => {
      setFile(null)
      setPreview('')
      revokePreviewUrl(previewUrlRef)
      try {
        const previewUrl = URL.createObjectURL(selectedFile)
        previewUrlRef.current = previewUrl
        setFile(selectedFile)
        setPreview(previewUrl)
      } catch (error) {
        const message = 'Failed to preview map image'
        toast.error(message)
        console.error(error)
        return { valid: false, error: message }
      }
    },
    onRejectedFile: clearSelection,
    replace: onUpload,
    successMessage: 'Map image uploaded',
    timeoutMessage: 'Map image upload timed out. Please try again.',
    toastRejectedFiles: false,
    validateFile: (selectedFile) =>
      selectedFile.type.toLowerCase().startsWith('image/')
        ? { valid: true }
        : { valid: false, error: 'Only image files are allowed for maps' },
  })
  const { handleDrag, handleDrop, isDragActive } = useFileDropControl(handleFileSelect, {
    onDropRejected: rejectReplacement,
  })

  return {
    file,
    preview,
    fileMetadata: file
      ? { name: file.name, type: file.type || 'application/octet-stream', size: file.size }
      : null,
    isUploading,
    uploadError,
    isDragActive,
    uploadProgress: { percentage: 0 },
    fileInputRef,
    handleFileSelect,
    handleDrag,
    handleDrop,
  }
}

function revokePreviewUrl(previewUrlRef: { current: string | null }) {
  if (!previewUrlRef.current) return
  URL.revokeObjectURL(previewUrlRef.current)
  previewUrlRef.current = null
}
