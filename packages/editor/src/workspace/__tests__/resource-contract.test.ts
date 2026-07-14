import { describe, expect, it } from 'vite-plus/test'
import { isPersistedResourceId } from '../resource-contract'
import { testResourceId } from '../../../../../shared/test/resource-id'

describe('resource identity contracts', () => {
  it('rejects empty and optimistic resource IDs', () => {
    expect(isPersistedResourceId('')).toBe(false)
    expect(isPersistedResourceId('optimistic-create-1')).toBe(false)
    expect(isPersistedResourceId('sidebar-item-1')).toBe(false)
    expect(isPersistedResourceId(testResourceId('sidebar-item-1'))).toBe(true)
  })
})
