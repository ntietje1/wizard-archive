import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { EditorShareParticipant } from '../../contracts'
import { ShareMenuPlayerIdentity } from '../row'

describe('ShareMenuPlayerIdentity', () => {
  it('uses username-only profiles as a single primary identity label', () => {
    const member = createMember({ name: null, username: 'archivist' })

    render(<ShareMenuPlayerIdentity member={member} />)

    expect(screen.getByText('@archivist')).toBeInTheDocument()
  })

  it('uses the profile name as primary identity and username as secondary identity', () => {
    const member = createMember({ name: 'Mara Vale', username: 'mara' })

    render(<ShareMenuPlayerIdentity member={member} />)

    expect(screen.getByText('Mara Vale')).toBeInTheDocument()
    expect(screen.getByText('@mara')).toBeInTheDocument()
  })
})

function createMember({
  name,
  username,
}: {
  name: string | null
  username: string
}): EditorShareParticipant {
  return {
    id: 'member_1',
    displayName: name ?? `@${username}`,
    imageUrl: null,
    username: name ? username : undefined,
  }
}
