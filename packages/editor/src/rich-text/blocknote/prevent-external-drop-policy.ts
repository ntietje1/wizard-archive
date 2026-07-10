import { classifyExternalUrlDrop } from '../../drag-drop/external-url-drop'

const ALLOWED_EXTERNAL_DROP_TARGET_SELECTOR = '[data-blocknote-external-drop-target="true"]'
const ALLOWED_EXTERNAL_URL_DROP_TARGET_SELECTOR = '[data-blocknote-external-url-drop-target="true"]'
const BLOCKED_EXTERNAL_DROP_TARGET_SELECTOR = '[data-blocknote-external-drop-blocked="true"]'

export function shouldPreventExternalFileDrop(event: DragEvent): boolean {
  const isFileDrag = event.dataTransfer?.types.includes('Files') ?? false
  if (!isFileDrag) return false

  return getExternalDropPolicyDecision(event) === 'blocked'
}

function getExternalDropPolicyDecision(event: DragEvent): 'allowedFile' | 'allowedUrl' | 'blocked' {
  const isUrlBearingDrag = classifyExternalUrlDrop(event.dataTransfer).kind !== 'ignored'

  for (const target of getEventElements(event)) {
    if (target.matches(BLOCKED_EXTERNAL_DROP_TARGET_SELECTOR)) return 'blocked'
    if (target.matches(ALLOWED_EXTERNAL_DROP_TARGET_SELECTOR)) return 'allowedFile'
    if (isUrlBearingDrag && target.matches(ALLOWED_EXTERNAL_URL_DROP_TARGET_SELECTOR)) {
      return 'allowedUrl'
    }
  }

  return 'blocked'
}

function getEventElements(event: DragEvent): Array<Element> {
  const path = typeof event.composedPath === 'function' ? event.composedPath() : []
  const elements = path.filter((target): target is Element => target instanceof Element)
  if (elements.length > 0) return elements

  const target = event.target
  const targetElement =
    target instanceof Element ? target : target instanceof Node ? target.parentElement : null
  const targetElements: Array<Element> = []
  for (let element = targetElement; element; element = element.parentElement) {
    targetElements.push(element)
  }
  return targetElements
}
