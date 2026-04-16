#!/usr/bin/env bash

set -euo pipefail

output_path="${1:?Missing output path}"

required_vars=(
  BETTER_AUTH_SECRET
  SITE_URL
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  RESEND_API_KEY
)

for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "Missing required environment variable: ${var_name}" >&2
    exit 1
  fi
done

umask 077
{
  for var_name in "${required_vars[@]}"; do
    printf '%s=%s\n' "$var_name" "${!var_name}"
  done
} > "$output_path"
