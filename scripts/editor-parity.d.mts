export interface EditorParityFile {
  path: string
  source: string
}

export interface EditorParityViolation {
  className: string
  path: string
}

export interface EditorParityContract {
  reference: {
    mergeBase: string
    rule: string
    visualSurfaces: Array<string>
  }
  slices: Array<string>
  commitAfterEverySlice: boolean
  obsoleteAssertions: Array<string>
  requiredBehaviorOwners: Record<string, Array<string>>
  deletedPathOwners: Array<{
    cluster: string
    pattern: RegExp
    owners: Array<string>
    disposition: string
  }>
  deletedE2eOwners: Array<{ owners: Array<string>; specs: Array<string> }>
  acceptanceSurfaces: Array<{
    id: string
    owner: string
    source: RegExp
    test: RegExp
  }>
  forbiddenPlaceholders: Array<{ id: string; pattern: RegExp }>
}

export function analyzeEditorParityContract(
  contract: EditorParityContract,
  deletedPaths: Array<string>,
): Array<EditorParityViolation>

export function analyzeEditorParityAcceptance(
  contract: EditorParityContract,
  files: Array<EditorParityFile>,
): Array<EditorParityViolation>

export function loadEditorParityInputs(root?: string): {
  deletedPaths: Array<string>
  files: Array<EditorParityFile>
}
