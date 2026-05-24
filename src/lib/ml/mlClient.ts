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
 * - Model not trained yet (503)
 *
 * Callers should fall back to the local MCTS strategy on null.
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
