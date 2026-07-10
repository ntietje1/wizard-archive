export function uint8ToArrayBuffer(uint8: Uint8Array): ArrayBuffer {
  if (uint8.byteOffset === 0 && uint8.byteLength === uint8.buffer.byteLength) {
    // The full-buffer path intentionally returns the same ArrayBuffer to avoid copying.
    return uint8.buffer as ArrayBuffer
  }
  return uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength) as ArrayBuffer
}
