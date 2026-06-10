import { useEffect, useRef } from 'react'
import { logger } from '~/shared/utils/logger'

export interface RichEmbedActivationPayload {
  point: { x: number; y: number }
}

export type PendingRichEmbedActivationRef =
  React.MutableRefObject<RichEmbedActivationPayload | null>

interface UseDeferredRichEmbedActivationOptions {
  pendingActivationRef: PendingRichEmbedActivationRef
  editable: boolean
  isReady: () => boolean
  onActivate: (payload: RichEmbedActivationPayload | null) => void
}

const MAX_MOUNT_RETRIES = 10

export function useDeferredRichEmbedActivation({
  pendingActivationRef,
  editable,
  isReady,
  onActivate,
}: UseDeferredRichEmbedActivationOptions) {
  const isReadyRef = useRef(isReady)
  const onActivateRef = useRef(onActivate)

  useEffect(() => {
    isReadyRef.current = isReady
    onActivateRef.current = onActivate
  }, [isReady, onActivate])

  useEffect(() => {
    if (editable) {
      return
    }

    pendingActivationRef.current = null
  }, [editable, pendingActivationRef])

  useEffect(() => {
    if (!editable) {
      return
    }

    let cancelled = false
    let frameId: number | null = null
    let retries = 0

    const run = () => {
      if (cancelled) {
        return
      }

      if (!isReadyRef.current()) {
        retries += 1
        if (retries > MAX_MOUNT_RETRIES) {
          logger.warn(
            'useDeferredRichEmbedActivation: rich embed did not become ready within retry limit',
          )
          return
        }

        frameId = requestAnimationFrame(run)
        return
      }

      onActivateRef.current(pendingActivationRef.current)
      pendingActivationRef.current = null
    }

    frameId = requestAnimationFrame(run)

    return () => {
      cancelled = true

      if (frameId !== null) {
        cancelAnimationFrame(frameId)
      }
    }
  }, [editable, pendingActivationRef])
}
