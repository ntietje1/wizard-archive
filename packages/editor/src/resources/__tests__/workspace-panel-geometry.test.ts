import { describe, expect, it } from 'vite-plus/test'
import { DOMAIN_ID_KIND, generateDomainId } from '../domain-id'
import {
  DEFAULT_WORKSPACE_PANEL_GEOMETRY,
  loadWorkspacePanelGeometry,
  normalizeWorkspacePanelGeometry,
  saveWorkspacePanelGeometry,
} from '../workspace-panel-geometry'

describe('workspace panel geometry', () => {
  it('defaults and bounds browser-local sizes', () => {
    expect(normalizeWorkspacePanelGeometry(null)).toEqual(DEFAULT_WORKSPACE_PANEL_GEOMETRY)
    expect(normalizeWorkspacePanelGeometry({ left: 1, right: 1_000 })).toEqual({
      left: 200,
      right: 600,
    })
    expect(normalizeWorkspacePanelGeometry({ left: Number.NaN, right: 333.4 })).toEqual({
      left: DEFAULT_WORKSPACE_PANEL_GEOMETRY.left,
      right: 333,
    })
  })

  it('scopes persisted geometry by campaign and actor', () => {
    const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
    const actorId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    const otherActorId = generateDomainId(DOMAIN_ID_KIND.campaignMember)
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }

    saveWorkspacePanelGeometry(storage, campaignId, actorId, { left: 350, right: 450 })

    expect(loadWorkspacePanelGeometry(storage, campaignId, actorId)).toEqual({
      left: 350,
      right: 450,
    })
    expect(loadWorkspacePanelGeometry(storage, campaignId, otherActorId)).toEqual(
      DEFAULT_WORKSPACE_PANEL_GEOMETRY,
    )
  })
})
