import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { MaybePromise } from '../../../../shared/common/async'
import type { ResourceCommandResult } from './transaction-contract'
import { reportResourceCommandFailure } from './report-command-result'
import {
  ITEM_SURFACE_FLOATING_COMMAND_SELECTOR,
  eventBelongsToHotkeyScope,
  isEditableHotkeyTarget,
  isItemSurfaceHotkeyTarget,
} from '../workspace/sidebar/item-surface-hotkeys'

const FILE_SYSTEM_COMMAND_OVERLAY_SELECTOR = [
  ITEM_SURFACE_FLOATING_COMMAND_SELECTOR,
  '[data-slot="context-menu-content"]',
  '[data-slot="context-menu-rich-submenu-content"]',
  '[data-slot="dropdown-menu-content"]',
  '[data-slot="popover-content"]',
  '[data-slot="select-content"]',
].join(',')

type UndoRedoHandlers = {
  canUndo: boolean
  canRedo: boolean
  undo: () => MaybePromise<ResourceCommandResult>
  redo: () => MaybePromise<ResourceCommandResult>
  reportError: (error: unknown, message: string) => void
}

const FILE_SYSTEM_HISTORY_HOTKEY_TIMEOUT_MS = 10_000

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
  return globalThis.document?.querySelector(FILE_SYSTEM_COMMAND_OVERLAY_SELECTOR) !== null
}

function isFileSystemCommandOverlayFallbackTarget(target: EventTarget | null): boolean {
  return !hasConcreteHotkeyTarget(target) && hasOpenFileSystemCommandOverlay()
}

function isFileSystemCommandOverlayTarget(target: EventTarget | null): boolean {
  return (
    getHotkeyTargetCandidates(target).some(
      (candidate) => candidate.closest(FILE_SYSTEM_COMMAND_OVERLAY_SELECTOR) !== null,
    ) || isFileSystemCommandOverlayFallbackTarget(target)
  )
}

function isFileSystemUndoRedoTarget(target: EventTarget | null): boolean {
  return isItemSurfaceHotkeyTarget(target) || isFileSystemCommandOverlayTarget(target)
}

export function useFileSystemUndoHotkeys(
  { canUndo, canRedo, undo, redo, reportError }: UndoRedoHandlers,
  options: { scopeRef?: RefObject<HTMLElement | null> } = {},
) {
  const isOperationInFlightRef = useRef(false)
  const handlersRef = useRef({ canUndo, canRedo, undo, redo, reportError })
  handlersRef.current = { canUndo, canRedo, undo, redo, reportError }
  const scopeRef = options.scopeRef

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!eventBelongsToHotkeyScope(event, scopeRef?.current ?? null)) return
      if (event.defaultPrevented) return
      const isOverlayFallbackTarget = isFileSystemCommandOverlayFallbackTarget(event.target)
      if (!isOverlayFallbackTarget && isEditableHotkeyTarget(event.target)) {
        return
      }
      if (!isFileSystemUndoRedoTarget(event.target)) return

      if (isFileSystemRedoShortcut(event)) {
        if (!handlersRef.current.canRedo) return
        event.preventDefault()
        if (isOperationInFlightRef.current) return
        isOperationInFlightRef.current = true
        runHistoryHotkeyOperation({
          inFlightRef: isOperationInFlightRef,
          message: 'Filesystem redo failed',
          run: handlersRef.current.redo,
          timeoutMessage: 'Filesystem redo timed out',
          reportError: (error, message) => handlersRef.current.reportError(error, message),
        })
        return
      }

      if (isFileSystemUndoShortcut(event)) {
        if (!handlersRef.current.canUndo) return
        event.preventDefault()
        if (isOperationInFlightRef.current) return
        isOperationInFlightRef.current = true
        runHistoryHotkeyOperation({
          inFlightRef: isOperationInFlightRef,
          message: 'Filesystem undo failed',
          run: handlersRef.current.undo,
          timeoutMessage: 'Filesystem undo timed out',
          reportError: (error, message) => handlersRef.current.reportError(error, message),
        })
      }
    }

    // Capture keeps filesystem undo/redo available while floating menus or overlays have focus.
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [scopeRef])
}

function runHistoryHotkeyOperation({
  inFlightRef,
  message,
  reportError,
  run,
  timeoutMessage,
}: {
  inFlightRef: { current: boolean }
  message: string
  reportError: (error: unknown, message: string) => void
  run: () => MaybePromise<ResourceCommandResult>
  timeoutMessage: string
}) {
  let settled = false
  const finish = () => {
    if (settled) return false
    settled = true
    inFlightRef.current = false
    return true
  }
  const timeoutId = window.setTimeout(() => {
    if (!finish()) return
    reportError(new Error(timeoutMessage), message)
  }, FILE_SYSTEM_HISTORY_HOTKEY_TIMEOUT_MS)

  void Promise.resolve()
    .then(run)
    .then((result) => {
      if (settled) return false
      return reportResourceCommandFailure(result, message, reportError)
    })
    .catch((error) => {
      if (!settled) reportError(error, message)
    })
    .finally(() => {
      if (finish()) window.clearTimeout(timeoutId)
    })
}
