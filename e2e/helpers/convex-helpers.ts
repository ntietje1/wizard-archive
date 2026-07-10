import { request } from '@playwright/test'
import { ConvexHttpClient } from 'convex/browser'
import { api } from 'convex/_generated/api'
import { AUTH_STORAGE_PATH } from './constants'
import { CAMPAIGN_MEMBER_ROLE, CAMPAIGN_MEMBER_STATUS } from 'shared/campaigns/types'
import type { APIRequestContext, APIResponse } from '@playwright/test'
import type { Id } from 'convex/_generated/dataModel'

const E2E_APP_URL = process.env.E2E_APP_URL ?? 'http://localhost:3000'
const CONVEX_OPERATION_ATTEMPTS = 3

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
  return campaign.id
}

export function getCampaignRouteFromUrl(url: string): {
  dmUsername: string
  campaignSlug: string
} {
  const [, campaignsSegment, dmUsername, campaignSlug] = new URL(url).pathname.split('/')
  if (campaignsSegment !== 'campaigns' || !dmUsername || !campaignSlug) {
    throw new Error(`Expected campaign route, got ${url}`)
  }
  return { dmUsername, campaignSlug }
}

export async function getSidebarItemIdBySlug({
  campaignId,
  slug,
}: {
  campaignId: Id<'campaigns'>
  slug: string
}): Promise<Id<'sidebarItems'>> {
  return (
    await getSidebarItemBySlug({
      campaignId,
      slug,
    })
  ).id
}

export async function getSidebarItemBySlug({
  campaignId,
  slug,
}: {
  campaignId: Id<'campaigns'>
  slug: string
}) {
  const client = await createE2EConvexClient()
  const item = await client.query(api.sidebarItems.queries.getSidebarItemBySlug, {
    campaignId,
    slug,
  })
  if (!item) {
    throw new Error(`Unable to find sidebar item with slug "${slug}"`)
  }
  return item
}

export async function getSidebarItemByName({
  campaignId,
  name,
}: {
  campaignId: Id<'campaigns'>
  name: string
}) {
  const client = await createE2EConvexClient()
  const { active: items } = await client.query(api.sidebarItems.queries.getSidebarItems, {
    campaignId,
  })
  const item = items.find((candidate) => candidate.name === name)
  if (!item) {
    throw new Error(`Unable to find active sidebar item named "${name}"`)
  }
  return item
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
    .sort((a, b) => a.id.localeCompare(b.id))[0]
  if (player) {
    return player.id
  }

  const requests = await client.query(api.campaigns.queries.getCampaignRequests, { campaignId })
  const pendingPlayer = requests
    .filter(
      (member) =>
        member.role === CAMPAIGN_MEMBER_ROLE.Player &&
        (member.status === CAMPAIGN_MEMBER_STATUS.Pending ||
          member.status === CAMPAIGN_MEMBER_STATUS.Rejected),
    )
    .sort((a, b) => a.id.localeCompare(b.id))[0]
  if (!pendingPlayer) {
    throw new Error('Unable to find campaign player member')
  }

  await client.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
    campaignId,
    memberId: pendingPlayer.id,
    status: CAMPAIGN_MEMBER_STATUS.Accepted,
  })
  return pendingPlayer.id
}

export async function createE2EConvexClient() {
  const convexUrl = process.env.VITE_CONVEX_URL
  if (!convexUrl) {
    throw new Error('VITE_CONVEX_URL is required for E2E Convex helpers')
  }

  const token = await retryConvexOperation(fetchConvexAuthToken)

  const client = new ConvexHttpClient(convexUrl)
  client.setAuth(token)
  return createRetriedConvexClient(client)
}

function createRetriedConvexClient(client: ConvexHttpClient) {
  return new Proxy(client, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver)
      if (
        typeof value !== 'function' ||
        (property !== 'query' && property !== 'mutation' && property !== 'action')
      ) {
        return value
      }

      return async (...args: Array<unknown>) =>
        retryConvexOperation(() => value.apply(target, args) as Promise<unknown>)
    },
  }) as ConvexHttpClient
}

async function retryConvexOperation<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < CONVEX_OPERATION_ATTEMPTS; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (!isRetryableConvexOperationError(error) || attempt === CONVEX_OPERATION_ATTEMPTS - 1) {
        throw error
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
    }
  }
  throw lastError
}

function isRetryableConvexOperationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /fetch failed|connect timeout|etimedout|econnreset|network|error reading storage state|unexpected end of json input|unterminated string in json/i.test(
    message,
  )
}

async function fetchConvexAuthToken() {
  const tokenRequest = await request.newContext({
    baseURL: E2E_APP_URL,
    storageState: AUTH_STORAGE_PATH,
  })

  try {
    let response = await tokenRequest.get('/api/auth/convex/token')
    if (response.status() === 401) {
      await signInRequestContext(tokenRequest)
      response = await tokenRequest.get('/api/auth/convex/token')
    }

    return await parseConvexAuthTokenResponse(response)
  } finally {
    await tokenRequest.dispose()
  }
}

async function signInRequestContext(tokenRequest: APIRequestContext) {
  const email = process.env.E2E_TEST_EMAIL
  const password = process.env.E2E_TEST_PASSWORD
  if (!email || !password) {
    throw new Error('E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set')
  }

  const origin = new URL(E2E_APP_URL).origin
  const response = await tokenRequest.post('/api/auth/sign-in/email', {
    data: { email, password },
    headers: {
      Origin: origin,
      Referer: `${origin}/sign-in`,
    },
    timeout: 60000,
  })
  if (!response.ok()) {
    throw new Error(`E2E request-context sign-in failed with ${response.status()}`)
  }
}

async function parseConvexAuthTokenResponse(response: APIResponse) {
  if (!response.ok()) {
    throw new Error(
      `Unable to fetch Convex auth token: ${response.status()} ${response.statusText()}`,
    )
  }

  const payload = (await response.json()) as { token?: unknown }
  if (typeof payload.token !== 'string' || payload.token.length === 0) {
    throw new Error('Convex auth token response did not include a token')
  }
  return payload.token
}
