import type { Card, Suit } from '@/types/game'

export type Role = 'napoleon' | 'adjutant' | 'allied'

export interface PredictCardRequest {
  hand: Card[]
  tableCards: Card[]
  currentSuit: Suit | null
  trumpSuit: Suit | null
  role: Role
  isNapoleonTeam: boolean
  trickNumber: number
}

export interface PredictCardCandidate {
  cardId: string // "${suit}-${rank}" e.g. "hearts-A"
  /**
   * 合法手の中でこのカードが選ばれる確率。
   *
   * 2026-08-01 以降、推論側 (python/app.py) が「フォロー義務を満たすカード」だけを
   * スコアリングし、その中で正規化して返す。値はそのまま的中率に対応し、0.6 以上なら
   * 参照ポリシーと約 81% 一致する (強制手を除いた実効値。合法手が 1 枚の局面は
   * selectAICard が ML を呼ばずに短絡するため、本番で観測されるのはこちら)。
   *
   * ⚠️ topK の confidence は合計 1 にならない。正規化自体は合法手全体に対して行うが、
   * サーバが上位 5 件までしか返さないため、合法手が 6 枚以上なら合計は 1 未満になる
   * (実測: 合法手 12 枚のとき上位 5 件の合計 0.8237)。「合計 1」を前提にした再正規化を
   * 書かないこと。
   *
   * それ以前は 52 枚分の確率から手札分を抜き出して正規化せずに返していたため、
   * 確率質量の大半が出せないカードに残り、値が 0.10〜0.25 に張り付いていた。
   * 詳細: docs/ml/CARD_PREDICTION_MODEL.md
   */
  confidence: number
}

export interface PredictCardResponse {
  predictedCardId: string
  confidence: number
  topK: PredictCardCandidate[]
}

// HF Space free tier sleeps after 5min idle and cold-starts in ~10-15s.
// Keep timeout generous enough to cover cold start, but bounded so the AI
// turn does not stall the UI indefinitely.
const DEFAULT_TIMEOUT_MS = 20_000

/**
 * Call the napoleon-ml-trainer inference API.
 *
 * Returns null when:
 * - NEXT_PUBLIC_ML_API_URL is not configured
 * - Network/timeout/server error
 * - Model not trained yet, or the Space still holds a legacy 52-class model (503)
 *
 * Callers should fall back to the local MCTS strategy on null.
 *
 * 合法手 (フォロー義務) の絞り込みはサーバ側が hand と tableCards から導出する。
 * ルールを 2 箇所に持つと必ず片方だけ変わるので、ここでは送らない。
 */
export async function predictBestCard(
  request: PredictCardRequest,
  options: { timeoutMs?: number; signal?: AbortSignal } = {}
): Promise<PredictCardResponse | null> {
  const baseUrl = process.env.NEXT_PUBLIC_ML_API_URL
  if (!baseUrl) {
    return null
  }

  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  )
  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort(), {
      once: true,
    })
  }

  try {
    const response = await fetch(
      `${baseUrl.replace(/\/+$/, '')}/api/predict-card`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hand: request.hand,
          table_cards: request.tableCards,
          current_suit: request.currentSuit,
          trump_suit: request.trumpSuit,
          role: request.role,
          is_napoleon_team: request.isNapoleonTeam,
          trick_number: request.trickNumber,
        }),
        signal: controller.signal,
      }
    )

    if (!response.ok) {
      // 503 = model not yet trained on the Space; treat as a soft miss.
      if (response.status !== 503) {
        console.warn('[mlClient] predict-card HTTP error', response.status)
      }
      return null
    }

    const data = (await response.json()) as {
      predicted_card_id: string
      confidence: number
      top_k: { card_id: string; confidence: number }[]
    }
    return {
      predictedCardId: data.predicted_card_id,
      confidence: data.confidence,
      topK: data.top_k.map((c) => ({
        cardId: c.card_id,
        confidence: c.confidence,
      })),
    }
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      console.warn('[mlClient] predict-card timed out')
    } else {
      console.warn('[mlClient] predict-card failed:', (error as Error)?.message)
    }
    return null
  } finally {
    clearTimeout(timeout)
  }
}
