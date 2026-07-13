import { UniqueID } from '@blocknote/core'
import { generateUuidV7 } from '../../resources/domain-id'

let configured = false

export function configureBlockNoteUuidV7() {
  if (configured) return

  // BlockNote's public editor options do not expose its ID generator; its exported
  // UniqueID extension is the single generator used by conversions and editors.
  const defaultOptions = UniqueID.options
  UniqueID.config.addOptions = () => ({ ...defaultOptions, generateID: generateUuidV7 })
  configured = true
}
