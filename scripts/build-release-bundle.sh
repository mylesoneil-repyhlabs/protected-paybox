#!/usr/bin/env bash
set -euo pipefail

REPOSITORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
if (( $# > 2 )); then
  echo "Usage: $0 [commit-or-tag] [output-directory]" >&2
  exit 1
fi

RELEASE_REF="${1:-HEAD}"
if [[ ! "$RELEASE_REF" =~ ^[A-Za-z0-9._/-]+$ ]]; then
  echo "Release ref contains unsupported characters: $RELEASE_REF" >&2
  exit 1
fi

OUTPUT_DIRECTORY="${2:-$REPOSITORY_ROOT/artifacts}"
mkdir -p "$OUTPUT_DIRECTORY"
OUTPUT_DIRECTORY="$(cd "$OUTPUT_DIRECTORY" && pwd -P)"

RELEASE_COMMIT="$(
  git -C "$REPOSITORY_ROOT" rev-parse --verify "${RELEASE_REF}^{commit}"
)"

BUILD_DIRECTORY="$(
  mktemp -d "${TMPDIR:-/tmp}/protected-paybox-release.XXXXXX"
)"
cleanup() {
  rm -rf -- "$BUILD_DIRECTORY"
}
trap cleanup EXIT HUP INT TERM

git -C "$REPOSITORY_ROOT" show \
  "$RELEASE_COMMIT:package.json" > "$BUILD_DIRECTORY/package.json"

compatible_node() {
  local candidate="$1"
  local major
  [[ -x "$candidate" ]] || return 1
  major="$(
    "$candidate" -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null
  )" || return 1
  [[ "$major" =~ ^[0-9]+$ ]] && (( major >= 22 ))
}

NODE_BINARY=""
if [[ -n "${PROTECTED_PAYBOX_NODE_BINARY:-}" ]] && \
  compatible_node "$PROTECTED_PAYBOX_NODE_BINARY"; then
  NODE_BINARY="$PROTECTED_PAYBOX_NODE_BINARY"
elif command -v node >/dev/null 2>&1 && \
  compatible_node "$(command -v node)"; then
  NODE_BINARY="$(command -v node)"
