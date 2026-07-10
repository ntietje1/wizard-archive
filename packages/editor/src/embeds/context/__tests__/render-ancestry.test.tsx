import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import { EmbedAncestryProvider } from '../render-ancestry'
import { useEmbedAncestry } from '../render-ancestry-context'
import type { SidebarItemId } from '../../../../../../shared/common/ids'

function Probe({ id }: { id: SidebarItemId }) {
  const ancestry = useEmbedAncestry()
  return <div>{ancestry.has(id) ? 'recursive' : 'clear'}</div>
}

describe('EmbedAncestryProvider', () => {
  it('marks ids already in the render ancestry', () => {
    render(
      <EmbedAncestryProvider itemId={sidebarItemId('note-a')}>
        <Probe id={sidebarItemId('note-a')} />
      </EmbedAncestryProvider>,
    )

    expect(screen.getByText('recursive')).toBeInTheDocument()
  })

  it('keeps parent ancestry visible through nested embed providers', () => {
    render(
      <EmbedAncestryProvider itemId={sidebarItemId('note-a')}>
        <EmbedAncestryProvider itemId={sidebarItemId('note-b')}>
          <Probe id={sidebarItemId('note-a')} />
          <Probe id={sidebarItemId('note-b')} />
          <Probe id={sidebarItemId('note-c')} />
        </EmbedAncestryProvider>
      </EmbedAncestryProvider>,
    )

    expect(screen.getAllByText('recursive')).toHaveLength(2)
    expect(screen.getByText('clear')).toBeInTheDocument()
  })
})

function sidebarItemId(value: string): SidebarItemId {
  return value as SidebarItemId
}
