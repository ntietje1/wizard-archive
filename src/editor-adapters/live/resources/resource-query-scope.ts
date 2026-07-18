import type { ResourceProjectionScope } from '@wizard-archive/editor/resources/index-contract'

export function resourceQueryScope(scope: ResourceProjectionScope) {
  return scope.projection === 'view_as_player'
    ? {
        campaignId: scope.campaignId,
        viewAsParticipantId: scope.actorId,
      }
    : { campaignId: scope.campaignId }
}

export async function executeResourceWrite<T>(
  scope: ResourceProjectionScope,
  operation: () => Promise<T>,
): Promise<T> {
  if (scope.projection === 'view_as_player') {
    throw new TypeError('View-as projections are read-only')
  }
  return await operation()
}
