import { createFileRoute } from '@tanstack/react-router'
import { Settings } from '~/components/auth/Settings'

export const Route = createFileRoute('/_authed/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  return <Settings />
}
