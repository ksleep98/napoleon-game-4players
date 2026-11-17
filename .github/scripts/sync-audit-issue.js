// 週次の依存監査の結果を Issue に反映する（actions/github-script から require して使う）。
//
// - 脆弱性あり: 同じ種類の open Issue があれば本文を最新に更新してコメント、無ければ作成
//   （以前は検出のたびに新しい Issue を作っており、直っても閉じないので溜まっていた）
// - 脆弱性なし: 同じ種類の open Issue をすべて閉じる
//
// 監査が失敗して結果を読めないときは呼び出し側で実行しない（0 件と取り違えて閉じないため）。
// 依存のコードを実行するジョブに issues: write を渡さないよう、監査ジョブとは別の
// チェックアウトしない（このスクリプトだけ develop から取る）ジョブで動かす。

const fs = require('node:fs')

const KINDS = {
  python: {
    title: 'Python Security Audit: Vulnerabilities Found',
    labels: ['security', 'dependencies', 'python'],
    heading: 'Python Security Vulnerabilities Detected',
    steps: [
      'Review vulnerabilities above',
      'Update affected packages in `python/pyproject.toml`',
      'Run `cd python && uv lock` (uv.lock is the only dependency source; the Docker build derives requirements from it)',
      'Verify with `uv run --group dev pip-audit`',
      'If it cannot be fixed yet, add the ID to `python/pip-audit-ignore.txt` with an expiry date',
      'Create PR with fixes',
    ],
  },
  npm: {
    title: 'Security Audit: Vulnerabilities Found',
    labels: ['security', 'dependencies'],
    heading: 'Security Vulnerabilities Detected',
    steps: [
      'Review vulnerabilities above',
      'Update packages: pnpm update package-name --latest',
      'Or use overrides in package.json',
      'Run tests: pnpm test',
      'Create PR with fixes',
    ],
  },
}

// pip-audit --format json
function pythonFindings(result) {
  const out = []
  for (const dep of result.dependencies || []) {
    for (const v of dep.vulns || []) {
      out.push(
        `### ${dep.name}@${dep.version}\n` +
          `- ID: ${v.id}\n` +
          `- Fix: ${v.fix_versions?.join(', ') || 'n/a'}\n` +
          `- Description: ${v.description || ''}\n`
      )
    }
  }
  return out
}

// pnpm audit --json（npm v6 互換の advisories 形式）
function npmFindings(result) {
  const out = []
  for (const a of Object.values(result.advisories || {})) {
    out.push(
      `### ${a.title}\n` +
        `- Package: ${a.module_name}\n` +
        `- Severity: ${a.severity}\n` +
        `- Vulnerable: ${a.vulnerable_versions}\n` +
        `- Patched: ${a.patched_versions}\n` +
        `- CVE: ${(a.cves || []).join(', ')}\n` +
        `- Info: ${a.url}\n`
    )
  }
  return out
}

function buildBody(kind, findings, today, runUrl) {
  const k = KINDS[kind]
  return (
    `## ${k.heading}\n\n` +
    `**Last detected**: ${today} ([run](${runUrl}))\n\n` +
    '## Vulnerabilities\n\n' +
    `${findings.join('\n')}\n` +
    '## Action Required\n\n' +
    `${k.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n` +
    'This issue is updated by the weekly audit while vulnerabilities remain, ' +
    'and closed automatically once the audit finds none.\n\n' +
    '## Reference\n\n' +
    '- [Supply Chain Security Guide](./docs/security/SUPPLY_CHAIN_SECURITY.md)\n'
  )
}

module.exports = async ({
  github,
  context,
  kind,
  resultPath,
  vulnerabilities,
  isScheduled,
}) => {
  const k = KINDS[kind]
  if (!k) throw new Error(`unknown kind: ${kind}`)
  const { owner, repo } = context.repo
  const today = new Date().toISOString().split('T')[0]
  const runUrl = `${context.serverUrl}/${owner}/${repo}/actions/runs/${context.runId}`

  const open = (
    await github.paginate(github.rest.issues.listForRepo, {
      owner,
      repo,
      state: 'open',
      labels: k.labels[0],
      per_page: 100,
    })
  )
    .filter((i) => !i.pull_request && i.title.startsWith(k.title))
    .sort((a, b) => b.number - a.number)

  if (vulnerabilities === 0) {
    for (const issue of open) {
      await github.rest.issues.createComment({
        owner,
        repo,
        issue_number: issue.number,
        body: `The audit on ${today} found no vulnerabilities, closing. ([run](${runUrl}))`,
      })
      await github.rest.issues.update({
        owner,
        repo,
        issue_number: issue.number,
        state: 'closed',
        state_reason: 'completed',
      })
      console.log(`Closed #${issue.number}`)
    }
    if (open.length === 0)
      console.log('No vulnerabilities and no open audit issue.')
    return
  }

  // 作成・更新は週次の schedule だけ（リリース PR 更新ごとの dispatch でコメントを重ねない）
  if (!isScheduled) {
    console.log(
      'Vulnerabilities found; issue updates are limited to the weekly schedule.'
    )
    return
  }

  const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'))
  const findings =
    kind === 'python' ? pythonFindings(result) : npmFindings(result)
  const body = buildBody(kind, findings, today, runUrl)
  const title = `${k.title} (${today})`

  if (open.length > 0) {
    const [latest] = open
    await github.rest.issues.update({
      owner,
      repo,
      issue_number: latest.number,
      title,
      body,
    })
    await github.rest.issues.createComment({
      owner,
      repo,
      issue_number: latest.number,
      body: `Still detected on ${today}: ${vulnerabilities} vulnerable package(s). The description has been updated. ([run](${runUrl}))`,
    })
    console.log(`Updated #${latest.number}`)
    return
  }
  const { data } = await github.rest.issues.create({
    owner,
    repo,
    title,
    body,
    labels: k.labels,
  })
  console.log(`Created #${data.number}`)
}
