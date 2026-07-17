import { useEffect } from 'react'
import type { CampaignId, ResourceId } from '../resources/domain-id'

const NOTE_SCROLL_SAVE_DELAY_MS = 150
const NOTE_SCROLL_RESTORE_FRAME_LIMIT = 60

export type NoteScrollBehavior =
  | Readonly<{ kind: 'ephemeral' }>
  | Readonly<{ kind: 'persistent'; campaignId: CampaignId; resourceId: ResourceId }>

export const EPHEMERAL_NOTE_SCROLL = { kind: 'ephemeral' } as const satisfies NoteScrollBehavior

export function useNoteScrollPersistence(
  behavior: NoteScrollBehavior,
  viewport: HTMLDivElement | null,
) {
  const campaignId = behavior.kind === 'persistent' ? behavior.campaignId : null
  const resourceId = behavior.kind === 'persistent' ? behavior.resourceId : null
  useEffect(() => {
    if (!campaignId || !resourceId || !viewport) return

    const savedPosition = loadNoteScrollTop(campaignId, resourceId)
    let restoreFrame: number | null = null
    let restoreAttempts = 0
    let restoring = savedPosition > 0
    const restorePosition = () => {
      viewport.scrollTop = savedPosition
      if (
        viewport.scrollTop === savedPosition ||
        restoreAttempts >= NOTE_SCROLL_RESTORE_FRAME_LIMIT
      ) {
        restoring = false
        return
      }
      restoreAttempts += 1
      restoreFrame = requestAnimationFrame(restorePosition)
    }
    if (restoring) restoreFrame = requestAnimationFrame(restorePosition)
    let saveTimeout: ReturnType<typeof setTimeout> | null = null
    const savePosition = () => {
      if (restoring) return
      if (saveTimeout !== null) clearTimeout(saveTimeout)
      saveTimeout = setTimeout(() => {
        saveNoteScrollTop(campaignId, resourceId, viewport.scrollTop)
      }, NOTE_SCROLL_SAVE_DELAY_MS)
    }

    viewport.addEventListener('scroll', savePosition, { passive: true })
    return () => {
      viewport.removeEventListener('scroll', savePosition)
      if (restoreFrame !== null) cancelAnimationFrame(restoreFrame)
      if (saveTimeout !== null) clearTimeout(saveTimeout)
    }
  }, [campaignId, resourceId, viewport])
}

function loadNoteScrollTop(campaignId: CampaignId, resourceId: ResourceId) {
  try {
    const stored = window.localStorage.getItem(noteScrollStorageKey(campaignId, resourceId))
    if (!stored) return 0
    const value: unknown = JSON.parse(stored)
    return typeof value === 'number' && Number.isFinite(value) ? value : 0
  } catch {
    return 0
  }
}

function saveNoteScrollTop(campaignId: CampaignId, resourceId: ResourceId, scrollTop: number) {
  try {
    window.localStorage.setItem(
      noteScrollStorageKey(campaignId, resourceId),
      JSON.stringify(scrollTop),
    )
  } catch {
    return
  }
}

function noteScrollStorageKey(campaignId: CampaignId, resourceId: ResourceId) {
  return `wizard-editor-view-state:${encodeURIComponent(campaignId)}:note-scroll:${encodeURIComponent(resourceId)}`
}
