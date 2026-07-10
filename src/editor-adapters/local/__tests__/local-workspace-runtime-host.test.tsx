import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { LocalWorkspaceRuntimeHost } from '../local-workspace-runtime-host'

const useLocalWorkspaceRuntimeMock = vi.hoisted(() => vi.fn())
const createViewStateStoresMock = vi.hoisted(() => vi.fn(() => ({})))
const runtime = vi.hoisted(() => ({
  workspace: { id: 'local-workspace-1', instanceId: 'local-runtime-1' },
}))

vi.mock('../use-local-workspace-runtime', () => ({
  useLocalWorkspaceRuntime: (args: unknown) => useLocalWorkspaceRuntimeMock(args),
}))

vi.mock('@wizard-archive/editor', () => ({
  WizardEditor: () => <div data-testid="local-runtime-host" />,
  createBrowserWizardEditorViewStateStores: createViewStateStoresMock,
}))

vi.mock('~/shared/utils/logger', () => ({
  handleError: vi.fn(),
}))

describe('LocalWorkspaceRuntimeHost', () => {
  beforeEach(() => {
    useLocalWorkspaceRuntimeMock.mockReset()
    useLocalWorkspaceRuntimeMock.mockReturnValue(runtime)
    createViewStateStoresMock.mockClear()
  })

  it('uses the browser external URL opener at the local host edge', () => {
    const openMock = vi.spyOn(window, 'open').mockImplementation(() => null)

    render(<LocalWorkspaceRuntimeHost ariaLabel="Local workspace" workspaceName="Local" />)

    expect(createViewStateStoresMock).toHaveBeenCalledWith({
      namespace: 'local-runtime-1',
    })

    const runtimeInput = useLocalWorkspaceRuntimeMock.mock.calls[0]?.[0] as {
      openExternalUrl: (url: string) => void
    }
    runtimeInput.openExternalUrl('https://example.com/file.pdf')

    expect(openMock).toHaveBeenCalledExactlyOnceWith(
      'https://example.com/file.pdf',
      '_blank',
      'noopener,noreferrer',
    )
    openMock.mockRestore()
  })
})