elif [[ -n "${HOME:-}" ]]; then
  for candidate in \
    "$HOME"/.cache/codex-runtimes/*/dependencies/node/bin/node; do
    if compatible_node "$candidate"; then
      NODE_BINARY="$candidate"
      break
    fi
  done
fi
if [[ -z "$NODE_BINARY" ]]; then
  echo "Node.js 22 or newer is required to build a release bundle." >&2
  exit 1
fi
NODE_BINARY="$(
  "$NODE_BINARY" -p 'require("node:fs").realpathSync(process.execPath)'
)"

VERSION="$(
  "$NODE_BINARY" -e \
    'const p = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")); process.stdout.write(String(p.version ?? ""));' \
    "$BUILD_DIRECTORY/package.json"
)"
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "package.json at $RELEASE_COMMIT has an invalid version: $VERSION" >&2
  exit 1
fi
if [[ "$RELEASE_REF" == v* ]] && [[ "$RELEASE_REF" != "v$VERSION" ]]; then
  echo "Tag $RELEASE_REF does not match package version $VERSION." >&2
  exit 1
fi

ARCHIVE_STEM="protected-paybox-v$VERSION"
ARCHIVE_NAME="$ARCHIVE_STEM.zip"
ARCHIVE_PREFIX="$ARCHIVE_STEM/"
ARCHIVE_LIST="$BUILD_DIRECTORY/archive-list.txt"
mkdir -p "$BUILD_DIRECTORY/first" "$BUILD_DIRECTORY/second"
FIRST_ARCHIVE="$BUILD_DIRECTORY/first/$ARCHIVE_NAME"
SECOND_ARCHIVE="$BUILD_DIRECTORY/second/$ARCHIVE_NAME"

RELEASE_PATHS=(
  ".github/workflows/ci.yml"
  ".nvmrc"
  "README.md"
  "package.json"
  "install"
  "run"
  "config"
  "docs"
  "examples"
  "scripts/build-release-bundle.sh"
  "scripts/check-local-links.mjs"
  "scripts/install-managed-copy.mjs"
  "scripts/scan-release-content.mjs"
  "scripts/validate-release-bundle.sh"
  "scripts/validate-release-metadata.mjs"
  "scripts/validate-skill.mjs"
  "skills"
  "src"
  "test"
)
for release_path in "${RELEASE_PATHS[@]}"; do
  if ! git -C "$REPOSITORY_ROOT" cat-file -e \
    "$RELEASE_COMMIT:$release_path"; then
    echo "Release commit is missing allowlisted path: $release_path" >&2
    exit 1
  fi
done

for trusted_script in \
  "scripts/build-release-bundle.sh" \
  "scripts/scan-release-content.mjs" \
  "scripts/validate-release-bundle.sh"; do
  committed_copy="$BUILD_DIRECTORY/$(basename "$trusted_script").committed"
  git -C "$REPOSITORY_ROOT" show \
    "$RELEASE_COMMIT:$trusted_script" > "$committed_copy"
  if ! cmp -s "$REPOSITORY_ROOT/$trusted_script" "$committed_copy"; then
    echo "$trusted_script must match the committed release ref." >&2
    exit 1
  fi
done
COMMITTED_SCANNER="$BUILD_DIRECTORY/scan-release-content.mjs.committed"

git -C "$REPOSITORY_ROOT" archive \
  --format=zip \
  --prefix="$ARCHIVE_PREFIX" \
  --output="$FIRST_ARCHIVE" \
  "$RELEASE_COMMIT" \
  -- \
  "${RELEASE_PATHS[@]}"
git -C "$REPOSITORY_ROOT" archive \
  --format=zip \
  --prefix="$ARCHIVE_PREFIX" \
  --output="$SECOND_ARCHIVE" \
  "$RELEASE_COMMIT" \
  -- \
  "${RELEASE_PATHS[@]}"
if ! cmp -s "$FIRST_ARCHIVE" "$SECOND_ARCHIVE"; then
  echo "git archive did not produce a deterministic bundle." >&2
  exit 1
fi

unzip -Z1 "$FIRST_ARCHIVE" > "$ARCHIVE_LIST"
for required_file in \
  ".github/workflows/ci.yml" \
  "README.md" \
  "config/paybox-signing-hook.v1.schema.json" \
  "docs/PAYBOX-SIGNING-HOOK-CONFORMANCE.md" \
  "docs/SOLANA-EVIDENCE-CONTRACT.md" \
  "examples/paybox-tools-list.fixture.json" \
  "install" \
  "package.json" \
  "run" \
  "skills/protected-paybox/SKILL.md" \
  "src/cli.js" \
  "src/integration/production-composition.js" \
  "src/integration/paybox-hook-contract.js" \
  "test/install.test.js" \
  "test/paybox-hook-contract.test.js" \
  "test/release-content-scan.test.js"; do
  if ! grep -Fqx "$ARCHIVE_PREFIX$required_file" "$ARCHIVE_LIST"; then
    echo "Release archive is missing required file: $required_file" >&2
    exit 1
  fi
done

while IFS= read -r archive_path; do
  if [[ "$archive_path" != "$ARCHIVE_PREFIX"* ]]; then
    echo "Release archive contains a path outside its versioned root." >&2
    exit 1
  fi
  relative_path="${archive_path#"$ARCHIVE_PREFIX"}"
  case "$relative_path" in
    ""|*/|.github/workflows/ci.yml|.nvmrc|README.md|package.json|install|run|\
    config/*|docs/*|examples/*|skills/*|src/*|test/*|\
    scripts/build-release-bundle.sh|\
    scripts/check-local-links.mjs|\
    scripts/install-managed-copy.mjs|\
    scripts/scan-release-content.mjs|\
    scripts/validate-release-bundle.sh|\
    scripts/validate-release-metadata.mjs|\
    scripts/validate-skill.mjs )
      ;;
    * )
      echo "Release archive contains a path outside the allowlist: $relative_path" >&2
      exit 1
      ;;
  esac
done < "$ARCHIVE_LIST"

SCAN_DIRECTORY="$BUILD_DIRECTORY/content-scan"
mkdir -p "$SCAN_DIRECTORY"
unzip -q "$FIRST_ARCHIVE" -d "$SCAN_DIRECTORY"
"$NODE_BINARY" "$COMMITTED_SCANNER" \
  "$SCAN_DIRECTORY/$ARCHIVE_STEM"

env \
  PROTECTED_PAYBOX_NODE_BINARY="$NODE_BINARY" \
  bash "$SCAN_DIRECTORY/$ARCHIVE_STEM/scripts/validate-release-bundle.sh" \
  "$FIRST_ARCHIVE"

FINAL_ARCHIVE="$OUTPUT_DIRECTORY/$ARCHIVE_NAME"
FINAL_CHECKSUM="$FINAL_ARCHIVE.sha256"
if [[ -e "$FINAL_ARCHIVE" ]] || [[ -e "$FINAL_CHECKSUM" ]]; then
  echo "Refusing to replace an existing release artifact in $OUTPUT_DIRECTORY." >&2
  exit 1
fi
cp "$FIRST_ARCHIVE" "$FINAL_ARCHIVE"
"$NODE_BINARY" -e \
  'const fs = require("node:fs"); const crypto = require("node:crypto"); const p = process.argv[1]; const hash = crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex"); fs.writeFileSync(`${p}.sha256`, `${hash}  ${p.split("/").at(-1)}\n`, { flag: "wx" });' \
  "$FINAL_ARCHIVE"

printf 'Release bundle ready: %s\nChecksum: %s\nCommit: %s\n' \
  "$FINAL_ARCHIVE" \
  "$FINAL_CHECKSUM" \
  "$RELEASE_COMMIT"
