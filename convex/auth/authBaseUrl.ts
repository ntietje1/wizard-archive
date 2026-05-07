type AuthBaseUrlConfig = {
  allowedHosts: Array<string>
  protocol: 'auto'
}

export function getAuthBaseUrlConfig(allowedHostsEnv: string | undefined): AuthBaseUrlConfig {
  const allowedHosts = parseAllowedHosts(allowedHostsEnv)

  if (allowedHosts.length === 0) {
    throw new Error('BETTER_AUTH_ALLOWED_HOSTS must contain at least one host')
  }

  return {
    allowedHosts,
    protocol: 'auto',
  }
}

export function parseAllowedHosts(allowedHostsEnv: string | undefined): Array<string> {
  const hosts = (allowedHostsEnv ?? '')
    .split(',')
    .map((host) => host.trim())
    .filter((host) => host !== '')
  return unique(hosts)
}

function unique<T>(values: Array<T>): Array<T> {
  return [...new Set(values)]
}
