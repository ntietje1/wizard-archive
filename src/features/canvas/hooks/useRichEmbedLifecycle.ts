import { useCallback, useEffect, useMemo, useRef } from 'react'
import { logger } from '~/shared/utils/logger'

export interface RichEmbedActivationPayload {
  point: { x: number; y: number }
}

export interface RichEmbedLifecycleController {
  pendingActivationRef: React.RefObject<RichEmbedActivationPayload | null>
}

interface UseRichEmbedActivationOptions {
  canEdit: boolean
  embedId: string
  setEditingEmbedId: (id: string | null) => void
}

interface UseRichEmbedLifecycleOptions {
  lifecycle: RichEmbedLifecycleController
  editable: boolean
  isReady: () => boolean
  onActivate: (payload: RichEmbedActivationPayload | null) => void
}

const MAX_MOUNT_RETRIES = 10

export function useRichEmbedActivation({
  canEdit,
  embedId,
  setEditingEmbedId,
}: UseRichEmbedActivationOptions) {
  const pendingActivationRef = useRef<RichEmbedActivationPayload | null>(null)
  const activateEditFrameRef = useRef<number | null>(null)

  const lifecycle = useMemo<RichEmbedLifecycleController>(() => ({ pendingActivationRef }), [])

  useEffect(() => {
    return () => {
      pendingActivationRef.current = null
      if (activateEditFrameRef.current !== null) {
        cancelAnimationFrame(activateEditFrameRef.current)
      }
    }
  }, [])

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!canEdit) return

      pendingActivationRef.current = { point: { x: e.clientX, y: e.clientY } }
      if (activateEditFrameRef.current !== null) {
        cancelAnimationFrame(activateEditFrameRef.current)
      }
      activateEditFrameRef.current = requestAnimationFrame(() => {
        activateEditFrameRef.current = null
        setEditingEmbedId(embedId)
      })
    },
    [canEdit, embedId, setEditingEmbedId],
  )

  return { lifecycle, handleDoubleClick }
}

export function useRichEmbedLifecycle({
  lifecycle,
  editable,
  isReady,
  onActivate,
}: UseRichEmbedLifecycleOptions) {
  useEffect(() => {
    if (!editable) {
      lifecycle.pendingActivationRef.current = null
    }
  }, [editable, lifecycle])

  useEffect(() => {
    if (!editable) return

    let rafId: number | null = null
    let retries = 0
    let cancelled = false

    const runLifecycle = () => {
      if (cancelled) return

      if (!isReady()) {
        retries += 1
        if (retries > MAX_MOUNT_RETRIES) {
          logger.warn('useRichEmbedLifecycle: rich embed did not become ready within retry limit')
          return
        }
        rafId = requestAnimationFrame(runLifecycle)
        return
      }

      onActivate(lifecycle.pendingActivationRef.current)
      lifecycle.pendingActivationRef.current = null
    }

    rafId = requestAnimationFrame(runLifecycle)
    return () => {
      cancelled = true
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [editable, isReady, lifecycle, onActivate])
}
