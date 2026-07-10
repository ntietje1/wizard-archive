import { render, renderHook, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { DndProviderContext, useDndDropPayloadDispatcher } from '../context'
import type { DndValue } from '../context'
import { CANVAS_DROP_ZONE_TYPE } from '../drop-target-data'
import { useExternalUrlDropTarget } from '../use-external-url-drop-target'
import { resolveDropCommand } from '../drop-command-planner'
import { executePlannedDropCommand } from '../drop-command-execution'
import type { SurfaceDropCommandEffects } from '../surface-command-effects'

const handleError = vi.hoisted(() => vi.fn())

vi.mock('../../errors/handle-error', () => ({ handleError }))

describe('useExternalUrlDropTarget', () => {
  beforeEach(() => {
    handleError.mockReset()
  })

  it('requires an explicit runtime dispatcher when dispatching native URL drops', async () => {
    const { result } = renderHook(() => useDndDropPayloadDispatcher())

    await expect(
      result.current({
        payload: {
          kind: 'externalUrl',
          target: { kind: 'externalUrl', url: 'https://example.com/file.pdf', name: 'file.pdf' },
        },
        rawTarget: null,
        dropInput: { clientX: 0, clientY: 0 },
      }),
    ).rejects.toThrow('DndRuntimeProvider is required for native URL drops')
  })

  it('reports dispatcher failures through the shared error handler', async () => {
    const error = new Error('drop failed')
    const dispatchDropPayload = vi.fn(() => Promise.reject(error))
    render(
      <ExternalUrlDropTargetProvider dispatchDropPayload={dispatchDropPayload}>
        <ExternalUrlDropTargetHarness />
      </ExternalUrlDropTargetProvider>,
    )

    dispatchNativeDrop({
      types: ['text/plain'],
      getData: (type) => (type === 'text/plain' ? 'https://example.com/file.pdf' : ''),
    })

    await waitFor(() =>
      expect(handleError).toHaveBeenCalledWith(error, 'Failed to drop external URL'),
    )
  })

  it('dispatches browser file drags as URLs when URL data is present', async () => {
    const dispatchDropPayload = vi.fn(() => Promise.resolve())
    render(
      <ExternalUrlDropTargetProvider dispatchDropPayload={dispatchDropPayload}>
        <ExternalUrlDropTargetHarness />
      </ExternalUrlDropTargetProvider>,
    )

    dispatchNativeDrop({
      types: ['Files', 'text/uri-list', 'text/plain'],
      getData: (type) =>
        type === 'text/uri-list' || type === 'text/plain'
          ? 'https://cdn.example.com/dragon.png'
          : '',
    })

    await waitFor(() =>
      expect(dispatchDropPayload).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: {
            kind: 'externalUrl',
            target: {
              kind: 'externalUrl',
              url: 'https://cdn.example.com/dragon.png',
              name: 'dragon.png',
            },
          },
        }),
      ),
    )
  })

  it('prevents invalid URL drops and reports their rejection through execution', async () => {
    const reportRejection = vi.fn<SurfaceDropCommandEffects['reportRejection']>()
    const dispatchDropPayload = vi.fn(createRejectionDispatcher(reportRejection))
    render(
      <ExternalUrlDropTargetProvider dispatchDropPayload={dispatchDropPayload}>
        <ExternalUrlDropTargetHarness />
      </ExternalUrlDropTargetProvider>,
    )

    const event = dispatchNativeDrop({
      types: ['Files', 'text/plain'],
      getData: (type) => (type === 'text/plain' ? 'not a URL' : ''),
    })

    expect(event.defaultPrevented).toBe(true)
    await waitFor(() =>
      expect(reportRejection).toHaveBeenCalledExactlyOnceWith('unsupported_target'),
    )
  })

  it('does not dispatch URL drops from blocked descendants', async () => {
    const dispatchDropPayload = vi.fn(() => Promise.resolve())
    render(
      <ExternalUrlDropTargetProvider dispatchDropPayload={dispatchDropPayload}>
        <ExternalUrlDropTargetHarness blockedTargetSelector="[data-blocked-external-drop='true']" />
      </ExternalUrlDropTargetProvider>,
    )

    dispatchNativeDrop(
      {
        types: ['Files', 'text/uri-list'],
        getData: (type) => (type === 'text/uri-list' ? 'https://cdn.example.com/dragon.png' : ''),
      },
      screen.getByTestId('blocked-child'),
    )

    await waitFor(() => expect(dispatchDropPayload).not.toHaveBeenCalled())
  })
})

function ExternalUrlDropTargetProvider({
  children,
  dispatchDropPayload = vi.fn(() => Promise.resolve()),
}: {
  children: ReactNode
  dispatchDropPayload?: DndValue['dispatchDropPayload']
}) {
  return (
    <DndProviderContext.Provider
      value={{
        canAcceptExternalFiles: true,
        dispatchDropPayload,
        getItemLinkPath: () => [],
        runtimeId: 'runtime-test',
      }}
    >
      {children}
    </DndProviderContext.Provider>
  )
}

function ExternalUrlDropTargetHarness({
  blockedTargetSelector,
}: {
  blockedTargetSelector?: string
}) {
  const { externalUrlDropTargetRef } = useExternalUrlDropTarget({
    data: { type: CANVAS_DROP_ZONE_TYPE, canvasId: 'canvas_1' },
    enabled: true,
    blockedTargetSelector,
  })
  return (
    <div ref={externalUrlDropTargetRef} data-testid="url-drop-target">
      <div data-blocked-external-drop="true" data-testid="blocked-child" />
    </div>
  )
}

function dispatchNativeDrop(
  dataTransfer: {
    types: Array<string>
    getData: (type: string) => string
  },
  target: HTMLElement = screen.getByTestId('url-drop-target'),
) {
  const event = new Event('drop', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
  target.dispatchEvent(event)
  return event
}

function createRejectionDispatcher(
  reportRejection: SurfaceDropCommandEffects['reportRejection'],
): DndValue['dispatchDropPayload'] {
  return async ({ payload, dropInput }) => {
    await executePlannedDropCommand(
      resolveDropCommand({
        payload,
        target: null,
        ctx: {
          canCreateRootItems: true,
          canManageFolders: true,
          workspaceId: 'campaign-1',
          workspaceName: 'Campaign',
        },
      }),
      dropInput,
      {
        executeFileSystemCommand: vi.fn(),
        openItem: vi.fn(),
        setBatchDecision: vi.fn(),
        surfaceEffects: {
          reportError: vi.fn(),
          reportRejection,
          reportRejections: vi.fn(),
        },
      },
    )
  }
}
