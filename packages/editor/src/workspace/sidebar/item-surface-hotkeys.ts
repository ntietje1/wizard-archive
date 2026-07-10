export const ITEM_SURFACE_HOTKEY_TARGET_ATTRIBUTE = 'data-item-surface-hotkey-target'
const ITEM_SURFACE_FLOATING_COMMAND_ATTRIBUTE = 'data-item-surface-floating-command'
const ITEM_SURFACE_HOTKEY_TARGET_SELECTOR = `[${ITEM_SURFACE_HOTKEY_TARGET_ATTRIBUTE}="true"]`
export const ITEM_SURFACE_FLOATING_COMMAND_SELECTOR = `[${ITEM_SURFACE_FLOATING_COMMAND_ATTRIBUTE}="true"]`
const ITEM_SURFACE_INTERACTIVE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  '[data-item-selection-target="true"]',
  '[data-slot="context-menu-content"]',
  '[data-slot="popover-content"]',
  '[data-slot="select-content"]',
  ITEM_SURFACE_FLOATING_COMMAND_SELECTOR,
].join(',')
const NESTED_INTERACTIVE_HOTKEY_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  '[role="button"]',
  ITEM_SURFACE_FLOATING_COMMAND_SELECTOR,
].join(',')

export function isEditableHotkeyTarget(target: EventTarget | null): boolean {
  const candidates = getHotkeyTargetCandidates(target)

  for (const candidate of candidates) {
    if (isEditableElementOrDescendant(candidate)) return true
  }

  return false
}

function getHotkeyTargetCandidates(target: EventTarget | null): Array<Element> {
  const candidates: Array<Element> = []
  if (typeof Element !== 'undefined' && target instanceof Element) candidates.push(target)
  if (globalThis.document?.activeElement) candidates.push(globalThis.document.activeElement)
  if (shouldUseSelectionFallback(target)) {
    const selectionNode = globalThis.getSelection?.()?.anchorNode
    const selectionElement =
      typeof Element !== 'undefined' && selectionNode instanceof Element
        ? selectionNode
        : selectionNode?.parentElement
    if (selectionElement) candidates.push(selectionElement)
  }

  return candidates
}

function shouldUseSelectionFallback(target: EventTarget | null): boolean {
  // Fall back to DOM selection only when neither target nor activeElement identifies a real focus target.
  if (
    typeof Element !== 'undefined' &&
    target instanceof Element &&
    isConcreteFocusTarget(target)
  ) {
    return false
  }

  const activeElement = globalThis.document?.activeElement
  return !(activeElement instanceof Element) || !isConcreteFocusTarget(activeElement)
}

function isConcreteFocusTarget(element: Element): boolean {
  return element !== globalThis.document?.body && element !== globalThis.document?.documentElement
}

function isEditableElementOrDescendant(target: Element): boolean {
  const editableTarget = target.closest(
    'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
  )
  if (!(editableTarget instanceof HTMLElement)) return false

  const tagName = editableTarget.tagName.toLowerCase()
  if (tagName === 'input' || tagName === 'textarea') {
    const input = editableTarget as HTMLInputElement | HTMLTextAreaElement
    return !input.disabled && !input.readOnly
  }

  if (tagName === 'select') {
    return !(editableTarget as HTMLSelectElement).disabled
  }

  return true
}

export function isModifierShortcut(event: KeyboardEvent, key: string): boolean {
  const normalizedKey = key.trim().toLowerCase()
  return (
    normalizedKey.length > 0 &&
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === normalizedKey
  )
}

export function eventBelongsToHotkeyScope(event: KeyboardEvent, scope: HTMLElement | null) {
  if (!scope) return true
  if (event.target instanceof Node && scope.contains(event.target)) return true
  const activeElement = globalThis.document?.activeElement
  return activeElement instanceof Node && scope.contains(activeElement)
}

export function isItemSurfaceInteractionTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return (
    isEditableElementOrDescendant(target) ||
    target.closest(ITEM_SURFACE_INTERACTIVE_SELECTOR) !== null
  )
}

export function isItemSurfaceHotkeyTarget(target: EventTarget | null): boolean {
  return getHotkeyTargetCandidates(target).some(
    (candidate) => candidate.closest(ITEM_SURFACE_HOTKEY_TARGET_SELECTOR) !== null,
  )
}

export function isNestedInteractiveHotkeyTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return target.closest(NESTED_INTERACTIVE_HOTKEY_SELECTOR) !== null
}
