export function getTrustedOrigins(siteUrl: string, additionalTrustedOrigins = ''): Array<string> {
  const siteOrigin = getOrigin(siteUrl)
  if (!siteOrigin) return []

  const origins = [siteOrigin]
  const site = new URL(siteOrigin)
  const siblingHostname = getSiblingHostname(site.hostname)

  if (siblingHostname) {
    site.hostname = siblingHostname
    origins.push(site.origin)
  }

  origins.push(...getAdditionalOrigins(additionalTrustedOrigins))

  return [...new Set(origins)]
}

function getAdditionalOrigins(additionalTrustedOrigins: string): Array<string> {
  return additionalTrustedOrigins
    .split(',')
    .map((origin) => getOrigin(origin.trim()))
    .filter((origin): origin is string => origin !== null)
}

function getOrigin(url: string): string | null {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

function getSiblingHostname(hostname: string): string | null {
  if (hostname.startsWith('www.')) {
    return hostname.slice(4)
  }

  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    return null
  }

  if (hostname.split('.').length === 2) {
    return `www.${hostname}`
  }

  return null
}
