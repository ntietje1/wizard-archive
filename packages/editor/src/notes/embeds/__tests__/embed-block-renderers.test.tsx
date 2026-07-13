import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import { NOTE_EMBED_EXTERNAL_HTML_ATTRIBUTE } from '../embed-block-html'
import { RenderExternalEmbedBlock } from '../embed-block-renderers'
import type { ComponentProps } from 'react'

type RenderExternalEmbedBlockProps = ComponentProps<typeof RenderExternalEmbedBlock>

describe('RenderExternalEmbedBlock', () => {
  it('serializes external URL embed props for BlockNote paste parsing', () => {
    const props = {
      block: {
        props: {
          name: 'Encounter table',
          previewAspectRatio: 1.5,
          previewHeight: 320,
          previewWidth: 480,
          targetKind: 'externalUrl',
          url: 'https://example.com/encounters.pdf',
        },
      },
    } as RenderExternalEmbedBlockProps

    render(<RenderExternalEmbedBlock {...props} />)

    const section = screen.getByText('Encounter table').closest('section')
    expect(section).toHaveAttribute(NOTE_EMBED_EXTERNAL_HTML_ATTRIBUTE, 'true')
    expect(section).toHaveAttribute('data-target-kind', 'externalUrl')
    expect(section).toHaveAttribute('data-url', 'https://example.com/encounters.pdf')
    expect(section).toHaveAttribute('data-name', 'Encounter table')
    expect(section).toHaveAttribute('data-preview-width', '480')
    expect(section).toHaveAttribute('data-preview-height', '320')
    expect(section).toHaveAttribute('data-preview-aspect-ratio', '1.5')
  })

  it('serializes resource embed props for BlockNote paste parsing', () => {
    const props = {
      block: {
        props: {
          previewWidth: 360,
          resourceId: 'note_1',
          targetKind: 'resource',
        },
      },
    } as RenderExternalEmbedBlockProps

    render(<RenderExternalEmbedBlock {...props} />)

    const section = screen.getByText('Embedded item').closest('section')
    expect(section).toHaveAttribute(NOTE_EMBED_EXTERNAL_HTML_ATTRIBUTE, 'true')
    expect(section).toHaveAttribute('data-target-kind', 'resource')
    expect(section).toHaveAttribute('data-resource-id', 'note_1')
    expect(section).toHaveAttribute('data-preview-width', '360')
  })

  it('does not use fields from a different embed target kind for its label', () => {
    render(
      <RenderExternalEmbedBlock
        {...({
          block: {
            props: {
              name: 'Wrong name',
              resourceId: 'note_1',
              targetKind: 'resource',
              url: 'https://example.com/wrong',
            },
          },
        } as RenderExternalEmbedBlockProps)}
      />,
    )

    expect(screen.getByText('Embedded item')).toBeInTheDocument()
    expect(screen.queryByText('Wrong name')).toBeNull()
  })
})
