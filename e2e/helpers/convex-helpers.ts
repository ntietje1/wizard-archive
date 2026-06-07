import { readFile } from 'node:fs/promises'
import { ConvexHttpClient } from 'convex/browser'
import { api } from 'convex/_generated/api'
import { AUTH_STORAGE_PATH } from './constants'
import { CAMPAIGN_MEMBER_ROLE, CAMPAIGN_MEMBER_STATUS } from 'shared/campaigns/types'
import type { Id } from 'convex/_generated/dataModel'

const E2E_APP_URL = process.env.E2E_APP_URL ?? 'http://localhost:3000'

interface StorageState {
  cookies: Array<{
    name: string
    value: string
  }>
}

export async function getCampaignIdFromRoute({
  dmUsername,
  slug,
}: {
  dmUsername: string
  slug: string
}): Promise<Id<'campaigns'>> {
  const client = await createE2EConvexClient()
  const campaign = await client.query(api.campaigns.queries.getCampaignBySlug, {
    dmUsername,
    slug,
  })
  if (!campaign) {
    throw new Error(`Campaign not found for dmUsername=${dmUsername}, slug=${slug}`)
  }
  return campaign._id
}

export async function getSidebarItemIdBySlug({
  campaignId,
  slug,
}: {
  campaignId: Id<'campaigns'>
  slug: string
}): Promise<Id<'sidebarItems'>> {
  const client = await createE2EConvexClient()
  const item = await client.query(api.sidebarItems.queries.getSidebarItemBySlug, {
    campaignId,
    slug,
  })
  if (!item) {
    throw new Error(`Unable to find sidebar item with slug "${slug}"`)
  }
  return item._id
}

export async function ensureAcceptedPlayerMember({
  campaignId,
}: {
  campaignId: Id<'campaigns'>
}): Promise<Id<'campaignMembers'>> {
  const client = await createE2EConvexClient()
  const members = await client.query(api.campaigns.queries.getMembersByCampaign, { campaignId })
  const player = members
    .filter((member) => member.role === CAMPAIGN_MEMBER_ROLE.Player)
    .sort((a, b) => a._id.localeCompare(b._id))[0]
  if (player) {
    return player._id
  }

  const requests = await client.query(api.campaigns.queries.getCampaignRequests, { campaignId })
  const pendingPlayer = requests
    .filter(
      (member) =>
        member.role === CAMPAIGN_MEMBER_ROLE.Player &&
        (member.status === CAMPAIGN_MEMBER_STATUS.Pending ||
          member.status === CAMPAIGN_MEMBER_STATUS.Rejected),
    )
    .sort((a, b) => a._id.localeCompare(b._id))[0]
  if (!pendingPlayer) {
    throw new Error('Unable to find campaign player member')
  }

  await client.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
    campaignId,
    memberId: pendingPlayer._id,
    status: CAMPAIGN_MEMBER_STATUS.Accepted,
  })
  return pendingPlayer._id
}

export async function createE2EConvexClient() {
  const convexUrl = process.env.VITE_CONVEX_URL
  if (!convexUrl) {
    throw new Error('VITE_CONVEX_URL is required for E2E Convex helpers')
  }

  let authStorage: string
  try {
    authStorage = await readFile(AUTH_STORAGE_PATH, 'utf8')
  } catch (error) {
    throw new Error(`Error reading auth storage at ${AUTH_STORAGE_PATH}: ${getErrorMessage(error)}`)
  }

  let storage: StorageState
  try {
    storage = JSON.parse(authStorage) as StorageState
  } catch (error) {
    throw new Error(
      `Error parsing auth storage JSON at ${AUTH_STORAGE_PATH}: ${getErrorMessage(error)}`,
    )
  }

  const token = await fetchConvexAuthToken(storage)

  const client = new ConvexHttpClient(convexUrl)
  client.setAuth(token)
  return client
}

async function fetchConvexAuthToken(storage: StorageState) {
  const tokenUrl = new URL('/api/auth/convex/token', E2E_APP_URL)
  const response = await fetch(tokenUrl, {
    headers: {
      Cookie: storage.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; '),
    },
  })
  if (!response.ok) {
    throw new Error(`Unable to fetch Convex auth token: ${response.status} ${response.statusText}`)
  }

  const payload = (await response.json()) as { token?: unknown }
  if (typeof payload.token !== 'string' || payload.token.length === 0) {
    throw new Error('Convex auth token response did not include a token')
  }
  return payload.token
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
