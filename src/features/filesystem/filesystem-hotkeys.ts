import { useEffect, useRef } from 'react'
import { handleError } from '~/shared/utils/logger'
import {
  ITEM_SURFACE_FLOATING_COMMAND_SELECTOR,
  isEditableHotkeyTarget,
  isItemSurfaceHotkeyTarget,
} from '~/features/sidebar/utils/item-surface-hotkeys'

type UndoRedoHandlers = {
  canUndo: boolean
  canRedo: boolean
  undo: () => Promise<unknown>
  redo: () => Promise<unknown>
}

function isFileSystemUndoShortcut(event: KeyboardEvent) {
  return (
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === 'z'
  )
}

function isFileSystemRedoShortcut(event: KeyboardEvent) {
  if (event.altKey) return false
  const key = event.key.toLowerCase()
  return (
    ((event.ctrlKey || event.metaKey) && event.shiftKey && key === 'z') ||
    (event.ctrlKey && !event.metaKey && !event.shiftKey && key === 'y')
  )
}

function getHotkeyTargetCandidates(target: EventTarget | null): Array<Element> {
  const candidates: Array<Element> = []
  if (typeof Element !== 'undefined' && target instanceof Element) candidates.push(target)
  if (globalThis.document?.activeElement instanceof Element) {
    candidates.push(globalThis.document.activeElement)
  }
  return candidates
}

function isConcreteHotkeyElement(element: Element | null): boolean {
  return element !== null && element !== document.body && element !== document.documentElement
}

function hasConcreteHotkeyTarget(target: EventTarget | null): boolean {
  const targetElement = typeof Element !== 'undefined' && target instanceof Element ? target : null
  const activeElement =
    globalThis.document?.activeElement instanceof Element ? globalThis.document.activeElement : null
  return isConcreteHotkeyElement(targetElement) || isConcreteHotkeyElement(activeElement)
}

function hasOpenFileSystemCommandOverlay(): boolean {
  return globalThis.document?.querySelector(ITEM_SURFACE_FLOATING_COMMAND_SELECTOR) !== null
}

function isFileSystemCommandOverlayFallbackTarget(target: EventTarget | null): boolean {
  return !hasConcreteHotkeyTarget(target) && hasOpenFileSystemCommandOverlay()
}

function isFileSystemCommandOverlayTarget(target: EventTarget | null): boolean {
  return (
    getHotkeyTargetCandidates(target).some(
      (candidate) => candidate.closest(ITEM_SURFACE_FLOATING_COMMAND_SELECTOR) !== null,
    ) || isFileSystemCommandOverlayFallbackTarget(target)
  )
}

function isFileSystemUndoRedoTarget(target: EventTarget | null): boolean {
  return isItemSurfaceHotkeyTarget(target) || isFileSystemCommandOverlayTarget(target)
}

export function useFileSystemUndoHotkeys({ canUndo, canRedo, undo, redo }: UndoRedoHandlers) {
  const isOperationInFlightRef = useRef(false)
  const handlersRef = useRef({ canUndo, canRedo, undo, redo })
  handlersRef.current = { canUndo, canRedo, undo, redo }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isOverlayFallbackTarget = isFileSystemCommandOverlayFallbackTarget(event.target)
      if (
        isOperationInFlightRef.current ||
        (!isOverlayFallbackTarget && isEditableHotkeyTarget(event.target))
      ) {
        return
      }
      if (!isFileSystemUndoRedoTarget(event.target)) return

      if (isFileSystemRedoShortcut(event)) {
        if (!handlersRef.current.canRedo) return
        event.preventDefault()
        isOperationInFlightRef.current = true
        void handlersRef.current
          .redo()
          .catch((error) => handleError(error, 'Filesystem redo failed'))
          .finally(() => {
            isOperationInFlightRef.current = false
          })
        return
      }

      if (isFileSystemUndoShortcut(event)) {
        if (!handlersRef.current.canUndo) return
        event.preventDefault()
        isOperationInFlightRef.current = true
        void handlersRef.current
          .undo()
          .catch((error) => handleError(error, 'Filesystem undo failed'))
          .finally(() => {
            isOperationInFlightRef.current = false
          })
      }
    }

    // Capture keeps filesystem undo/redo available while floating menus or overlays have focus.
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])
}
