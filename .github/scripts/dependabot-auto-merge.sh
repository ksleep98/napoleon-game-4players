#!/usr/bin/env bash
# Dependabot PR を自動マージしてよいか判定する。マージ・rebase 依頼は呼び出し側
# （.github/workflows/dependabot-auto-merge.yml）が行い、ここでは状態を1行で出力する。
#
# Usage: dependabot-auto-merge.sh <PR number>
# Output (stdout):
#   ELIGIBLE <headRefOid> <mergeStateStatus> <checks: pass|pending|fail> <committedDate>
#   HOLD <理由>
#
# ELIGIBLE の条件（すべて満たすこと）:
#   - develop 向けの OPEN な Dependabot PR で、コミットが Dependabot の1つだけ
#   - github_actions 以外のエコシステム（タグの付け替えを公開日で検知できないため）
#   - semver-major を含まない
#   - コミットメッセージに載った依存と、lockfile の差分で新たに追加された全パッケージの
#     公開日をレジストリで確認でき、すべて MIN_AGE_DAYS 日以上経っている
#
# Dependabot の cooldown はセキュリティ更新には適用されず、推移的依存の更新にも
# 効かない。公開直後の版を自動で取り込まないための歯止めがこの公開日チェック。
set -euo pipefail

MIN_AGE_DAYS="${MIN_AGE_DAYS:-7}"
MAX_PACKAGES="${MAX_PACKAGES:-80}"
MAJOR_MARKER='<!-- dependabot-auto-merge:major -->'
pr="$1"

hold() {
  echo "HOLD $*"
  exit 0
}

info=$(gh pr view "$pr" --json state,author,baseRefName,headRefName,headRefOid,mergeStateStatus,commits,comments)

if [ "$(jq -r '.state' <<<"$info")" != "OPEN" ] ||
  [ "$(jq -r '.author.login' <<<"$info")" != "app/dependabot" ] ||
  [ "$(jq -r '.baseRefName' <<<"$info")" != "develop" ]; then
  hold "not an open Dependabot PR to develop"
fi

# 第三者のコミットが混ざった PR は対象外（メタデータも差分も信用できなくなる）
if [ "$(jq -r '(.commits | length) == 1 and (.commits[0].authors | all(.login == "dependabot[bot]"))' <<<"$info")" != "true" ]; then
  hold "contains commits not authored solely by Dependabot"
fi

head_oid=$(jq -r '.headRefOid' <<<"$info")
committed_at=$(jq -r '.commits[0].committedDate' <<<"$info")
merge_state=$(jq -r '.mergeStateStatus' <<<"$info")
ecosystem=$(jq -r '.headRefName | split("/")[1]' <<<"$info")

case "$ecosystem" in
  npm_and_yarn | uv | pip) ;;
  *) hold "ecosystem '${ecosystem}' is reviewed manually" ;;
esac

