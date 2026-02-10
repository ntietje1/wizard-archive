import { Plugin } from '@tiptap/pm/state'
import type { PluginKey } from '@tiptap/pm/state'

/**
 * Creates a plugin that prevents selection oscillation caused by font-size:0 decorations.
 * When decorations use font-size:0, ProseMirror's coordinate-to-position mapping can become
 * unstable, causing the selection to oscillate between adjacent positions. This plugin
 * detects this pattern (selection-only transactions that flip-flop by 1 position) and
 * filters them out to prevent infinite loops.
 */
export function createSelectionStabilizerPlugin(key: PluginKey): Plugin {
  // Track recent selection positions to detect oscillation
  let lastPositions: Array<{ from: number; to: number }> = []

  return new Plugin({
    key,
    filterTransaction(tr, state) {
      // Only filter selection-only transactions
      if (tr.docChanged) {
        lastPositions = []
        return true
      }

      if (!tr.selectionSet) {
        return true
      }

      const oldSel = state.selection
      const newSel = tr.selection

      // If selection hasn't actually changed, allow it
      if (oldSel.from === newSel.from && oldSel.to === newSel.to) {
        return true
      }

      // Track this position
      const newPos = { from: newSel.from, to: newSel.to }
      lastPositions.push(newPos)

      // Keep only last 4 positions
      if (lastPositions.length > 4) {
        lastPositions.shift()
      }

      // Detect oscillation pattern: A -> B -> A -> B (positions differ by 1)
      if (lastPositions.length >= 4) {
        const [p1, p2, p3, p4] = lastPositions.slice(-4)
        const isOscillating =
          Math.abs(p1.from - p2.from) <= 1 &&
          Math.abs(p2.from - p3.from) <= 1 &&
          Math.abs(p3.from - p4.from) <= 1 &&
          p1.from === p3.from &&
          p2.from === p4.from &&
          p1.to === p3.to &&
          p2.to === p4.to

        if (isOscillating) {
          // Block this transaction to stop the oscillation
          lastPositions = []
          return false
        }
      }

      return true
    },
  })
}
