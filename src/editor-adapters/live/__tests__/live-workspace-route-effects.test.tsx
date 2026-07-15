import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { testDomainId } from '../../../../shared/test/domain-id'
import { EDITOR_ROUTE_ID } from '../editor-route'
import { LiveWorkspaceRouteEffects } from '../live-workspace-route-effects'

const useMatchMock = vi.hoisted(() => vi.fn())
const ensureResourceMock = vi.hoisted(() =>
  vi.fn(() => Promise.resolve({ status: 'completed' as const })),
)
const resourceLoader = { ensureResource: ensureResourceMock, ensureCollection: vi.fn() }

vi.mock('@tanstack/react-router', () => ({
  useMatch: (input: unknown) => useMatchMock(input),
}))

describe('LiveWorkspaceRouteEffects', () => {
  const resourceId = testDomainId('resource', 'scene-one')
  beforeEach(() => {
    useMatchMock.mockReset()
    ensureResourceMock.mockClear()
    useMatchMock.mockReturnValue({ search: { resource: resourceId } })
  })

  it('hydrates the current live route resource', () => {
    render(<LiveWorkspaceRouteEffects resourceLoader={resourceLoader} />)

    expect(useMatchMock).toHaveBeenCalledWith({
      from: EDITOR_ROUTE_ID,
      shouldThrow: false,
    })
    expect(ensureResourceMock).toHaveBeenCalledExactlyOnceWith(resourceId)
  })

  it('does not hydrate without a route resource', () => {
    useMatchMock.mockReturnValue({ search: {} })

    render(<LiveWorkspaceRouteEffects resourceLoader={resourceLoader} />)

    expect(ensureResourceMock).not.toHaveBeenCalled()
  })
})
