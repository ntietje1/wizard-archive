const KIBIBYTE = 1024

export const CANVAS_WORKLOAD_LIMITS = Object.freeze({
  encodedBytes: 512 * KIBIBYTE,
  serializedContentBytes: 256 * KIBIBYTE,
  nodes: 512,
  edges: 1024,
  textCharactersPerNode: 8192,
  textBlocksPerNode: 256,
  textRunsPerNode: 2048,
  textDepth: 16,
  pointsPerStroke: 2048,
  selectedElements: 128,
  gesturePoints: 512,
  candidateWorkPerGesture: 12_288,
})

type CanvasWorkloadContent = Readonly<{
  nodes: ReadonlyArray<unknown>
  edges: ReadonlyArray<unknown>
}>

export function canvasEncodedBytesWithinWorkload(bytes: Readonly<{ byteLength: number }>): boolean {
  return bytes.byteLength <= CANVAS_WORKLOAD_LIMITS.encodedBytes
}

export function canvasContentWithinWorkload(content: CanvasWorkloadContent): boolean {
  if (
    content.nodes.length > CANVAS_WORKLOAD_LIMITS.nodes ||
    content.edges.length > CANVAS_WORKLOAD_LIMITS.edges
  ) {
    return false
  }
  try {
    return (
      new TextEncoder().encode(JSON.stringify(content)).byteLength <=
      CANVAS_WORKLOAD_LIMITS.serializedContentBytes
    )
  } catch {
    return false
  }
}

type CanvasTextWorkloadState = {
  blocks: number
  characters: number
  runs: number
  values: number
}

export function canvasTextWithinWorkload(value: unknown): boolean {
  const stack: Array<Readonly<{ value: unknown; depth: number }>> = [{ value, depth: 0 }]
  const seen = new Set<object>()
  const state: CanvasTextWorkloadState = { blocks: 0, characters: 0, runs: 0, values: 0 }
  const maximumValues =
    CANVAS_WORKLOAD_LIMITS.textCharactersPerNode +
    (CANVAS_WORKLOAD_LIMITS.textBlocksPerNode + CANVAS_WORKLOAD_LIMITS.textRunsPerNode) * 8

  while (stack.length > 0) {
    const current = stack.pop()!
    state.values += 1
    if (state.values > maximumValues) return false
    if (!visitCanvasTextValue(current, state, stack, seen)) return false
  }
  return true
}

function visitCanvasTextValue(
  current: Readonly<{ value: unknown; depth: number }>,
  state: CanvasTextWorkloadState,
  stack: Array<Readonly<{ value: unknown; depth: number }>>,
  seen: Set<object>,
): boolean {
  if (current.depth > CANVAS_WORKLOAD_LIMITS.textDepth) return false
  if (!current.value || typeof current.value !== 'object') return true
  if (seen.has(current.value)) return false
  seen.add(current.value)
  if (!Array.isArray(current.value) && !measureCanvasTextRecord(current.value, state)) return false
  const children = Array.isArray(current.value)
    ? current.value
    : Object.values(current.value as Record<string, unknown>)
  for (const child of children) stack.push({ value: child, depth: current.depth + 1 })
  return true
}

function measureCanvasTextRecord(value: object, state: CanvasTextWorkloadState): boolean {
  const record = value as Record<string, unknown>
  if (record.type !== 'text') {
    if (!Object.hasOwn(record, 'type')) return true
    state.blocks += 1
    return state.blocks <= CANVAS_WORKLOAD_LIMITS.textBlocksPerNode
  }
  state.runs += 1
  if (state.runs > CANVAS_WORKLOAD_LIMITS.textRunsPerNode) return false
  if (typeof record.text !== 'string') return true
  state.characters += record.text.length
  return state.characters <= CANVAS_WORKLOAD_LIMITS.textCharactersPerNode
}

export function canvasSelectionWithinWorkload(selection: {
  nodeIds: ReadonlySet<unknown>
  edgeIds: ReadonlySet<unknown>
}): boolean {
  return selection.nodeIds.size + selection.edgeIds.size <= CANVAS_WORKLOAD_LIMITS.selectedElements
}

export interface CanvasCandidateWorkBudget {
  readonly exhausted: boolean
  readonly remaining: number
  consume(): boolean
}

export function createCanvasCandidateWorkBudget(): CanvasCandidateWorkBudget {
  return new CandidateWorkBudget()
}

class CandidateWorkBudget implements CanvasCandidateWorkBudget {
  #exhausted = false
  #remaining: number = CANVAS_WORKLOAD_LIMITS.candidateWorkPerGesture

  get exhausted(): boolean {
    return this.#exhausted
  }

  get remaining(): number {
    return this.#remaining
  }

  consume(): boolean {
    if (this.#remaining === 0) {
      this.#exhausted = true
      return false
    }
    this.#remaining -= 1
    return true
  }
}
