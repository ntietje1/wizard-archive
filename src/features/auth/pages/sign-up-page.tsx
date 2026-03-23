import { AuthPageLayout } from '../components/AuthPageLayout'
import { SignUpForm } from '../components/SignUpForm'

export function SignUpPage() {
  return (
    <AuthPageLayout>
      <SignUpForm redirectTo="/campaigns" />
    </AuthPageLayout>
  )
}
