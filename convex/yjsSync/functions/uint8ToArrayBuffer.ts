export function uint8ToArrayBuffer(uint8: Uint8Array): ArrayBuffer {
  return uint8.buffer.slice(
    uint8.byteOffset,
    uint8.byteOffset + uint8.byteLength,
  ) as ArrayBuffer
}
