export interface ResourceArchitectureFile {
  path: string
  source: string
}

export interface ResourceArchitectureViolation {
  className: string
  path: string
}

export function analyzeResourceArchitecture(
  files: Array<ResourceArchitectureFile>,
  packageJson?: { exports?: Record<string, unknown> },
): Array<ResourceArchitectureViolation>

export function loadResourceArchitectureInputs(root?: string): {
  files: Array<ResourceArchitectureFile>
  packageJson: { exports?: Record<string, unknown> }
}
