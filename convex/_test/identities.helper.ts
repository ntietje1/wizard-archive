import {
  addPlayerToCampaign,
  createCampaignWithDm,
  createUserProfile,
} from './factories.helper'
import type { TestConvex, TestConvexForDataModel } from 'convex-test'
import type { DataModel } from '../_generated/dataModel'
import type schema from '../schema'

type T = TestConvex<typeof schema>
type AuthedContext = TestConvexForDataModel<DataModel>

export async function setupUser(t: T) {
  const profile = await createUserProfile(t)
  const authed = t.withIdentity({ subject: profile.authUserId })
  return { authed, profile }
}

export async function setupCampaignContext(t: T) {
  const dm = await setupUser(t)
  const player = await setupUser(t)

  const { campaignId, dmMemberId } = await createCampaignWithDm(t, dm.profile)
  const { memberId: playerMemberId } = await addPlayerToCampaign(
    t,
    campaignId,
    player.profile,
  )

  return {
    dm: { ...dm, memberId: dmMemberId },
    player: { ...player, memberId: playerMemberId },
    campaignId,
  }
}

export async function setupMultiPlayerContext(t: T, playerCount: number) {
  const dm = await setupUser(t)
  const { campaignId, dmMemberId } = await createCampaignWithDm(t, dm.profile)

  const players = []
  for (let i = 0; i < playerCount; i++) {
    const p = await setupUser(t)
    const { memberId } = await addPlayerToCampaign(t, campaignId, p.profile)
    players.push({ ...p, memberId })
  }

  return {
    dm: { ...dm, memberId: dmMemberId },
    players,
    campaignId,
  }
}

export function asDm<TCtx extends { dm: { authed: AuthedContext } }>(
  ctx: TCtx,
) {
  return ctx.dm.authed
}

export function asPlayer<TCtx extends { player: { authed: AuthedContext } }>(
  ctx: TCtx,
) {
  return ctx.player.authed
}
