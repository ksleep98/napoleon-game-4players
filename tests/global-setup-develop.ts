import { request } from '@playwright/test'

/**
 * develop 環境の Deployment Protection を通過するための Cookie を1度だけ取得する。
 *
 * 回避キーを extraHTTPHeaders で送ると、ブラウザが出す全リクエスト（Supabase 等の
 * 別オリジンを含む）にキーが付き、トレースにも平文で残る。ここで Vercel が発行する
 * Cookie に交換しておけば、テスト中に送られるのはそのホスト宛ての Cookie だけになる。
 */
export const BYPASS_STATE_PATH = 'vercel-auth-state.json'

export default async function globalSetup() {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  const baseURL = process.env.PLAYWRIGHT_BASE_URL
  if (!secret || !baseURL) {
    throw new Error(
      'VERCEL_AUTOMATION_BYPASS_SECRET and PLAYWRIGHT_BASE_URL are required'
    )
  }

  const context = await request.newContext({ baseURL })
  const params = new URLSearchParams({
    'x-vercel-protection-bypass': secret,
    'x-vercel-set-bypass-cookie': 'true',
  })
  const response = await context.get(`/?${params.toString()}`)
  if (!response.ok()) {
    throw new Error(`Bypass request failed with HTTP ${response.status()}`)
  }
  await context.storageState({ path: BYPASS_STATE_PATH })
  await context.dispose()
}
