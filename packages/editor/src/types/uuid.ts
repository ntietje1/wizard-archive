export function formatUuid(bytes: Uint8Array): string {
  if (bytes.length !== 16) throw new RangeError('A UUID requires exactly 16 bytes')
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return hex.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5')
}
