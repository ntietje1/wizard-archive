import type {
  CanvasEmbeddedSessionPorts,
  CanvasSessionPorts,
} from '../canvas/workspace-session-source'

export function createTestCanvasSessionPorts(): CanvasSessionPorts {
  return {
    document: {
      useCanvasDocumentSession: () => ({
        status: 'error',
        error: 'Canvas session is not available in this test source.',
      }),
    },
  }
}

export function createTestCanvasEmbeddedSessionPorts(): CanvasEmbeddedSessionPorts {
  return {
    embeddedCanvas: {
      useEmbeddedCanvasState: () => ({ status: 'unavailable' }),
    },
  }
}
