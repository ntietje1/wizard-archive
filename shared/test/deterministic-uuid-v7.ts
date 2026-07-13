export function deterministicUuidV7(label: string): string {
  const hex = deterministicHex(label)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-7${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

function deterministicHex(input: string): string {
  let stateA = 0x811c9dc5
  let stateB = 0x9e3779b9
  let stateC = 0x85ebca6b
  let stateD = 0xc2b2ae35

  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index)
    stateA = Math.imul(stateA ^ code, 0x01000193) >>> 0
    stateB = Math.imul(stateB ^ (code + index), 0x27d4eb2d) >>> 0
    stateC = Math.imul(stateC + code + (stateA >>> 8), 0x85ebca6b) >>> 0
    stateD = Math.imul(stateD ^ (code << (index % 8)), 0xc2b2ae35) >>> 0
  }

  return [stateA, stateB, stateC, stateD].map((word) => word.toString(16).padStart(8, '0')).join('')
}
