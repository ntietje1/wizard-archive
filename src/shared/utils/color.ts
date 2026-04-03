export function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#000000' : '#ffffff'
}

export const BASE_TEXT_COLORS = [
  'var(--foreground)',
  'var(--t-red)',
  'var(--t-orange)',
  'var(--t-yellow)',
  'var(--t-green)',
  'var(--t-blue)',
  'var(--t-purple)',
  'var(--t-pink)',
]

export const BASE_BG_COLORS = [
  'var(--foreground)',
  'var(--bg-red)',
  'var(--bg-orange)',
  'var(--bg-yellow)',
  'var(--bg-green)',
  'var(--bg-blue)',
  'var(--bg-purple)',
  'var(--bg-pink)',
]
