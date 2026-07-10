import { Plugin } from '@tiptap/pm/state'
import type { PluginKey } from '@tiptap/pm/state'

type SelectionPosition = { from: number; to: number }

function isSamePosition(left: SelectionPosition, right: SelectionPosition) {
  return left.from === right.from && left.to === right.to
}

function isAdjacentPosition(left: SelectionPosition, right: SelectionPosition) {
  return Math.abs(left.from - right.from) <= 1 && Math.abs(left.to - right.to) <= 1
}

export function createSelectionStabilizerPlugin(key: PluginKey): Plugin {
  return new Plugin({
    key,
    state: {
      init: () => [],
      apply(tr, lastPositions: Array<SelectionPosition>, oldState) {
        if (tr.docChanged) {
          return []
        }

        const oldSel = oldState.selection
        const newSel = tr.selection
        if (oldSel.from === newSel.from && oldSel.to === newSel.to) {
          return lastPositions
        }

        return appendSelectionPosition(lastPositions, {
          from: newSel.from,
          to: newSel.to,
        })
      },
    },
    filterTransaction(tr, state) {
      // Only filter selection-only transactions
      if (tr.docChanged) {
        return true
      }

      if (!tr.selectionSet) {
        return true
      }

      const oldSel = state.selection
      const newSel = tr.selection

      if (oldSel.from === newSel.from && oldSel.to === newSel.to) {
        return true
      }

      const lastPositions = key.getState(state) as Array<SelectionPosition> | undefined
      const nextPositions = appendSelectionPosition(lastPositions ?? [], {
        from: newSel.from,
        to: newSel.to,
      })

      return !isOscillatingSelection(nextPositions)
    },
  })
}

function appendSelectionPosition(
  positions: Array<SelectionPosition>,
  position: SelectionPosition,
): Array<SelectionPosition> {
  return [...positions, position].slice(-4)
}

function isOscillatingSelection(positions: Array<SelectionPosition>): boolean {
  if (positions.length < 4) return false

  const [p1, p2, p3, p4] = positions.slice(-4)
  return (
    isAdjacentPosition(p1, p2) &&
    isAdjacentPosition(p2, p3) &&
    isAdjacentPosition(p3, p4) &&
    isSamePosition(p1, p3) &&
    isSamePosition(p2, p4)
  )
}
