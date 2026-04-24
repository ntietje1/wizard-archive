import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { CanvasConnectionPreview } from '../canvas-connection-preview'
import { useCanvasToolStore } from '../../../stores/canvas-tool-store'
import { Position } from '@xyflow/react'
import type { ConnectionLineComponentProps, Node } from '@xyflow/react'

function createConnectionPreviewProps(
  overrides: Partial<ConnectionLineComponentProps<Node>> = {},
): ConnectionLineComponentProps<Node> {
  return {
    connectionLineStyle: undefined,
    connectionLineType: 'bezier',
    fromNode: {
      id: 'node-1',
      internals: {
        userNode: {
          id: 'node-1',
          type: 'text',
          position: { x: 0, y: 0 },
          width: 120,
          height: 60,
          data: {},
        },
      },
    },
    fromHandle: { id: 'right', nodeId: 'node-1', position: Position.Right, type: 'source' },
    fromX: 120,
    fromY: 30,
    toX: 220,
    toY: 30,
    fromPosition: Position.Right,
    toPosition: Position.Left,
    connectionStatus: null,
    toNode: null,
    toHandle: null,
    pointer: { x: 220, y: 30 },
    ...overrides,
  } as ConnectionLineComponentProps<Node>
}

function getPreviewPath() {
  return screen.getByTestId('canvas-connection-preview').querySelector('path')?.getAttribute('d')
}

describe('CanvasConnectionPreview', () => {
  beforeEach(() => {
    useCanvasToolStore.getState().reset()
  })

  it('renders the active edge type with the current tool styling', () => {
    useCanvasToolStore.getState().setEdgeType('straight')
    useCanvasToolStore.getState().setStrokeColor('var(--t-red)')
    useCanvasToolStore.getState().setStrokeSize(8)

    render(<CanvasConnectionPreview {...createConnectionPreviewProps()} />)

    expect(screen.getByTestId('canvas-connection-preview')).toHaveAttribute(
      'data-edge-type',
      'straight',
    )
    expect(screen.getByTestId('canvas-connection-preview').querySelector('path')).toHaveStyle({
      stroke: 'var(--t-red)',
      strokeWidth: '8',
    })
  })

  it('aims the bezier preview directly into the cursor', () => {
    useCanvasToolStore.getState().setEdgeType('bezier')

    render(
      <CanvasConnectionPreview {...createConnectionPreviewProps()} toPosition={Position.Right} />,
    )

    const path = getPreviewPath()
    expect(path).toMatch(/^M 120,30\b/)
    expect(path).toContain(' C ')
    expect(path).toMatch(/ 220,30$/)
  })

  it('keeps the bezier preview aligned to the source handle near drag start', () => {
    useCanvasToolStore.getState().setEdgeType('bezier')

    render(
      <CanvasConnectionPreview
        {...createConnectionPreviewProps()}
        fromHandle={
          {
            id: 'bottom',
            nodeId: 'node-1',
            position: Position.Bottom,
            type: 'source',
          } as unknown as ConnectionLineComponentProps<Node>['fromHandle']
        }
        fromPosition={Position.Bottom}
        fromX={120}
        fromY={30}
        toX={136}
        toY={36}
        toPosition={Position.Right}
      />,
    )

    const path = getPreviewPath()
    expect(path).toMatch(/^M 60,60\b/)
    expect(path).toContain(' C ')
    expect(path).toMatch(/ 136,36$/)
  })

  it('anchors free-drag previews to the source node edge instead of stale handle coordinates', () => {
    useCanvasToolStore.getState().setEdgeType('bezier')
    const props = createConnectionPreviewProps({
      fromNode: {
        id: 'node-1',
        internals: {
          userNode: {
            id: 'node-1',
            type: 'text',
            position: { x: 10, y: 20 },
            width: 80,
            height: 60,
            data: {},
          },
        },
      } as unknown as ConnectionLineComponentProps<Node>['fromNode'],
      fromX: 120,
      fromY: 30,
      toX: 190,
      toY: 50,
    })
    const sourceNode = props.fromNode.internals.userNode
    const expectedSourceX = sourceNode.position.x + (sourceNode.width ?? 0)
    const expectedSourceY = sourceNode.position.y + (sourceNode.height ?? 0) / 2

    render(<CanvasConnectionPreview {...props} />)

    const path = getPreviewPath()
    expect(path).toMatch(new RegExp(`^M ${expectedSourceX},${expectedSourceY}\\b`))
    expect(path).toContain(' C ')
    expect(path).toMatch(/ 190,50$/)
  })
})
