export function getContrastColor(hexColor: string): string {
  let hex = hexColor.trim().replace('#', '')
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
  }
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    throw new TypeError(`Invalid hex color: "${hexColor}"`)
  }
  const rRaw = parseInt(hex.substring(0, 2), 16) / 255
  const gRaw = parseInt(hex.substring(2, 4), 16) / 255
  const bRaw = parseInt(hex.substring(4, 6), 16) / 255
  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  const luminance =
    0.2126 * toLinear(rRaw) + 0.7152 * toLinear(gRaw) + 0.0722 * toLinear(bRaw)
  return luminance > 0.179 ? '#000000' : '#ffffff'
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
  'var(--background)',
  'var(--bg-red)',
  'var(--bg-orange)',
  'var(--bg-yellow)',
  'var(--bg-green)',
  'var(--bg-blue)',
  'var(--bg-purple)',
  'var(--bg-pink)',
]
