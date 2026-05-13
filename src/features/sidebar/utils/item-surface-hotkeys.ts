export function isEditableHotkeyTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false

  const tagName = target.tagName.toLowerCase()
  if (tagName === 'input' || tagName === 'textarea') {
    const input = target as HTMLInputElement | HTMLTextAreaElement
    return !input.disabled && !input.readOnly
  }

  if (tagName === 'select') {
    return !(target as HTMLSelectElement).disabled
  }

  return Boolean(target.isContentEditable)
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

export function isItemSurfaceInteractionTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return (
    target.closest(
      'a[href],button:not([disabled]),[data-item-selection-target="true"],[data-slot="context-menu-content"]',
    ) !== null
  )
}
