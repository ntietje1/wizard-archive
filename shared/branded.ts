export type BrandedString<Kind extends string> = string & { readonly __brand: Kind }

export function brandString<Kind extends string>(value: string): BrandedString<Kind> {
  return value as BrandedString<Kind>
}
