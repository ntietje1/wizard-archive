import { PanelLeft, PanelLeftOpen } from 'lucide-react'
import { Button } from '~/features/shadcn/components/button'
import { usePanelPreference } from '~/features/settings/hooks/use-panel-preference'
import {
  LEFT_SIDEBAR_DEFAULTS,
  LEFT_SIDEBAR_PANEL_ID,
} from '~/features/sidebar/components/sidebar-toolbar/constants'

export function CollapseToggle() {
  const { visible, setVisible } = usePanelPreference(
    LEFT_SIDEBAR_PANEL_ID,
    LEFT_SIDEBAR_DEFAULTS,
  )

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setVisible(!visible)}
      aria-label={visible ? 'Collapse sidebar' : 'Expand sidebar'}
    >
      {visible ? (
        <PanelLeft className="h-4 w-4" />
      ) : (
        <PanelLeftOpen className="h-4 w-4" />
      )}
    </Button>
  )
}
