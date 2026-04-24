import { BezierCanvasEdge } from './bezier/bezier-canvas-edge'
import { StepCanvasEdge } from './step/step-canvas-edge'
import { StraightCanvasEdge } from './straight/straight-canvas-edge'
import type { EdgeTypes } from '@xyflow/react'

export const canvasEdgeTypes = {
  bezier: BezierCanvasEdge,
  straight: StraightCanvasEdge,
  step: StepCanvasEdge,
} as const satisfies EdgeTypes
