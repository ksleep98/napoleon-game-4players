#!/usr/bin/env bash
# Dependabot PR に auto-merge を予約してよいか判定し、条件を満たせば予約する。
#
# Usage: dependabot-auto-merge.sh <PR number>
#
# 予約する条件（すべて満たすこと）:
#   - develop 向けの OPEN な Dependabot PR で、コミットが Dependabot の1つだけ
#   - semver-major を含まない
#   - 更新対象すべての公開日をレジストリで確認でき、MIN_AGE_DAYS 日以上経っている
#
# Dependabot の cooldown はセキュリティ更新には適用されず、CI の
# `pnpm install --frozen-lockfile` も minimumReleaseAge を見ない。公開直後の版を
# 自動で取り込まないための唯一の歯止めがこの公開日チェック。
set -euo pipefail

MIN_AGE_DAYS="${MIN_AGE_DAYS:-7}"
MAJOR_MARKER='<!-- dependabot-auto-merge:major -->'
pr="$1"

info=$(gh pr view "$pr" --json state,author,baseRefName,headRefName,autoMergeRequest,commits,comments)

if [ "$(jq -r '.state' <<<"$info")" != "OPEN" ] ||
  [ "$(jq -r '.author.login' <<<"$info")" != "app/dependabot" ] ||
  [ "$(jq -r '.baseRefName' <<<"$info")" != "develop" ]; then
  echo "#$pr: not an open Dependabot PR to develop; skip."
  exit 0
fi

if [ "$(jq -r '.autoMergeRequest != null' <<<"$info")" = "true" ]; then
  echo "#$pr: auto-merge already enabled."
  exit 0
fi

# 第三者のコミットが混ざった PR は対象外（メタデータも信用できなくなる）
if [ "$(jq -r '(.commits | length) == 1 and (.commits[0].authors | all(.login == "dependabot[bot]"))' <<<"$info")" != "true" ]; then
  echo "#$pr: contains commits not authored solely by Dependabot; skip."
  exit 0
fi

ecosystem=$(jq -r '.headRefName | split("/")[1]' <<<"$info")

# コミットメッセージの updated-dependencies ブロックから「名前 版 update-type」を抜き出す
deps=$(jq -r '.commits[0].messageBody' <<<"$info" | awk '
  function unq(s) { gsub(/^"|"$/, "", s); return s }
  /^updated-dependencies:/ { f = 1; next }
  f && /^\.\.\./ { f = 0 }
  f && /^- dependency-name:/ { if (n != "") print n, v, u; n = unq($3); v = "-"; u = "-" }
  f && /^  dependency-version:/ { v = unq($2) }
  f && /^  update-type:/ { u = unq($2) }
  END { if (n != "") print n, v, u }
')

if [ -z "$deps" ]; then
  echo "#$pr: no updated-dependencies metadata; skip."
  exit 0
fi

if grep -q 'version-update:semver-major' <<<"$deps"; then
  echo "#$pr: contains a semver-major update; leave for manual review."
  if [ -z "${DRY_RUN:-}" ] &&
    [ "$(jq -r --arg m "$MAJOR_MARKER" '[.comments[] | select(.body | contains($m))] | length' <<<"$info")" = "0" ]; then
    gh pr comment "$pr" --body "${MAJOR_MARKER}
major 更新を含むため auto-merge は予約していません。変更内容を確認してから手動でマージしてください。"
  fi
  exit 0
fi

published_at() {
  local name="$1" ver="$2" repo tag
  case "$ecosystem" in
    npm_and_yarn)
      curl -fsSL "https://registry.npmjs.org/${name/\//%2f}" |
        jq -r --arg v "$ver" '.time[$v] // empty'
      ;;
    uv | pip)
      curl -fsSL "https://pypi.org/pypi/${name}/${ver}/json" |
        jq -r '[.urls[].upload_time_iso_8601] | min // empty'
      ;;
    github_actions)
      repo=$(cut -d/ -f1-2 <<<"$name")
      for tag in "v${ver}" "${ver}"; do
        if gh api "repos/${repo}/releases/tags/${tag}" --jq '.published_at' 2>/dev/null; then
          return 0
        fi
      done
      ;;
  esac
}

now=$(date -u +%s)
ok=true
while read -r name ver update_type; do
  # 名前・版はメッセージ由来なので、URL に埋め込む前に文字種を制限する
  if ! [[ "$name" =~ ^[A-Za-z0-9@._/-]+$ && "$ver" =~ ^[A-Za-z0-9.+_-]+$ ]] || [ "$ver" = "-" ]; then
    echo "#$pr: cannot verify '${name} ${ver}'; hold."
    ok=false
    continue
  fi
  pub=$(published_at "$name" "$ver" || true)
  if [ -z "$pub" ]; then
    echo "#$pr: publish date of ${name}@${ver} not found (${ecosystem}); hold."
    ok=false
    continue
  fi
  age_days=$(((now - $(jq -rn --arg d "$pub" '$d | sub("\\.[0-9]+Z$"; "Z") | fromdateiso8601')) / 86400))
  echo "#$pr: ${name}@${ver} (${update_type}) published ${pub} (${age_days}d ago)"
  if [ "$age_days" -lt "$MIN_AGE_DAYS" ]; then
    ok=false
  fi
done <<<"$deps"

if [ "$ok" != "true" ]; then
  echo "#$pr: not all updates are ${MIN_AGE_DAYS}+ days old; hold until the next sweep."
  exit 0
fi

if [ -n "${DRY_RUN:-}" ]; then
  echo "#$pr: would enable auto-merge (DRY_RUN)."
  exit 0
fi
gh pr merge "$pr" --auto --squash
echo "#$pr: auto-merge enabled."
