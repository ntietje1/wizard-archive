import type { CampaignId, CampaignMemberId } from './domain-id'

type WorkspacePanelGeometry = Readonly<{
  left: number
  right: number
}>

export const DEFAULT_WORKSPACE_PANEL_GEOMETRY: WorkspacePanelGeometry = {
  left: 288,
  right: 280,
}

const MIN_WORKSPACE_PANEL_SIZE = 200
const MAX_WORKSPACE_PANEL_SIZE = 600

export function normalizeWorkspacePanelGeometry(value: unknown): WorkspacePanelGeometry {
  const geometry = isRecord(value) ? value : {}
  return {
    left: normalizePanelSize(geometry.left, DEFAULT_WORKSPACE_PANEL_GEOMETRY.left),
    right: normalizePanelSize(geometry.right, DEFAULT_WORKSPACE_PANEL_GEOMETRY.right),
  }
}

export function loadWorkspacePanelGeometry(
  storage: Pick<Storage, 'getItem'>,
  campaignId: CampaignId,
  actorId: CampaignMemberId,
): WorkspacePanelGeometry {
  try {
    return normalizeWorkspacePanelGeometry(
      JSON.parse(storage.getItem(workspacePanelGeometryKey(campaignId, actorId)) ?? 'null'),
    )
  } catch {
    return DEFAULT_WORKSPACE_PANEL_GEOMETRY
  }
}

export function saveWorkspacePanelGeometry(
  storage: Pick<Storage, 'setItem'>,
  campaignId: CampaignId,
  actorId: CampaignMemberId,
  geometry: WorkspacePanelGeometry,
): void {
  try {
    storage.setItem(
      workspacePanelGeometryKey(campaignId, actorId),
      JSON.stringify(normalizeWorkspacePanelGeometry(geometry)),
    )
  } catch {
    return
  }
}

function workspacePanelGeometryKey(campaignId: CampaignId, actorId: CampaignMemberId) {
  return `wizard-archive:workspace-panel-geometry:${campaignId}:${actorId}`
}

function normalizePanelSize(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(MAX_WORKSPACE_PANEL_SIZE, Math.max(MIN_WORKSPACE_PANEL_SIZE, Math.round(value)))
    : fallback
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
