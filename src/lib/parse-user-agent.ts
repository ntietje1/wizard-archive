export type ParsedUA = {
  device: string
  type: 'desktop' | 'mobile' | 'tablet'
  browser: string
}

export function parseUserAgent(ua: string | null | undefined): ParsedUA {
  if (!ua) return { device: 'Unknown', type: 'desktop', browser: 'Unknown' }

  return {
    device: parseDevice(ua),
    type: parseDeviceType(ua),
    browser: parseBrowser(ua),
  }
}

function parseDeviceType(ua: string): 'desktop' | 'mobile' | 'tablet' {
  if (/iPad|Tablet|PlayBook/i.test(ua)) return 'tablet'
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return 'tablet'
  if (/Mobile|Android|iPhone|iPod/i.test(ua)) return 'mobile'
  return 'desktop'
}

function parseDevice(ua: string): string {
  if (/iPhone/i.test(ua)) return 'iPhone'
  if (/iPad/i.test(ua)) return 'iPad'
  if (/Android/i.test(ua) && /Mobile/i.test(ua)) return 'Android Phone'
  if (/Android/i.test(ua)) return 'Android Tablet'
  if (/Macintosh|Mac OS/i.test(ua)) return 'Mac'
  if (/Windows/i.test(ua)) return 'Windows PC'
  if (/Linux/i.test(ua)) return 'Linux PC'
  if (/CrOS/i.test(ua)) return 'Chromebook'
  return 'Unknown Device'
}

function parseBrowser(ua: string): string {
  let match: RegExpMatchArray | null

  match = ua.match(/Edg(?:e)?\/(\d+)/)
  if (match) return `Edge ${match[1]}`

  match = ua.match(/OPR\/(\d+)/)
  if (match) return `Opera ${match[1]}`

  match = ua.match(/(?:Chromium|Chrome)\/(\d+)/)
  if (match) return `Chrome ${match[1]}`

  match = ua.match(/Firefox\/(\d+)/)
  if (match) return `Firefox ${match[1]}`

  match = ua.match(/Version\/(\d+).*Safari/)
  if (match) return `Safari ${match[1]}`

  return 'Unknown Browser'
}
