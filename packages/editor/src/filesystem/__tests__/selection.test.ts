import { testResourceId } from '../../../../../shared/test/resource-id'
import { describe, expect, it } from 'vite-plus/test'
import { createCurrentItemFileSystemSelection } from '../selection'

describe('filesystem selection', () => {
  it('preserves the original anchor across reverse range extensions', () => {
    const a = testResourceId('item_a')
    const b = testResourceId('item_b')
    const c = testResourceId('item_c')
    const d = testResourceId('item_d')
    const selection = createCurrentItemFileSystemSelection(null)

    selection.selectSingleItem(d)
    selection.selectItemRange(b, [a, b, c, d])
    selection.selectItemRange(a, [a, b, c, d])

    expect(selection.selectedItemIds).toEqual([a, b, c, d])
    expect(selection.focusedItemId).toBe(a)
  })

  it('extends keyboard ranges from the visible focus when the stored anchor is hidden', () => {
    const hidden = testResourceId('hidden_item')
    const a = testResourceId('item_a')
    const b = testResourceId('item_b')
    const c = testResourceId('item_c')
    const selection = createCurrentItemFileSystemSelection(null)

    selection.setSelectedItemIds([hidden], hidden)
    selection.setFocusedItem(a)
    selection.moveFocus('down', [a, b, c], true)
    selection.moveFocus('down', [a, b, c], true)

    expect(selection.selectedItemIds).toEqual([a, b, c])
    expect(selection.anchorItemId).toBe(a)
    expect(selection.focusedItemId).toBe(c)
  })

  it('keeps exposed selected ids detached from internal selection state', () => {
    const a = testResourceId('item_a')
    const b = testResourceId('item_b')
    const leakedSelection = testResourceId('mutated_outside')
    const selection = createCurrentItemFileSystemSelection(null)

    selection.setSelectedItemIds([a, b], a)
    ;(selection.getSelectionSnapshot().selectedItemIds as Array<unknown>).push(leakedSelection)
    ;(selection.selectedItemIds as Array<unknown>).push(leakedSelection)

    expect(selection.getSelectionSnapshot().selectedItemIds).toEqual([a, b])
    expect(selection.selectedItemIds).toEqual([a, b])
  })
})
