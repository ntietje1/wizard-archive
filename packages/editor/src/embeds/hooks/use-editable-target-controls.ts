import { useRef, useState } from 'react'
import { externalEmbedTargetFromUrl, resourceEmbedTarget } from '../utils/targets'
import type { ChangeEvent } from 'react'
import type { EmbedTarget } from '../../../../../shared/embeds/embedTargets'
import type { EmbedTargetOperations } from '../target-operations'
import { runWithPendingEmbedUpload } from '../pending-upload'
import type { EmbedUploadSurface } from '../pending-upload'

const EMBED_LINK_URL_ERROR = 'Use an HTTPS file URL'
const EMBED_LINK_SUBMIT_ERROR = 'Could not link file. Please try again.'
const EMBED_UPLOAD_ERROR = 'Could not upload file. Please try again.'

export function useEditableEmbedTargetControls({
  setTarget,
  uploadFile,
  uploadSurface,
  embedId,
}: {
  setTarget: (target: EmbedTarget) => Promise<void> | void
  uploadFile: EmbedTargetOperations['uploadFile']
  uploadSurface: EmbedUploadSurface
  embedId: string
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [linkDraftOpen, setLinkDraftOpen] = useState(false)
  const [linkDraft, setLinkDraft] = useState('')
  const [linkError, setLinkError] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const setTargetAndCloseDraft = async (nextTarget: EmbedTarget) => {
    await setTarget(nextTarget)
    setLinkDraftOpen(false)
    setLinkDraft('')
    setLinkError(null)
    setUploadError(null)
  }

  const closeLinkDraft = () => {
    setLinkDraftOpen(false)
    setLinkDraft('')
    setLinkError(null)
  }

  const handleFileInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.item(0)
    event.currentTarget.value = ''
    if (!file || !uploadFile) return
    setUploadError(null)
    setIsUploading(true)
    try {
      await runWithPendingEmbedUpload(uploadSurface, embedId, file.name, async () => {
        const uploadResult = await uploadFile(file)
        if (uploadResult.status !== 'completed') {
          setUploadError(EMBED_UPLOAD_ERROR)
          console.error(EMBED_UPLOAD_ERROR, uploadResult)
          return
        }
        await setTargetAndCloseDraft(resourceEmbedTarget(uploadResult.itemId))
      })
    } catch (error) {
      setUploadError(EMBED_UPLOAD_ERROR)
      console.error(EMBED_UPLOAD_ERROR, error)
    } finally {
      setIsUploading(false)
    }
  }

  const submitLinkDraft = async () => {
    const nextTarget = externalEmbedTargetFromUrl(linkDraft)
    if (!nextTarget) {
      setLinkError(EMBED_LINK_URL_ERROR)
      return
    }
    try {
      await setTargetAndCloseDraft(nextTarget)
    } catch (error) {
      setLinkError(EMBED_LINK_SUBMIT_ERROR)
      console.error(EMBED_LINK_SUBMIT_ERROR, error)
    }
  }

  return {
    fileInputRef,
    handleFileInputChange,
    isUploading,
    linkDraft,
    linkDraftOpen,
    linkError,
    closeLinkDraft,
    openFilePicker: () => {
      if (isUploading || !uploadFile) return
      fileInputRef.current?.click()
    },
    openLinkDraft: () => {
      setLinkDraftOpen(true)
      setLinkError(null)
    },
    setLinkDraftValue: (value: string) => {
      setLinkDraft(value)
      setLinkError(null)
    },
    setTargetAndCloseDraft,
    submitLinkDraft,
    uploadError,
    uploadFile,
  }
}
