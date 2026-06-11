import { useRef, useState } from 'react'
import { externalEmbedTargetFromUrl } from '../utils/embed-targets'
import { useEmbedTargetOperations } from '../context/embed-target-operations'
import { handleError } from '~/shared/utils/logger'
import type { ChangeEvent } from 'react'
import type { EmbedTarget } from 'shared/embeds/embedTargets'

const EMBED_LINK_URL_ERROR = 'Use an HTTPS file URL'
const EMBED_UPLOAD_ERROR = 'Could not upload file. Please try again.'

export function useEditableEmbedTargetControls({
  setTarget,
}: {
  setTarget: (target: EmbedTarget) => Promise<void> | void
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [linkDraftOpen, setLinkDraftOpen] = useState(false)
  const [linkDraft, setLinkDraft] = useState('')
  const [linkError, setLinkError] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const { uploadFile } = useEmbedTargetOperations()

  const setTargetAndCloseDraft = async (nextTarget: EmbedTarget) => {
    await setTarget(nextTarget)
    setLinkDraftOpen(false)
    setLinkDraft('')
    setLinkError(null)
    setUploadError(null)
  }

  const handleFileInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.item(0)
    event.currentTarget.value = ''
    if (!file) return
    setUploadError(null)
    setIsUploading(true)
    try {
      const sidebarItemId = await uploadFile(file)
      if (!sidebarItemId) {
        setUploadError(EMBED_UPLOAD_ERROR)
        return
      }
      await setTargetAndCloseDraft({ kind: 'sidebarItem', sidebarItemId })
    } catch (error) {
      setUploadError(EMBED_UPLOAD_ERROR)
      handleError(error, EMBED_UPLOAD_ERROR)
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
    await setTargetAndCloseDraft(nextTarget)
  }

  return {
    fileInputRef,
    handleFileInputChange,
    isUploading,
    linkDraft,
    linkDraftOpen,
    linkError,
    openFilePicker: () => fileInputRef.current?.click(),
    openLinkDraft: () => setLinkDraftOpen(true),
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
