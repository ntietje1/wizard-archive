import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EditableName } from '../editable-item-name'
import type { Id } from 'convex/_generated/dataModel'
import { assertSidebarItemName } from 'convex/sidebarItems/validation/name'

vi.mock('~/shared/hooks/useNameValidation', () => ({
  useNameValidation: () => ({
    hasError: false,
    validationError: null,
    checkNameUnique: vi.fn(),
  }),
}))

describe('EditableName', () => {
  it('applies the display class to the non-renaming name', () => {
    render(
      <EditableName
        initialName={assertSidebarItemName('Session Notes')}
        isRenaming={false}
        displayClassName="text-muted-foreground group-hover:text-foreground"
        onFinishRename={vi.fn()}
        onCancelRename={vi.fn()}
        parentId={null as Id<'sidebarItems'> | null}
      />,
    )

    expect(screen.getByText('Session Notes')).toHaveClass('text-muted-foreground')
    expect(screen.getByText('Session Notes')).toHaveClass('group-hover:text-foreground')
  })
})
