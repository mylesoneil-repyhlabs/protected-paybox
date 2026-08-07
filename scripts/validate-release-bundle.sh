#!/usr/bin/env bash
set -euo pipefail

if (( $# != 1 )); then
  echo "Usage: $0 /absolute/path/to/protected-paybox-vX.Y.Z.zip" >&2
  exit 1
fi

ARCHIVE_PATH="$1"
if [[ ! -f "$ARCHIVE_PATH" ]]; then
  echo "Release archive not found: $ARCHIVE_PATH" >&2
  exit 1
fi
ARCHIVE_DIRECTORY="$(cd "$(dirname "$ARCHIVE_PATH")" && pwd -P)"
ARCHIVE_PATH="$ARCHIVE_DIRECTORY/$(basename "$ARCHIVE_PATH")"

if [[ -n "${PROTECTED_PAYBOX_NODE_BINARY:-}" ]] && \
  [[ -x "$PROTECTED_PAYBOX_NODE_BINARY" ]]; then
  NODE_BINARY="$PROTECTED_PAYBOX_NODE_BINARY"
elif command -v node >/dev/null 2>&1; then
  NODE_BINARY="$(command -v node)"
else
  echo "Node.js 22 or newer is required to validate a release bundle." >&2
  exit 1
fi
NODE_BINARY="$(
  "$NODE_BINARY" -p 'require("node:fs").realpathSync(process.execPath)'
)"
NODE_MAJOR="$(
  "$NODE_BINARY" -p 'Number(process.versions.node.split(".")[0])'
)"
if (( NODE_MAJOR < 22 )); then
  echo "Node.js 22 or newer is required." >&2
  exit 1
fi

TEMPORARY_ROOT="$(cd "${TMPDIR:-/tmp}" && pwd -P)"
VALIDATION_DIRECTORY="$(
  mktemp -d "$TEMPORARY_ROOT/protected-paybox-cold-install.XXXXXX"
)"
cleanup() {
  rm -rf -- "$VALIDATION_DIRECTORY"
}
trap cleanup EXIT HUP INT TERM

ARCHIVE_LIST="$VALIDATION_DIRECTORY/archive-list.txt"
unzip -Z1 "$ARCHIVE_PATH" > "$ARCHIVE_LIST"
while IFS= read -r archive_path; do
  case "$archive_path" in
    ""|/*|../*|*/../*|*/..|*\\* )
      echo "Release archive contains an unsafe path: $archive_path" >&2
      exit 1
      ;;
  esac
done < "$ARCHIVE_LIST"

TOP_LEVEL="$(
  awk -F/ 'NF > 0 && length($1) > 0 { print $1 }' "$ARCHIVE_LIST" |
    sort -u
)"
if [[ -z "$TOP_LEVEL" ]] || [[ "$TOP_LEVEL" == *$'\n'* ]]; then
  echo "Release archive must contain exactly one top-level directory." >&2
  exit 1
fi

unzip -q "$ARCHIVE_PATH" -d "$VALIDATION_DIRECTORY/extracted"
RELEASE_ROOT="$VALIDATION_DIRECTORY/extracted/$TOP_LEVEL"
if [[ ! -d "$RELEASE_ROOT" ]]; then
  echo "Release archive did not extract to the expected root." >&2
  exit 1
fi
RELEASE_ROOT="$(cd "$RELEASE_ROOT" && pwd -P)"
if find "$RELEASE_ROOT" -type l -print -quit | grep -q .; then
  echo "Release archive must not contain symlinks." >&2
  exit 1
fi

PACKAGE_VERSION="$(
  "$NODE_BINARY" -e \
    'const p = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")); process.stdout.write(String(p.version ?? ""));' \
    "$RELEASE_ROOT/package.json"
)"
EXPECTED_ROOT="protected-paybox-v$PACKAGE_VERSION"
if [[ "$TOP_LEVEL" != "$EXPECTED_ROOT" ]]; then
  echo "Archive root does not match package version." >&2
  exit 1
fi
if [[ "$(basename "$ARCHIVE_PATH")" != "$EXPECTED_ROOT.zip" ]]; then
  echo "Archive filename does not match package version." >&2
  exit 1
fi

"$NODE_BINARY" "$RELEASE_ROOT/scripts/validate-release-metadata.mjs" \
  "$RELEASE_ROOT"
"$NODE_BINARY" "$RELEASE_ROOT/scripts/validate-skill.mjs"
"$NODE_BINARY" "$RELEASE_ROOT/scripts/check-local-links.mjs" \
  "$RELEASE_ROOT"
"$NODE_BINARY" "$RELEASE_ROOT/scripts/scan-release-content.mjs" \
  "$RELEASE_ROOT"
