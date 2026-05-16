const TEXT_ENTRY_TARGET_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[contenteditable="plaintext-only"]',
  '.canvas-rich-text-editor',
].join(',')

const INTERACTIVE_KEYBOARD_TARGET_SELECTOR = [TEXT_ENTRY_TARGET_SELECTOR, 'button', 'a[href]'].join(
  ',',
)

export function isCanvasTextEntryTarget(target: EventTarget | null): target is Element {
  return target instanceof Element && target.closest(TEXT_ENTRY_TARGET_SELECTOR) !== null
}

export function isCanvasInteractiveKeyboardTarget(target: EventTarget | null): target is Element {
  return target instanceof Element && target.closest(INTERACTIVE_KEYBOARD_TARGET_SELECTOR) !== null
}

export function isCanvasHotkeyTarget(
  surfaceElement: HTMLElement | null,
  target: EventTarget | null,
): boolean {
  if (!surfaceElement) {
    return true
  }

  if (target instanceof Element && surfaceElement.contains(target)) {
    return true
  }

  const activeElement = globalThis.document?.activeElement
  return activeElement instanceof Element && surfaceElement.contains(activeElement)
}
