import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EmbedAncestryProvider } from '../embed-render-ancestry'
import { useEmbedAncestry } from '../embed-render-ancestry-context'
import type { Id } from 'convex/_generated/dataModel'

function Probe({ id }: { id: Id<'sidebarItems'> }) {
  const ancestry = useEmbedAncestry()
  return <div>{ancestry.has(id) ? 'recursive' : 'clear'}</div>
}

describe('EmbedAncestryProvider', () => {
  it('marks ids already in the render ancestry', () => {
    render(
      <EmbedAncestryProvider itemId={'note-a' as Id<'sidebarItems'>}>
        <Probe id={'note-a' as Id<'sidebarItems'>} />
      </EmbedAncestryProvider>,
    )

    expect(screen.getByText('recursive')).toBeInTheDocument()
  })
})
