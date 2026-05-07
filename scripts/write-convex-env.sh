#!/usr/bin/env bash

set -euo pipefail

output_path="${1:?Missing output path}"

escape_env_value() {
  local value="${1//$'\\'/\\\\}"
  value="${value//$'\n'/\\n}"
  value="${value//\"/\\\"}"
  printf '"%s"' "$value"
}

required_vars=(
  BETTER_AUTH_SECRET
  BETTER_AUTH_ALLOWED_HOSTS
  VITE_SITE_URL
  RESEND_API_KEY
)

optional_vars=(
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
)

for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "Missing required environment variable: ${var_name}" >&2
    exit 1
  fi
done

umask 077
temp_output_path="$(mktemp "${output_path}.XXXXXX")"
trap 'rm -f "$temp_output_path"' EXIT

{
  for var_name in "${required_vars[@]}"; do
    printf '%s=%s\n' "$var_name" "$(escape_env_value "${!var_name}")"
  done

  for var_name in "${optional_vars[@]}"; do
    if [[ -n "${!var_name:-}" ]]; then
      printf '%s=%s\n' "$var_name" "$(escape_env_value "${!var_name}")"
    fi
  done
} > "$temp_output_path"

chmod 600 "$temp_output_path"
mv "$temp_output_path" "$output_path"
trap - EXIT
