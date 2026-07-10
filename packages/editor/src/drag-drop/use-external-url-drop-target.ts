import { useEffect, useRef, useState } from 'react'
import { useDndDropPayloadDispatcher, useDndRuntimeDropData } from './context'
import { classifyExternalUrlDrop } from './external-url-drop'
import { handleError } from '../errors/handle-error'
import { isBlockedExternalDropEvent } from './external-drop-blocked-target'

export function useExternalUrlDropTarget({
  data,
  enabled,
  blockedTargetSelector,
}: {
  data: Record<string, unknown>
  enabled: boolean
  blockedTargetSelector?: string
}) {
  const scopedData = useDndRuntimeDropData(data)
  const dispatchDropPayload = useDndDropPayloadDispatcher()
  const [isUrlDropTarget, setIsUrlDropTarget] = useState(false)
  const [element, setElement] = useState<HTMLElement | null>(null)
  const targetDataRef = useRef(scopedData)
  targetDataRef.current = scopedData

  useEffect(() => {
    if (!element || !enabled) {
      setIsUrlDropTarget(false)
      return
    }

    let dragDepth = 0
    const reset = () => {
      dragDepth = 0
      setIsUrlDropTarget(false)
    }
    const isUrlDropCandidate = (dataTransfer: DataTransfer | null) =>
      classifyExternalUrlDrop(dataTransfer).kind !== 'ignored'
    const onDragEnter = (event: DragEvent) => {
      if (!isUrlDropCandidate(event.dataTransfer)) return
      if (isBlockedExternalDropEvent(event, element, blockedTargetSelector)) return
      dragDepth += 1
      setIsUrlDropTarget(true)
    }
    const onDragOver = (event: DragEvent) => {
      if (!isUrlDropCandidate(event.dataTransfer)) return
      if (isBlockedExternalDropEvent(event, element, blockedTargetSelector)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    }
    const onDragLeave = (event: DragEvent) => {
      if (!isUrlDropCandidate(event.dataTransfer)) return
      if (isBlockedExternalDropEvent(event, element, blockedTargetSelector)) return
      dragDepth = Math.max(0, dragDepth - 1)
      if (dragDepth === 0) setIsUrlDropTarget(false)
    }
    const onDrop = async (event: DragEvent) => {
      if (!isUrlDropCandidate(event.dataTransfer)) return
      if (isBlockedExternalDropEvent(event, element, blockedTargetSelector)) return
      const classification = classifyExternalUrlDrop(event.dataTransfer, { readData: true })
      event.preventDefault()
      event.stopPropagation()
      reset()
      if (classification.kind === 'ignored' || classification.kind === 'candidate') return
      try {
        await dispatchDropPayload({
          payload:
            classification.kind === 'accepted'
              ? { kind: 'externalUrl', target: classification.target }
              : { kind: 'rejectedExternalUrl', reason: classification.reason },
          rawTarget: targetDataRef.current,
          dropInput: {
            clientX: event.clientX ?? 0,
            clientY: event.clientY ?? 0,
          },
        })
      } catch (error) {
        handleError(error, 'Failed to drop external URL')
      }
    }

    element.addEventListener('dragenter', onDragEnter)
    element.addEventListener('dragover', onDragOver)
    element.addEventListener('dragleave', onDragLeave)
    element.addEventListener('drop', onDrop)
    return () => {
      element.removeEventListener('dragenter', onDragEnter)
      element.removeEventListener('dragover', onDragOver)
      element.removeEventListener('dragleave', onDragLeave)
      element.removeEventListener('drop', onDrop)
    }
  }, [blockedTargetSelector, dispatchDropPayload, element, enabled])

  return { externalUrlDropTargetRef: setElement, isUrlDropTarget }
}
