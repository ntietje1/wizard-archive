import { authClient } from '~/lib/auth-client'

export type DeviceSession = {
  session: { token: string }
  user: { id: string; name: string; email: string; image?: string | null }
}

/** Fetch all device sessions, deduplicated by user email (keeps most recent). */
export async function fetchDeviceSessions(): Promise<Array<DeviceSession>> {
  try {
    const { data } = await authClient.multiSession.listDeviceSessions()

    if (!data || data.length === 0) return []

    // Last entry per email wins (API returns oldest-first, so last = most recent)
    const byEmail = new Map<string, DeviceSession>()
    for (const ds of data) {
      byEmail.set(ds.user.email, ds)
    }
    return Array.from(byEmail.values())
  } catch (error) {
    console.error('Failed to fetch device sessions:', error)
    return []
  }
}
