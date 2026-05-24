import { predictBestCard } from '@/lib/ml/mlClient'
import type { Card } from '@/types/game'

const sampleHand: Card[] = [
  { id: 'hearts-A', suit: 'hearts', rank: 'A', value: 14 },
  { id: 'spades-K', suit: 'spades', rank: 'K', value: 13 },
]

const baseRequest = {
  hand: sampleHand,
  tableCards: [],
  currentSuit: null,
  trumpSuit: null,
  role: 'allied' as const,
  isNapoleonTeam: false,
  trickNumber: 0,
}

describe('predictBestCard', () => {
  const originalUrl = process.env.NEXT_PUBLIC_ML_API_URL
  const originalFetch = global.fetch
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

  afterEach(() => {
    process.env.NEXT_PUBLIC_ML_API_URL = originalUrl
    global.fetch = originalFetch
    warnSpy.mockClear()
  })

  afterAll(() => {
    warnSpy.mockRestore()
  })

  it('returns null and does not fetch when NEXT_PUBLIC_ML_API_URL is unset', async () => {
    process.env.NEXT_PUBLIC_ML_API_URL = ''
    const fetchMock = jest.fn()
    global.fetch = fetchMock as unknown as typeof fetch

    const result = await predictBestCard(baseRequest)

    expect(result).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns parsed response on 200', async () => {
    process.env.NEXT_PUBLIC_ML_API_URL = 'https://ml.example/'
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        predicted_card_id: 'hearts-A',
        confidence: 0.42,
        top_k: [
          { card_id: 'hearts-A', confidence: 0.42 },
          { card_id: 'spades-K', confidence: 0.11 },
        ],
      }),
    }) as unknown as typeof fetch

    const result = await predictBestCard(baseRequest)

    expect(result).toEqual({
      predictedCardId: 'hearts-A',
      confidence: 0.42,
      topK: [
        { cardId: 'hearts-A', confidence: 0.42 },
        { cardId: 'spades-K', confidence: 0.11 },
      ],
    })
  })

  it('posts snake_case payload to /api/predict-card and strips trailing slash from base URL', async () => {
    process.env.NEXT_PUBLIC_ML_API_URL = 'https://ml.example///'
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        predicted_card_id: 'hearts-A',
        confidence: 1,
        top_k: [],
      }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    await predictBestCard({
      ...baseRequest,
      currentSuit: 'hearts',
      trumpSuit: 'spades',
      role: 'napoleon',
      isNapoleonTeam: true,
      trickNumber: 3,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://ml.example/api/predict-card',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    )
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body).toEqual({
      hand: sampleHand,
      table_cards: [],
      current_suit: 'hearts',
      trump_suit: 'spades',
      role: 'napoleon',
      is_napoleon_team: true,
      trick_number: 3,
    })
  })

  it('returns null on 503 (model not yet trained) without warning', async () => {
    process.env.NEXT_PUBLIC_ML_API_URL = 'https://ml.example'
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    }) as unknown as typeof fetch

    const result = await predictBestCard(baseRequest)

    expect(result).toBeNull()
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('returns null and warns on other HTTP errors', async () => {
    process.env.NEXT_PUBLIC_ML_API_URL = 'https://ml.example'
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    }) as unknown as typeof fetch

    const result = await predictBestCard(baseRequest)

    expect(result).toBeNull()
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('HTTP error'),
      500
    )
  })

  it('returns null on network error', async () => {
    process.env.NEXT_PUBLIC_ML_API_URL = 'https://ml.example'
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('network down')) as unknown as typeof fetch

    const result = await predictBestCard(baseRequest)

    expect(result).toBeNull()
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('failed'),
      'network down'
    )
  })

  it('returns null on timeout (AbortError)', async () => {
    process.env.NEXT_PUBLIC_ML_API_URL = 'https://ml.example'
    global.fetch = jest.fn().mockImplementation((_, init: RequestInit) => {
      return new Promise((_, reject) => {
        init.signal?.addEventListener('abort', () => {
          const err = new Error('aborted')
          err.name = 'AbortError'
          reject(err)
        })
      })
    }) as unknown as typeof fetch

    const result = await predictBestCard(baseRequest, { timeoutMs: 10 })

    expect(result).toBeNull()
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('timed out'))
  })
})
