import { AuthPageLayout } from '../components/auth-page-layout'
import { SignUpForm } from '../components/sign-up-form'

export function SignUpPage() {
  return (
    <AuthPageLayout>
      <SignUpForm redirectTo="/campaigns" />
    </AuthPageLayout>
  )
}