# コミットメッセージの updated-dependencies ブロックから「名前 版 update-type」を抜き出す
meta=$(jq -r '.commits[0].messageBody' <<<"$info" | awk '
  function unq(s) { gsub(/^"|"$/, "", s); return s }
  /^updated-dependencies:/ { f = 1; next }
  f && /^\.\.\./ { f = 0 }
  f && /^- dependency-name:/ { if (n != "") print n, v, u; n = unq($3); v = "-"; u = "-" }
  f && /^  dependency-version:/ { v = unq($2) }
  f && /^  update-type:/ { u = unq($2) }
  END { if (n != "") print n, v, u }
')

if [ -z "$meta" ]; then
  hold "no updated-dependencies metadata"
fi

if grep -q 'version-update:semver-major' <<<"$meta"; then
  if [ -z "${DRY_RUN:-}" ] &&
    [ "$(jq -r --arg m "$MAJOR_MARKER" '[.comments[] | select(.body | contains($m))] | length' <<<"$info")" = "0" ]; then
    gh pr comment "$pr" --body "${MAJOR_MARKER}
major 更新を含むため自動マージの対象外です。変更内容を確認してから手動でマージしてください。" >/dev/null
  fi
  hold "contains a semver-major update"
fi

# lockfile で新たに入るパッケージ（推移的依存を含む）。PR のファイルは checkout せず、
# データとして取得して読むだけ。
repo="${GH_REPO:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"
diff=$(gh pr diff "$pr")

# pnpm-lock.yaml: 追加された packages / snapshots の "  name@version:" 行（peer 接尾辞は除く）
locked=$(awk '
  /^diff --git / { file = $4; next }
  file ~ /pnpm-lock\.yaml$/ && /^\+  [^ ]/ {
    key = substr($0, 4); sub(/:( .*)?$/, "", key); gsub(/\047/, "", key); sub(/\(.*$/, "", key)
    at = index(substr(key, 2), "@")
    if (at > 0) print substr(key, 1, at), substr(key, at + 2)
  }
' <<<"$diff")

# uv.lock: diff の文脈行では版と配布ファイルの対応が取れない（依存リストが長いと
# 別 hunk になる）ため、PR の親と head の uv.lock 全体を取得して構造で比較する。
# 新しい (name, version) は公開日を確認し、版が同じなのに配布ファイルが変わったもの・
# PyPI 以外の source は検証できないので UNVERIFIED とする。
uv_locks=$(gh pr diff "$pr" --name-only | grep -E '(^|/)uv\.lock$' || true)
if [ -n "$uv_locks" ]; then
  parent=$(gh api "repos/${repo}/commits/${head_oid}" --jq '.parents[0].sha')
  work=$(mktemp -d)
  trap 'rm -rf "$work"' EXIT
  for path in $uv_locks; do
    gh api -H 'Accept: application/vnd.github.raw' "repos/${repo}/contents/${path}?ref=${parent}" >"$work/base.lock"
    gh api -H 'Accept: application/vnd.github.raw' "repos/${repo}/contents/${path}?ref=${head_oid}" >"$work/head.lock"
    locked+=$'\n'$(python3 -I - "$work/base.lock" "$work/head.lock" <<'PY'
import sys
import tomllib

PYPI = {"registry": "https://pypi.org/simple"}


def load(path):
    with open(path, "rb") as f:
        lock = tomllib.load(f)
    packages = {}
    for pkg in lock.get("package", []):
        files = [pkg.get("sdist", {}).get("url", "")]
        files += [w.get("url", "") for w in pkg.get("wheels", [])]
        packages[(pkg["name"], pkg.get("version", ""))] = (pkg.get("source", {}), sorted(files))
    return packages


base, head = load(sys.argv[1]), load(sys.argv[2])
for (name, version), (source, files) in sorted(head.items()):
    if source.get("editable") == "." or source.get("virtual") == ".":
        continue  # このリポジトリ自身
    if source != PYPI:
        print("UNVERIFIED", f"source-of-{name}")
    elif (name, version) not in base:
        print(name, version)
    elif base[(name, version)][1] != files:
        print("UNVERIFIED", f"files-of-{name}")
PY
)
  done
fi
locked=$(sed '/^$/d' <<<"$locked" | sort -u)

if grep -q '^UNVERIFIED ' <<<"$locked"; then
  hold "lockfile changes that cannot be age-checked: $(grep '^UNVERIFIED ' <<<"$locked" | awk '{ print $2 }' | tr '\n' ' ')"
fi

deps=$( (
  awk '{ print $1, $2 }' <<<"$meta"
  if [ -n "$locked" ]; then echo "$locked"; fi
) | sort -u)

count=$(wc -l <<<"$deps" | tr -d ' ')
if [ "$count" -gt "$MAX_PACKAGES" ]; then
  hold "${count} packages changed (> ${MAX_PACKAGES}); review manually"
fi

published_at() {
  local name="$1" ver="$2"
  case "$ecosystem" in
    npm_and_yarn)
      curl -fsSL "https://registry.npmjs.org/${name/\//%2f}" |
        jq -r --arg v "$ver" '.time[$v] // empty'
      ;;
    uv | pip)
      # 既存リリースに後からファイルを足せるため、最も新しいアップロードで判定する
      curl -fsSL "https://pypi.org/pypi/${name}/${ver}/json" |
        jq -r '[.urls[].upload_time_iso_8601] | max // empty'
      ;;
  esac
}

now=$(date -u +%s)
young=()
while read -r name ver; do
  # 名前・版はメッセージ・差分由来なので、URL に埋め込む前に文字種を制限する
  if ! [[ "$name" =~ ^[A-Za-z0-9@][A-Za-z0-9@._-]*(/[A-Za-z0-9._-]+)?$ && "$ver" =~ ^[A-Za-z0-9][A-Za-z0-9.+_-]*$ ]] ||
    [[ "$name" == *..* ]]; then
    hold "cannot verify '${name} ${ver}'"
  fi
  pub=$(published_at "$name" "$ver" || true)
  if [ -z "$pub" ]; then
    hold "publish date of ${name}@${ver} not found"
  fi
  age_days=$(((now - $(jq -rn --arg d "$pub" '$d | sub("\\.[0-9]+Z$"; "Z") | fromdateiso8601')) / 86400))
  echo "  ${name}@${ver}: ${age_days}d" >&2
  if [ "$age_days" -lt "$MIN_AGE_DAYS" ]; then
    young+=("${name}@${ver}(${age_days}d)")
  fi
done <<<"$deps"

if [ "${#young[@]}" -gt 0 ]; then
  hold "published less than ${MIN_AGE_DAYS} days ago: ${young[*]}"
fi

# 必須以外のチェック（Dependency Review・python-security 等）も含め、全て見る
buckets=$(gh pr checks "$pr" --json bucket --jq '[.[].bucket] | unique | join(",")' 2>/dev/null) || true
case ",${buckets}," in
  *,fail,* | *,cancel,*) checks=fail ;;
  *,pending,* | ,,) checks=pending ;;
  *) checks=pass ;;
esac

echo "ELIGIBLE ${head_oid} ${merge_state} ${checks} ${committed_at}"
