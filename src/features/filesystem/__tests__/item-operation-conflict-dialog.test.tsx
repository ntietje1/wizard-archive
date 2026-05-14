import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ItemOperationConflictDialog } from '../item-operation-conflict-dialog'
import type { ItemOperationConflict } from 'convex/sidebarItems/filesystem/conflicts'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { testId } from '~/test/helpers/test-id'

function createConflict(
  index: number,
  sourceType: ItemOperationConflict['sourceType'] = SIDEBAR_ITEM_TYPES.notes,
  destinationType: ItemOperationConflict['destinationType'] = sourceType,
): ItemOperationConflict {
  const sourceIdPrefix = {
    [SIDEBAR_ITEM_TYPES.notes]: 'note',
    [SIDEBAR_ITEM_TYPES.folders]: 'folder',
    [SIDEBAR_ITEM_TYPES.gameMaps]: 'map',
    [SIDEBAR_ITEM_TYPES.files]: 'file',
    [SIDEBAR_ITEM_TYPES.canvases]: 'canvas',
  }[sourceType]
  return {
    sourceItemId: testId<'sidebarItems'>(`${sourceIdPrefix}_${index}`),
    destinationItemId: testId<'sidebarItems'>(`existing_${index}`),
    sourceName: `Incoming ${index}`,
    destinationName: `Existing ${index}`,
    kind: 'name-conflict',
    sourceType,
    destinationType,
  }
}

