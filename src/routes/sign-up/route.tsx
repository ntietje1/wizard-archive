import { createFileRoute } from '@tanstack/react-router'
import { SignUp } from '@clerk/tanstack-react-start'

export const Route = createFileRoute('/sign-up')({
  component: SignUpPage,
})

function SignUpPage() {
  const redirectUrl = '/auth-redirect'

  return (
    <div className="flex items-center justify-center h-screen">
      <SignUp routing="virtual" fallbackRedirectUrl={redirectUrl} />
    </div>
  )
}
