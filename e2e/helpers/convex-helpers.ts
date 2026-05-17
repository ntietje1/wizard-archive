import { readFile } from 'node:fs/promises'
import { ConvexHttpClient } from 'convex/browser'
import { api } from 'convex/_generated/api'
import { AUTH_STORAGE_PATH } from './constants'
import type { Id } from 'convex/_generated/dataModel'

const CONVEX_AUTH_COOKIE = '__Secure-better-auth.convex_jwt'

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

async function createE2EConvexClient() {
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

  const jwt = storage.cookies.find((cookie) => cookie.name === CONVEX_AUTH_COOKIE)?.value
  if (!jwt) {
    throw new Error(`Missing ${CONVEX_AUTH_COOKIE} in ${AUTH_STORAGE_PATH}`)
  }

  const client = new ConvexHttpClient(convexUrl)
  client.setAuth(jwt)
  return client
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
