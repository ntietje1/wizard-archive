import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { GoogleIcon } from '~/features/auth/utils/custom-icons'
import { isPreview } from '~/shared/utils/preview'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import { Input } from '@wizard-archive/ui/shadcn/components/input'
import { Label } from '@wizard-archive/ui/shadcn/components/label'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@wizard-archive/ui/shadcn/components/tooltip'

type AuthFormShellProps = {
  title: string
  description: ReactNode
  children: ReactNode
}

export function AuthFormShell({ title, description, children }: AuthFormShellProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground text-balance">{description}</p>
      </div>
      {children}
    </div>
  )
}

type AuthStatusMessageProps = {
  title: string
  children: ReactNode
  linkTo: '/forgot-password' | '/sign-in'
  linkLabel: string
}

export function AuthStatusMessage({ title, children, linkTo, linkLabel }: AuthStatusMessageProps) {
  return (
    <AuthFormShell title={title} description={children}>
      <Link
        to={linkTo}
        className="text-sm text-primary underline-offset-4 hover:underline font-medium flex justify-center"
      >
        {linkLabel}
      </Link>
    </AuthFormShell>
  )
}

type AuthGoogleButtonProps = {
  disabled: boolean
  loading: boolean
  onClick: () => void
}

export function AuthGoogleButton({ disabled, loading, onClick }: AuthGoogleButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="w-full" />} disabled={!isPreview}>
        <Button
          variant="outline"
          className="w-full"
          onClick={onClick}
          disabled={disabled || isPreview}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
          Continue with Google
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">
        OAuth is unavailable on preview deployments. Use email and password instead.
      </TooltipContent>
    </Tooltip>
  )
}

type AuthEmailFieldProps = {
  value: string
  onValueChange: (value: string) => void
  disabled: boolean
}

export function AuthEmailField({ value, onValueChange, disabled }: AuthEmailFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="email">Email</Label>
      <Input
        id="email"
        type="email"
        placeholder="you@example.com"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        required
        disabled={disabled}
        autoComplete="email"
      />
    </div>
  )
}

type AuthPasswordFieldProps = {
  id: string
  label: string
  value: string
  onValueChange: (value: string) => void
  disabled: boolean
  autoComplete: string
  placeholder: string
  minLength?: number
  helper?: ReactNode
  labelAction?: ReactNode
}

export function AuthPasswordField({
  id,
  label,
  value,
  onValueChange,
  disabled,
  autoComplete,
  placeholder,
  minLength,
  helper,
  labelAction,
}: AuthPasswordFieldProps) {
  const labelElement = <Label htmlFor={id}>{label}</Label>

  return (
    <div className="flex flex-col gap-2">
      {labelAction ? (
        <div className="flex items-center justify-between">
          {labelElement}
          {labelAction}
        </div>
      ) : (
        labelElement
      )}
      <Input
        id={id}
        type="password"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        required
        disabled={disabled}
        minLength={minLength}
        autoComplete={autoComplete}
      />
      {helper}
    </div>
  )
}
