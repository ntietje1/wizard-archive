import {
  MouseSensor as LibMouseSensor,
  TouchSensor as LibTouchSensor,
} from '@dnd-kit/core'

/**
 * Checks if an element or any of its ancestors has the data-no-dnd attribute.
 * This is used to prevent dragging from specific elements (like context menus).
 */
function shouldHandleEvent(element: Element | null): boolean {
  let currentElement: Element | null = element
  while (currentElement) {
    if (currentElement.hasAttribute('data-no-dnd')) {
      return false
    }
    currentElement = currentElement.parentElement
  }
  return true
}

/**
 * Custom mouse sensor that respects the data-no-dnd attribute.
 * This prevents dragging when interacting with elements that have this attribute.
 */
export class MouseSensor extends LibMouseSensor {
  static activators = [
    {
      eventName: 'onMouseDown' as const,
      handler: ({ nativeEvent }: { nativeEvent: MouseEvent }) => {
        return shouldHandleEvent(nativeEvent.target as Element)
      },
    },
  ]
}

/**
 * Custom touch sensor that respects the data-no-dnd attribute.
 * This prevents dragging when interacting with elements that have this attribute.
 */
export class TouchSensor extends LibTouchSensor {
  static activators = [
    {
      eventName: 'onTouchStart' as const,
      handler: ({ nativeEvent }: { nativeEvent: TouchEvent }) => {
        const { target } = nativeEvent
        return shouldHandleEvent(target as Element)
      },
    },
  ]
}