describe('ItemOperationConflictDialog', () => {
  it.each([
    ['Keep both items', 'keepBoth'],
    ['Replace the items in the destination', 'replace'],
    ['Skip these items', 'skip'],
  ] as const)('applies bulk %s to every conflict', (buttonName, action) => {
    const onResolve = vi.fn()
    render(
      <ItemOperationConflictDialog
        conflicts={[createConflict(1), createConflict(2)]}
        onResolve={onResolve}
        onCancel={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: buttonName }))

    expect(onResolve).toHaveBeenCalledWith({
      [testId<'sidebarItems'>('note_1')]: { action },
      [testId<'sidebarItems'>('note_2')]: { action },
    })
  })

  it('applies a bulk decision across larger conflict batches', () => {
    const onResolve = vi.fn()
    render(
      <ItemOperationConflictDialog
        conflicts={[
          createConflict(1),
          createConflict(2, SIDEBAR_ITEM_TYPES.folders),
          createConflict(3, SIDEBAR_ITEM_TYPES.gameMaps),
        ]}
        onResolve={onResolve}
        onCancel={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Keep both items' }))

    expect(onResolve).toHaveBeenCalledWith({
      [testId<'sidebarItems'>('note_1')]: { action: 'keepBoth' },
      [testId<'sidebarItems'>('folder_2')]: { action: 'keepBoth' },
      [testId<'sidebarItems'>('map_3')]: { action: 'keepBoth' },
    })
  })

  it('does not render a visible cancel button on the bulk screen', () => {
    render(
      <ItemOperationConflictDialog
        conflicts={[createConflict(1), createConflict(2)]}
        onResolve={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Decide for each item' })).toBeInTheDocument()
  })

  it('does not show conflict items on the bulk screen', () => {
    render(
      <ItemOperationConflictDialog
        conflicts={[createConflict(1), createConflict(2)]}
        onResolve={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.queryByText('Incoming 1')).not.toBeInTheDocument()
    expect(screen.queryByText('Existing item: Existing 1')).not.toBeInTheDocument()
  })

  it('opens a single conflict on the bulk screen with Windows-style copy', () => {
    render(
      <ItemOperationConflictDialog
        conflicts={[createConflict(1)]}
        onResolve={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(
      screen.getByText('There is already an item with the name "Existing 1" in this destination.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Replace the item in the destination' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Skip this item' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Keep both items' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Compare each item' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Incoming' })).not.toBeInTheDocument()
  })

  it('opens a single conflict comparison from the bulk screen', () => {
    render(
      <ItemOperationConflictDialog
        conflicts={[createConflict(1)]}
        onResolve={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Compare each item' }))

    expect(screen.getByRole('columnheader', { name: 'Incoming' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Existing' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Use incoming Incoming 1' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Compare each item' })).not.toBeInTheDocument()
  })

  it('renders one per-conflict row with incoming and existing choices', () => {
    const onResolve = vi.fn()
    render(
      <ItemOperationConflictDialog
        conflicts={[createConflict(1), createConflict(2)]}
        onResolve={onResolve}
        onCancel={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Decide for each item' }))

    expect(screen.getByRole('columnheader', { name: 'Incoming' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Existing' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Use incoming Incoming 1' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByRole('button', { name: 'Use existing Existing 1' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByRole('button', { name: 'Use incoming Incoming 2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Use existing Existing 2' })).toBeInTheDocument()
    expect(onResolve).not.toHaveBeenCalled()
  })

  it('updates selected state for per-item choices', () => {
    render(
      <ItemOperationConflictDialog
        conflicts={[createConflict(1)]}
        onResolve={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Compare each item' }))
    const incomingButton = screen.getByRole('button', { name: 'Use incoming Incoming 1' })
    expect(incomingButton).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(incomingButton)

    expect(incomingButton).toHaveAttribute('aria-pressed', 'true')
  })

  it('resolves per-row incoming-only as replace', () => {
    const onResolve = vi.fn()
    render(
      <ItemOperationConflictDialog
        conflicts={[createConflict(1)]}
        onResolve={onResolve}
        onCancel={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Compare each item' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use incoming Incoming 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply selected conflict choices' }))

    expect(onResolve).toHaveBeenCalledWith({
      [testId<'sidebarItems'>('note_1')]: { action: 'replace' },
    })
  })

  it('resolves per-row existing-only as skip', () => {
    const onResolve = vi.fn()
    render(
      <ItemOperationConflictDialog
        conflicts={[createConflict(1)]}
        onResolve={onResolve}
        onCancel={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Compare each item' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use existing Existing 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply selected conflict choices' }))

    expect(onResolve).toHaveBeenCalledWith({
      [testId<'sidebarItems'>('note_1')]: { action: 'skip' },
    })
  })

  it('resolves per-row both selected as keep both', () => {
    const onResolve = vi.fn()
    render(
      <ItemOperationConflictDialog
        conflicts={[createConflict(1)]}
        onResolve={onResolve}
        onCancel={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Compare each item' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use incoming Incoming 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use existing Existing 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply selected conflict choices' }))

    expect(onResolve).toHaveBeenCalledWith({
      [testId<'sidebarItems'>('note_1')]: { action: 'keepBoth' },
    })
  })

  it('disables continue when any per-row conflict has neither choice selected', () => {
    render(
      <ItemOperationConflictDialog
        conflicts={[createConflict(1)]}
        onResolve={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Compare each item' }))
    expect(screen.getByRole('button', { name: 'Apply selected conflict choices' })).toBeDisabled()
  })

  it('disables continue when one row in a multi-conflict batch has neither choice selected', () => {
    render(
      <ItemOperationConflictDialog
        conflicts={[createConflict(1), createConflict(2)]}
        onResolve={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Decide for each item' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use incoming Incoming 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use existing Existing 1' }))

    expect(screen.getByRole('button', { name: 'Apply selected conflict choices' })).toBeDisabled()
  })

  it('treats per-item cancel as back to bulk without cancelling the operation', () => {
    const onCancel = vi.fn()
    render(
      <ItemOperationConflictDialog
        conflicts={[createConflict(1), createConflict(2)]}
        onResolve={vi.fn()}
        onCancel={onCancel}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Decide for each item' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Decide for each item' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Apply selected conflict choices' }),
    ).not.toBeInTheDocument()
  })

  it('still cancels the operation when the dialog is dismissed', () => {
    const onCancel = vi.fn()
    render(
      <ItemOperationConflictDialog
        conflicts={[createConflict(1)]}
        onResolve={vi.fn()}
        onCancel={onCancel}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
