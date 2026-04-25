export {
  applyCanvasSelectionCommitMode,
  areStringSetsEqual,
  getNextSelectedIds,
  isExclusivelySelectedNode,
  mergeSelectedIds,
} from '../system/canvas-selection'

type PrimarySelectionModifierEvent = {
  ctrlKey: boolean
  metaKey: boolean
}

type CanvasPlatform = 'mac' | 'windows' | 'linux'

function detectCanvasPlatform(): CanvasPlatform {
  if (typeof navigator === 'undefined') {
    return 'linux'
  }

  const platform = navigator.platform.toLowerCase()
  const userAgent = navigator.userAgent.toLowerCase()

  if (platform.includes('mac') || userAgent.includes('mac')) {
    return 'mac'
  }
  if (platform.includes('win')) {
    return 'windows'
  }

  return 'linux'
}

export function isPrimarySelectionModifier(
  event: PrimarySelectionModifierEvent,
  platform: CanvasPlatform = detectCanvasPlatform(),
): boolean {
  return platform === 'mac' ? event.metaKey : event.ctrlKey
}
