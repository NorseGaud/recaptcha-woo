#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$( cd -P "$( dirname "$(readlink -f "${BASH_SOURCE[0]}")" )" && pwd )"

# Usage:
#   ./build-plugin-zip.sh [plugin_directory] [output_zip]
#
# Examples:
#   ./build-plugin-zip.sh
#   ./build-plugin-zip.sh /Users/nathanpierce/recaptcha-woo
#   ./build-plugin-zip.sh /Users/nathanpierce/recaptcha-woo /Users/nathanpierce/recaptcha-woo-v1.4.7.zip


if [[ ! -d "$SCRIPT_DIR" ]]; then
  echo "Error: script directory does not exist: $SCRIPT_DIR" >&2
  exit 1
fi

if ! command -v zip >/dev/null 2>&1; then
  echo "Error: 'zip' command is required but not installed." >&2
  exit 1
fi

plugin_directory_path="$(cd "$SCRIPT_DIR" && pwd)"
plugin_directory_name="$(basename "$SCRIPT_DIR")"
plugin_main_file="${SCRIPT_DIR}/recaptcha-woo.php"
plugin_version=""
if [[ -f "$plugin_main_file" ]]; then
  plugin_version=$(grep -m1 '\* Version:' "$plugin_main_file" | sed 's/.*Version: *//;s/[[:space:]]*$//')
fi
output_zip_path="/tmp/${plugin_directory_name}${plugin_version:+-${plugin_version}}.zip"

exclude_patterns=(
  "*.DS_Store"
  "*/.git/*"
  "*/node_modules/*"
  "*/.cursor/*"
  "*/.idea/*"
  "*/.vscode/*"
)

if [[ -f "$output_zip_path" ]]; then
  rm -f "$output_zip_path"
fi

(
  cd "$SCRIPT_DIR"
  zip -r "$output_zip_path" "$SCRIPT_DIR" -x "${exclude_patterns[@]}" >/dev/null
)

echo "Plugin zip created:"
echo "$output_zip_path"
