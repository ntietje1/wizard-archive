export function isEditableHotkeyTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false

  const tagName = target.tagName.toLowerCase()
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true
  }

  return target.isContentEditable
}

export function isModifierShortcut(event: KeyboardEvent, key: string): boolean {
  return (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === key.toLowerCase()
}

export function isItemSurfaceInteractionTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.closest('a[href],button:not([disabled]),[data-item-selection-target="true"]') !== null
  )
}
