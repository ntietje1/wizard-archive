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

  const boxAdditions = getBoxAdditions(getComputedStyle(entry.target))
  return {
    width: entry.contentRect.width + boxAdditions.width,
    height: entry.contentRect.height + boxAdditions.height,
  }
}

function getBoxAdditions(style: CSSStyleDeclaration): { width: number; height: number } {
  return {
    width:
      readCssPixelValue(style.paddingLeft) +
      readCssPixelValue(style.paddingRight) +
      readCssPixelValue(style.borderLeftWidth) +
      readCssPixelValue(style.borderRightWidth),
    height:
      readCssPixelValue(style.paddingTop) +
      readCssPixelValue(style.paddingBottom) +
      readCssPixelValue(style.borderTopWidth) +
      readCssPixelValue(style.borderBottomWidth),
  }
}

function readCssPixelValue(value: string) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}
