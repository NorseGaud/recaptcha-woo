#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Usage:
#   ./build-plugin-zip.bash [plugin_directory] [output_zip]
#
# Examples:
#   ./build-plugin-zip.bash
#   ./build-plugin-zip.bash /Users/nathanpierce/recaptcha-woo
#   ./build-plugin-zip.bash /Users/nathanpierce/recaptcha-woo /Users/nathanpierce/recaptcha-woo-v1.4.7.zip

plugin_directory_path="${1:-$SCRIPT_DIR}"
plugin_directory_path="$(cd "$plugin_directory_path" && pwd)"
plugin_directory_name="$(basename "$plugin_directory_path")"
plugin_main_file_name="${PLUGIN_MAIN_FILE:-recaptcha-woo.php}"
plugin_main_file="${plugin_directory_path}/${plugin_main_file_name}"

if [[ ! -d "$plugin_directory_path" ]]; then
  echo "Error: plugin directory does not exist: $plugin_directory_path" >&2
  exit 1
fi

if ! command -v zip >/dev/null 2>&1; then
  echo "Error: 'zip' command is required but not installed." >&2
  exit 1
fi

plugin_version=""
if [[ -f "$plugin_main_file" ]]; then
  plugin_version="$(sed -n 's/^.*Version:[[:space:]]*//p' "$plugin_main_file" | sed -n '1{s/[[:space:]]*$//;p;}')"
fi

output_zip_path="${2:-/tmp/${plugin_directory_name}${plugin_version:+-${plugin_version}}.zip}"
output_zip_directory="$(dirname "$output_zip_path")"
mkdir -p "$output_zip_directory"
output_zip_path="$(cd "$output_zip_directory" && pwd)/$(basename "$output_zip_path")"

package_root_path="$(mktemp -d)"
package_plugin_path="${package_root_path}/${plugin_directory_name}"

cleanup() {
  rm -rf "$package_root_path"
}
trap cleanup EXIT

mkdir -p "$package_plugin_path"

if [[ -f "$output_zip_path" ]]; then
  rm -f "$output_zip_path"
fi

rsync -a "${plugin_directory_path}/" "${package_plugin_path}/" \
  --exclude '.git/' \
  --exclude '.github/' \
  --exclude '.cursor/' \
  --exclude '.idea/' \
  --exclude '.vscode/' \
  --exclude 'node_modules/' \
  --exclude '*.zip' \
  --exclude '*.DS_Store'

(
  cd "$package_root_path"
  zip -rq "$output_zip_path" "$plugin_directory_name"
)

echo "Plugin zip created:"
echo "$output_zip_path"
