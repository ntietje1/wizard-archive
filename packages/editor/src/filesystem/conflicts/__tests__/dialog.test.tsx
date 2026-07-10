import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { ItemOperationConflictDialog } from '../dialog'
import type { SidebarItemId } from '../../../../../../shared/common/ids'
import type { ItemOperationConflict } from '../../operation-planner'
import { RESOURCE_TYPES } from '../../../workspace/items-persistence-contract'

function sidebarItemId(value: string): SidebarItemId {
  return value as SidebarItemId
}

function createConflict(
  index: number,
  sourceType: ItemOperationConflict['sourceType'] = RESOURCE_TYPES.notes,
  destinationType: ItemOperationConflict['destinationType'] = sourceType,
): ItemOperationConflict {
  const sourceIdPrefix = {
    [RESOURCE_TYPES.notes]: 'note',
    [RESOURCE_TYPES.folders]: 'folder',
    [RESOURCE_TYPES.gameMaps]: 'map',
    [RESOURCE_TYPES.files]: 'file',
    [RESOURCE_TYPES.canvases]: 'canvas',
  }[sourceType]
  return {
    sourceItemId: sidebarItemId(`${sourceIdPrefix}_${index}`),
    destinationItemId: sidebarItemId(`existing_${index}`),
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
      [sidebarItemId('note_1')]: { action },
      [sidebarItemId('note_2')]: { action },
    })
  })

  it('applies a bulk decision across larger conflict batches', () => {
    const onResolve = vi.fn()
    render(
      <ItemOperationConflictDialog
        conflicts={[
          createConflict(1),
          createConflict(2, RESOURCE_TYPES.folders),
          createConflict(3, RESOURCE_TYPES.gameMaps),
        ]}
        onResolve={onResolve}
        onCancel={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Keep both items' }))

    expect(onResolve).toHaveBeenCalledWith({
      [sidebarItemId('note_1')]: { action: 'keepBoth' },
      [sidebarItemId('folder_2')]: { action: 'keepBoth' },
      [sidebarItemId('map_3')]: { action: 'keepBoth' },
    })
  })

  it('resolves bulk incoming choices as replace for items and merge folder for folders', () => {
    const onResolve = vi.fn()
    render(
      <ItemOperationConflictDialog
        conflicts={[createConflict(1), createConflict(2, RESOURCE_TYPES.folders)]}
        onResolve={onResolve}
        onCancel={vi.fn()}
      />,
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'Replace or merge the items in the destination' }),
    )

    expect(onResolve).toHaveBeenCalledWith({
      [sidebarItemId('note_1')]: { action: 'replace' },
      [sidebarItemId('folder_2')]: { action: 'mergeFolder' },
    })
  })

  it('opens a single conflict on the bulk screen with Windows-style copy', () => {
    render(
      <ItemOperationConflictDialog
        conflicts={[createConflict(1)]}
        onResolve={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Resolve Name Conflict' })).toBeInTheDocument()
    expect(
      screen.getByText('There is already an item with the name "Existing 1" in this destination.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Replace the item in the destination' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Skip this item' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Keep both items' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Compare each item' })).toBeInTheDocument()
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

  it('resolves per-row incoming-only as replace for non-folder conflicts', () => {
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
      [sidebarItemId('note_1')]: { action: 'replace' },
    })
  })

  it('resolves per-row incoming-only as merge folder for folder conflicts', () => {
    const onResolve = vi.fn()
    render(
      <ItemOperationConflictDialog
        conflicts={[createConflict(1, RESOURCE_TYPES.folders)]}
        onResolve={onResolve}
        onCancel={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Compare each item' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use incoming Incoming 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply selected conflict choices' }))

    expect(onResolve).toHaveBeenCalledWith({
      [sidebarItemId('folder_1')]: { action: 'mergeFolder' },
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
      [sidebarItemId('note_1')]: { action: 'skip' },
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
      [sidebarItemId('note_1')]: { action: 'keepBoth' },
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

  it('returns from per-item choices to the bulk screen', () => {
    render(
      <ItemOperationConflictDialog
        conflicts={[createConflict(1), createConflict(2)]}
        onResolve={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Decide for each item' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByRole('button', { name: 'Decide for each item' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Keep both items' })).toBeInTheDocument()
  })

  it('clears per-item choices after returning to the bulk screen', () => {
    render(
      <ItemOperationConflictDialog
        conflicts={[createConflict(1)]}
        onResolve={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Compare each item' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use incoming Incoming 1' }))
    expect(screen.getByRole('button', { name: 'Apply selected conflict choices' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Compare each item' }))

    expect(screen.getByRole('button', { name: 'Use incoming Incoming 1' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByRole('button', { name: 'Apply selected conflict choices' })).toBeDisabled()
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