"$NODE_BINARY" --test "$RELEASE_ROOT"/test/*.test.js

COLD_HOME="$VALIDATION_DIRECTORY/home"
CODEX_RUNTIME_NODE="$COLD_HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
mkdir -p "$(dirname "$CODEX_RUNTIME_NODE")"
ln -s "$NODE_BINARY" "$CODEX_RUNTIME_NODE"
INSTALL_OUTPUT="$(
  env -i \
    HOME="$COLD_HOME" \
    PATH="/usr/bin:/bin" \
    "$RELEASE_ROOT/install"
)"
printf '%s\n' "$INSTALL_OUTPUT" |
  grep -Fq "Installed Protected PayBox"
printf '%s\n' "$INSTALL_OUTPUT" |
  grep -Fq "session-only PayBox OAuth discovery"

INSTALLED_SKILL="$COLD_HOME/.agents/skills/protected-paybox"
MANAGED_HARNESS="$COLD_HOME/.local/share/delta/protected-paybox/versions/v$PACKAGE_VERSION"
if [[ ! -L "$INSTALLED_SKILL" ]]; then
  echo "Cold install did not create the expected skill link." >&2
  exit 1
fi
if [[ ! -d "$MANAGED_HARNESS" ]] || [[ -L "$MANAGED_HARNESS" ]]; then
  echo "Cold install did not create a real managed version." >&2
  exit 1
fi
"$NODE_BINARY" "$MANAGED_HARNESS/scripts/scan-release-content.mjs" \
  "$MANAGED_HARNESS" \
  --managed-install

rm -rf -- "$RELEASE_ROOT"
if [[ -e "$RELEASE_ROOT" || -L "$RELEASE_ROOT" ]]; then
  echo "Extracted release could not be removed for post-install checks." >&2
  exit 1
fi

DOCTOR_OUTPUT="$(
  env -i \
    HOME="$COLD_HOME" \
    PATH="/usr/bin:/bin" \
    "$INSTALLED_SKILL/scripts/run" doctor
)"
for expected in \
  "Mode: session-only PayBox OAuth discovery plus local fixtures" \
  "Execution: locked; no payment, signing, swap, or broadcast adapter" \
  "PayBox/network contact during doctor: none"; do
  printf '%s\n' "$DOCTOR_OUTPUT" | grep -Fq "$expected"
done

CARD_BLOCK_OUTPUT="$(
  env -i \
    HOME="$COLD_HOME" \
    PATH="/usr/bin:/bin" \
    "$INSTALLED_SKILL/scripts/run" card-demo \
      --merchant doordash \
      --scenario block-total
)"
for expected in \
  "LOCAL FIXTURE ONLY" \
  "SIMULATED BLOCK" \
  "\$6.48 USD over the authorized total cap" \
  "NO CARD CREATED OR AUTHORIZED"; do
  printf '%s\n' "$CARD_BLOCK_OUTPUT" | grep -Fq "$expected"
done

CARD_PASS_OUTPUT="$(
  env -i \
    HOME="$COLD_HOME" \
    PATH="/usr/bin:/bin" \
    "$INSTALLED_SKILL/scripts/run" card-demo \
      --merchant doordash \
      --scenario pass
)"
printf '%s\n' "$CARD_PASS_OUTPUT" | grep -Fq "SIMULATED PASS"
printf '%s\n' "$CARD_PASS_OUTPUT" | grep -Fq "not permission to pay"

CARD_REVIEW_OUTPUT="$(
  env -i \
    HOME="$COLD_HOME" \
    PATH="/usr/bin:/bin" \
    "$INSTALLED_SKILL/scripts/run" card-demo \
      --merchant doordash \
      --scenario review-incomplete
)"
printf '%s\n' "$CARD_REVIEW_OUTPUT" | grep -Fq "SIMULATED REVIEW"
printf '%s\n' "$CARD_REVIEW_OUTPUT" | grep -Fq "no verified category"

MCP_OUTPUT="$(
  printf '%s\n' \
    '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"protected_paybox_card_demo","arguments":{"merchant":"doordash","scenario":"block-total"},"_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientInfo":{"name":"cold-release-gate","version":"1"},"io.modelcontextprotocol/clientCapabilities":{}}}}' |
    env -i \
      HOME="$COLD_HOME" \
      PATH="/usr/bin:/bin" \
      "$INSTALLED_SKILL/scripts/run" mcp
)"
printf '%s\n' "$MCP_OUTPUT" | grep -Fq '"jsonrpc":"2.0"'
printf '%s\n' "$MCP_OUTPUT" | grep -Fq '"resultType":"complete"'
printf '%s\n' "$MCP_OUTPUT" | grep -Fq '"outcome":"BLOCK"'
printf '%s\n' "$MCP_OUTPUT" | grep -Fq '"authorization_mode":"FIXTURE_AUTO_BOUND_NO_USER_AUTHORIZATION"'

DEMO_OUTPUT="$(
  env -i \
    HOME="$COLD_HOME" \
    PATH="/usr/bin:/bin" \
    "$INSTALLED_SKILL/scripts/run" demo \
      --scenario block-minimum-receive
)"
printf '%s\n' "$DEMO_OUTPUT" | grep -Fq "PROTECTED PAYBOX"
printf '%s\n' "$DEMO_OUTPUT" | grep -Fq "BLOCK"
printf '%s\n' "$DEMO_OUTPUT" | grep -Fq "NO PAYBOX TOOL CALL"

INSPECT_OUTPUT="$(
  env -i \
    HOME="$COLD_HOME" \
    PATH="/usr/bin:/bin" \
    "$INSTALLED_SKILL/scripts/run" inspect-tools \
      --capture "$MANAGED_HARNESS/examples/paybox-tools-list.fixture.json"
)"
printf '%s\n' "$INSPECT_OUTPUT" | grep -Fq "OFFLINE CAPTURE ANALYSIS"
printf '%s\n' "$INSPECT_OUTPUT" | grep -Fq "no OAuth"

LOCK_OUTPUT="$VALIDATION_DIRECTORY/execution-lock.txt"
if env -i \
  HOME="$COLD_HOME" \
  PATH="/usr/bin:/bin" \
  "$INSTALLED_SKILL/scripts/run" execute \
  > "$LOCK_OUTPUT" 2>&1; then
  echo "Cold-installed execute command unexpectedly succeeded." >&2
  exit 1
fi
grep -Fq "PUBLIC_EXECUTION_LOCKED" "$LOCK_OUTPUT"

printf 'Release bundle cold-install validation passed: %s (Node %s, restricted PATH, source deleted).\n' \
  "$(basename "$ARCHIVE_PATH")" \
  "$("$NODE_BINARY" --version)"
