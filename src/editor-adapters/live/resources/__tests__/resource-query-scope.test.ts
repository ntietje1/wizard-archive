import { describe, expect, it, vi } from 'vite-plus/test'
import { testDomainId } from '../../../../../shared/test/domain-id'
import { RESOURCE_INDEX_SCHEMA } from '@wizard-archive/editor/resources/index-contract'
import type { ResourceProjectionScope } from '@wizard-archive/editor/resources/index-contract'
import { executeResourceWrite, resourceQueryScope } from '../resource-query-scope'

const campaignId = testDomainId('campaign', 'view-as-query')
const actorId = testDomainId('campaignMember', 'view-as-query')

describe('view-as resource query scope', () => {
  it('sends the viewed participant only for an explicit view-as projection', () => {
    expect(resourceQueryScope(scope('dm'))).toEqual({ campaignId })
    expect(resourceQueryScope(scope('player'))).toEqual({ campaignId })
    expect(resourceQueryScope(scope('view_as_player'))).toEqual({
      campaignId,
      viewAsParticipantId: actorId,
    })
  })

  it('hard-blocks writes before invoking a backend in view-as scope', async () => {
    const operation = vi.fn(() => Promise.resolve('completed'))

    await expect(executeResourceWrite(scope('view_as_player'), operation)).rejects.toThrow(
      'View-as projections are read-only',
    )
    expect(operation).not.toHaveBeenCalled()
    await expect(executeResourceWrite(scope('dm'), operation)).resolves.toBe('completed')
    expect(operation).toHaveBeenCalledOnce()
  })
})

function scope(projection: ResourceProjectionScope['projection']): ResourceProjectionScope {
  return { campaignId, actorId, projection, schema: RESOURCE_INDEX_SCHEMA }
}
