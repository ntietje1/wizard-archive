import type { WizardEditorWorkspaceActor } from '@wizard-archive/editor/adapter'
import type { CampaignActor } from 'shared/campaigns/actor'

export function toEditorWorkspaceActor(
  actor: CampaignActor | null,
): WizardEditorWorkspaceActor | null {
  if (!actor) return null
  if (actor.kind === 'dm') return { kind: 'owner' }
  if (actor.kind === 'dm_view_as') {
    return { kind: 'owner_view_as', participantId: actor.memberId }
  }
  return { kind: 'participant' }
}
