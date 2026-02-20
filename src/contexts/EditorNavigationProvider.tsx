import { useRef } from 'react'
import type { EditorNavigationValue } from '~/hooks/useEditorNavigationContext'
import { EditorNavigationContext } from '~/hooks/useEditorNavigationContext'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'

/**
 * Provider that instantiates useEditorNavigation once and exposes stable
 * function references via refs. This prevents consumers from re-rendering
 * when useNavigate/useLastEditorItem internal state changes.
 */
export function EditorNavigationProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const navigation = useEditorNavigation()

  const navigationRef = useRef(navigation)
  navigationRef.current = navigation

  const stableValue = useRef<EditorNavigationValue | null>(null)
  if (!stableValue.current) {
    stableValue.current = {
      navigateToItem: (...args) =>
        navigationRef.current.navigateToItem(...args),
      navigateToNote: (...args) =>
        navigationRef.current.navigateToNote(...args),
      navigateToMap: (...args) => navigationRef.current.navigateToMap(...args),
      navigateToFolder: (...args) =>
        navigationRef.current.navigateToFolder(...args),
      navigateToFile: (...args) =>
        navigationRef.current.navigateToFile(...args),
      clearEditorContent: (...args) =>
        navigationRef.current.clearEditorContent(...args),
    }
  }

  return (
    <EditorNavigationContext.Provider value={stableValue.current}>
      {children}
    </EditorNavigationContext.Provider>
  )
}
