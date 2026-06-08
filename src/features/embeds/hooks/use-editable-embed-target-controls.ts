import { useRef, useState } from 'react'
import { externalEmbedTargetFromUrl } from '../utils/embed-targets'
import { useEmbedUpload } from './use-embed-upload'
import type { ChangeEvent } from 'react'
import type { EmbedTarget } from 'shared/embeds/embedTargets'

export function useEditableEmbedTargetControls({
  setTarget,
}: {
  setTarget: (target: EmbedTarget) => Promise<void> | void
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [linkDraftOpen, setLinkDraftOpen] = useState(false)
  const [linkDraft, setLinkDraft] = useState('')
  const [linkError, setLinkError] = useState<string | null>(null)
  const { uploadEmbedFile } = useEmbedUpload()
  const uploadFile = async (file: globalThis.File) => {
    const result = await uploadEmbedFile(file)
    return result?.id ?? null
  }

  const setTargetAndCloseDraft = async (nextTarget: EmbedTarget) => {
    await setTarget(nextTarget)
    setLinkDraftOpen(false)
    setLinkDraft('')
    setLinkError(null)
  }

  const handleFileInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.item(0)
    event.currentTarget.value = ''
    if (!file) return
    const sidebarItemId = await uploadFile(file)
    if (sidebarItemId) await setTargetAndCloseDraft({ kind: 'sidebarItem', sidebarItemId })
  }

  const submitLinkDraft = async () => {
    const nextTarget = externalEmbedTargetFromUrl(linkDraft)
    if (!nextTarget) {
      setLinkError('Use an HTTPS file URL')
      return
    }
    await setTargetAndCloseDraft(nextTarget)
  }

  return {
    fileInputRef,
    handleFileInputChange,
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
    uploadFile,
  }
}
