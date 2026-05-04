export interface CanvasElementSize {
  width: number
  height: number
}

export function readElementBorderBoxSize(element: HTMLElement): CanvasElementSize {
  const offsetWidth = element.offsetWidth
  const offsetHeight = element.offsetHeight
  if (offsetWidth > 0 || offsetHeight > 0) {
    return { width: offsetWidth, height: offsetHeight }
  }

  const clientWidth = element.clientWidth
  const clientHeight = element.clientHeight
  if (clientWidth > 0 || clientHeight > 0) {
    const style = getComputedStyle(element)
    return {
      width:
        clientWidth +
        readCssPixelValue(style.borderLeftWidth) +
        readCssPixelValue(style.borderRightWidth),
      height:
        clientHeight +
        readCssPixelValue(style.borderTopWidth) +
        readCssPixelValue(style.borderBottomWidth),
    }
  }

  const bounds = element.getBoundingClientRect()
  return { width: bounds.width, height: bounds.height }
}

export function readResizeObserverBorderBoxSize(entry: ResizeObserverEntry): CanvasElementSize {
  const borderBoxSize = Array.isArray(entry.borderBoxSize)
    ? entry.borderBoxSize[0]
    : entry.borderBoxSize
  if (borderBoxSize) {
    return {
      width: borderBoxSize.inlineSize,
      height: borderBoxSize.blockSize,
    }
  }

  return {
    width: entry.contentRect.width + getHorizontalBoxAdditions(entry.target),
    height: entry.contentRect.height + getVerticalBoxAdditions(entry.target),
  }
}

function getHorizontalBoxAdditions(target: Element) {
  const style = getComputedStyle(target)
  return (
    readCssPixelValue(style.paddingLeft) +
    readCssPixelValue(style.paddingRight) +
    readCssPixelValue(style.borderLeftWidth) +
    readCssPixelValue(style.borderRightWidth)
  )
}

function getVerticalBoxAdditions(target: Element) {
  const style = getComputedStyle(target)
  return (
    readCssPixelValue(style.paddingTop) +
    readCssPixelValue(style.paddingBottom) +
    readCssPixelValue(style.borderTopWidth) +
    readCssPixelValue(style.borderBottomWidth)
  )
}

function readCssPixelValue(value: string) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}
