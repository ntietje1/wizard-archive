import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import * as Y from 'yjs'
import { assertDomainId, DOMAIN_ID_KIND } from '../../resources/domain-id'
import type { CanvasPreviewSource } from '../../resources/content-session-contract'
import { initialVersion, sha256Digest } from '../../resources/component-version'
import { createCanvasDocumentDoc } from '../document-contract'
import { CanvasEmbedPreview } from '../canvas-embed-preview'
import { createCanvasTextDocument } from '../text/model'

const TARGET_RESOURCE_ID = assertDomainId(
  DOMAIN_ID_KIND.resource,
  '01890f47-65f2-7cc0-8a3b-555555555555',
)
const EMBED_NODE_ID = assertDomainId(
  DOMAIN_ID_KIND.canvasNode,
  '01890f47-65f2-7cc0-8a3b-666666666666',
)
const CHILD_NODE_ID = assertDomainId(
  DOMAIN_ID_KIND.canvasNode,
  '01890f47-65f2-7cc0-8a3b-777777777777',
)

describe('CanvasEmbedPreview', () => {
  it('renders canonical canvas content without controls, editing, or nested interaction', async () => {
    const document = createCanvasDocumentDoc({
      nodes: [
        {
          id: CHILD_NODE_ID,
          type: 'text',
          position: { x: 40, y: 60 },
          data: { content: createCanvasTextDocument('Readonly harbor') },
        },
      ],
      edges: [],
    })
    const state = {
      status: 'ready' as const,
      document,
      version: initialVersion(await sha256Digest(Y.encodeStateAsUpdate(document))),
    }
    const previews = {
      get: () => state,
      subscribe: () => () => {},
    } satisfies CanvasPreviewSource

    render(
      <CanvasEmbedPreview
        node={{
          id: EMBED_NODE_ID,
          type: 'embed',
          position: { x: 0, y: 0 },
          data: {
            destination: {
              kind: 'internal',
              target: { kind: 'resource', resourceId: TARGET_RESOURCE_ID },
            },
          },
        }}
        previews={previews}
      />,
    )

    expect(screen.getByTestId('canvas-readonly-preview')).toHaveClass('pointer-events-none')
    expect(screen.getByTestId('canvas-preview-node')).toHaveAttribute('data-node-id', CHILD_NODE_ID)
    expect(screen.getByText('Readonly harbor')).toBeVisible()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()

    document.destroy()
  })
})
