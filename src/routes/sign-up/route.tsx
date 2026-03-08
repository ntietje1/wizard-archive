import { createFileRoute } from '@tanstack/react-router'
import { SignUpForm } from '~/components/auth/SignUpForm'

export const Route = createFileRoute('/sign-up')({
  component: SignUpPage,
})

function SignUpPage() {
  return (
    <div className="flex items-center justify-center h-screen bg-muted">
      <SignUpForm redirectTo="/campaigns" />
    </div>
  )
}
