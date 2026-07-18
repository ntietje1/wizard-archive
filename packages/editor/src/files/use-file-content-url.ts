import { useEffect, useState } from 'react'
import type { VersionStamp } from '../resources/component-version'
import type { FileContentSource } from '../resources/content-session-contract'
import { beginContentObjectUrlLoad } from '../resources/content-object-url'
import type { ContentObjectUrlState } from '../resources/content-object-url'
import type { ResourceId } from '../resources/domain-id'

export function useFileContentUrl(
  source: FileContentSource,
  resourceId: ResourceId,
  version: VersionStamp,
) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<ContentObjectUrlState>({ status: 'loading' })

  useEffect(
    () => beginContentObjectUrlLoad(() => source.export(resourceId), setState),
    [attempt, resourceId, source, version.digest, version.revision, version.scheme],
  )

  return { retry: () => setAttempt((current) => current + 1), state }
}
