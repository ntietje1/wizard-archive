export function isBlockedExternalDropEvent(
  event: DragEvent,
  dropTarget: HTMLElement,
  blockedTargetSelector: string | undefined,
) {
  if (!blockedTargetSelector) return false

  for (const target of getEventPath(event)) {
    if (
      target instanceof Element &&
      isBlockedDescendant(dropTarget, target, blockedTargetSelector)
    ) {
      return true
    }
  }

  const target = event.target
  const targetElement =
    target instanceof Element ? target : target instanceof Node ? target.parentElement : null
  return targetElement
    ? isBlockedDescendant(dropTarget, targetElement, blockedTargetSelector)
    : false
}

export function isBlockedExternalDropInput(
  dropTarget: HTMLElement,
  input: { clientX: number; clientY: number },
  blockedTargetSelector: string | undefined,
) {
  if (!blockedTargetSelector) return false

  const target = dropTarget.ownerDocument.elementFromPoint(input.clientX, input.clientY)
  return target ? isBlockedDescendant(dropTarget, target, blockedTargetSelector) : false
}

function isBlockedDescendant(
  dropTarget: HTMLElement,
  target: Element,
  blockedTargetSelector: string,
) {
  const blockedTarget = target.closest(blockedTargetSelector)
  return Boolean(blockedTarget && dropTarget.contains(blockedTarget))
}

function getEventPath(event: DragEvent): Array<EventTarget> {
  return typeof event.composedPath === 'function' ? event.composedPath() : []
}
