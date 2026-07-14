export function normalizeLegacyResourcePathSegment(value: string): string {
  return value.normalize('NFC').trim().toLowerCase()
}
