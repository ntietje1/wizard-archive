type ItemSelectionIntent = 'single' | 'toggle' | 'range'
type ItemSelectionPlatform = 'mac' | 'other'

export interface ItemSelectionModifierState {
  shiftKey: boolean
  metaKey: boolean
  ctrlKey: boolean
  platform?: ItemSelectionPlatform
}

function detectItemSelectionPlatform(): ItemSelectionPlatform {
  if (typeof navigator === 'undefined') return 'other'
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? 'mac' : 'other'
}

export function getItemSelectionIntent({
  shiftKey,
  metaKey,
  ctrlKey,
  platform = detectItemSelectionPlatform(),
}: ItemSelectionModifierState): ItemSelectionIntent {
  if (shiftKey) return 'range'
  if (metaKey || (ctrlKey && platform !== 'mac')) return 'toggle'
  return 'single'
}
