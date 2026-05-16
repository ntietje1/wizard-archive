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
