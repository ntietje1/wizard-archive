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

export function isCanvasTextEntryTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(TEXT_ENTRY_TARGET_SELECTOR))
}

export function isCanvasInteractiveKeyboardTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(INTERACTIVE_KEYBOARD_TARGET_SELECTOR))
}
