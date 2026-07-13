import { useSyncExternalStore } from 'react'

export type EmbedUploadSurface = 'canvas' | 'note'

type PendingEmbedUpload = {
  fileName: string
  token: symbol
}

const pendingUploads = new Map<string, PendingEmbedUpload>()
const listeners = new Set<() => void>()

export async function runWithPendingEmbedUpload<T>(
  surface: EmbedUploadSurface,
  embedId: string,
  fileName: string,
  operation: () => Promise<T>,
): Promise<T> {
  const finishPendingUpload = beginPendingEmbedUpload(surface, embedId, fileName)
  const pendingUploadPainted = waitForPendingUploadPaint()
  try {
    return await operation()
  } finally {
    await pendingUploadPainted
    finishPendingUpload()
  }
}

function beginPendingEmbedUpload(surface: EmbedUploadSurface, embedId: string, fileName: string) {
  const key = getPendingEmbedUploadKey(surface, embedId)
  const upload = { fileName, token: Symbol(key) }
  pendingUploads.set(key, upload)
  emitChange()

  return () => {
    if (pendingUploads.get(key)?.token !== upload.token) return
    pendingUploads.delete(key)
    emitChange()
  }
}

export function usePendingEmbedUpload(surface: EmbedUploadSurface, embedId: string) {
  const key = getPendingEmbedUploadKey(surface, embedId)
  return useSyncExternalStore(subscribe, () => pendingUploads.get(key) ?? null, getServerSnapshot)
}

function getPendingEmbedUploadKey(surface: EmbedUploadSurface, embedId: string) {
  return `${surface}:${embedId}`
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getServerSnapshot() {
  return null
}

function emitChange() {
  for (const listener of listeners) listener()
}

function waitForPendingUploadPaint() {
  if (typeof requestAnimationFrame !== 'function') return Promise.resolve()

  // Two frames let pending UI paint; the timeout bounds background-tab frame suppression.
  return new Promise<void>((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(fallback)
      resolve()
    }
    const fallback = setTimeout(finish, 100)
    requestAnimationFrame(() => requestAnimationFrame(finish))
  })
}
