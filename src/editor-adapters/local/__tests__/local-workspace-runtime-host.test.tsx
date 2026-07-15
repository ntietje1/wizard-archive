import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { LocalWorkspaceRuntimeHost } from '../local-workspace-runtime-host'

const useLocalWorkspaceRuntimeMock = vi.hoisted(() => vi.fn())
const resourceShellMock = vi.hoisted(() =>
  vi.fn((_props: unknown) => <div data-testid="local-runtime-host" />),
)
const runtime = vi.hoisted(() => ({ scope: { campaignId: 'local-workspace-1' } }))

vi.mock('../use-local-workspace-runtime', () => ({
  useLocalWorkspaceRuntime: (args: unknown) => useLocalWorkspaceRuntimeMock(args),
}))

vi.mock('@wizard-archive/editor/resources/resource-shell', () => ({
  ResourceShell: (props: unknown) => resourceShellMock(props),
}))

describe('LocalWorkspaceRuntimeHost', () => {
  beforeEach(() => {
    useLocalWorkspaceRuntimeMock.mockReset()
    useLocalWorkspaceRuntimeMock.mockReturnValue(runtime)
    resourceShellMock.mockClear()
  })

  it('passes the canonical local resource runtime to the package editor', () => {
    render(
      <LocalWorkspaceRuntimeHost
        ariaLabel="Local workspace"
        canEdit={false}
        workspaceName="Local"
      />,
    )

    expect(useLocalWorkspaceRuntimeMock).toHaveBeenCalledWith({
      canEdit: false,
      initialResourceId: undefined,
      initialWorkspace: undefined,
    })
    expect(resourceShellMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ariaLabel: 'Local workspace',
        runtime,
        workspaceName: 'Local',
      }),
    )
  })
})
