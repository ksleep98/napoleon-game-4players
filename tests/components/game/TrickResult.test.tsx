import { render, screen } from '@testing-library/react'
import { TrickResult } from '@/components/game/TrickResult'
import type { Card, Trick } from '@/types/game'

const ADJUTANT_BADGE = '⚔️'
const NAPOLEON_BADGE = '👑'
const WINNER_LABEL = '🏆 Winner'

const createCard = (id: string): Card => ({
  id,
  suit: 'hearts',
  rank: 'K',
  value: 13,
})

const players = [
  { id: 'napoleon', name: 'Napoleon Player', isNapoleon: true },
  { id: 'adjutant', name: 'Adjutant Player', isAdjutant: true },
]

const trick: Trick = {
  id: 'trick-1',
  cards: [
    { card: createCard('c1'), playerId: 'napoleon', order: 0 },
    { card: createCard('c2'), playerId: 'adjutant', order: 1 },
  ],
  completed: true,
  winnerPlayerId: 'adjutant',
}

/** 「🏆 Winner」ラベルの隣に描画される勝者名ブロックのテキストを取得 */
const getWinnerText = (): string =>
  screen.getByText(WINNER_LABEL).nextElementSibling?.textContent ?? ''

describe('TrickResult adjutant badge', () => {
  it('hides the adjutant badge before the adjutant is revealed', () => {
    render(
      <TrickResult
        trick={trick}
        players={players}
        onContinue={jest.fn()}
        isAdjutantRevealed={false}
        currentPlayerId="napoleon"
      />
    )

    expect(getWinnerText()).toContain('Adjutant Player')
    expect(getWinnerText()).not.toContain(ADJUTANT_BADGE)
  })

  it('hides the adjutant badge when the guard props are omitted', () => {
    render(
      <TrickResult trick={trick} players={players} onContinue={jest.fn()} />
    )

    expect(getWinnerText()).not.toContain(ADJUTANT_BADGE)
  })

  it('shows the adjutant badge after the adjutant is revealed', () => {
    render(
      <TrickResult
        trick={trick}
        players={players}
        onContinue={jest.fn()}
        isAdjutantRevealed={true}
        currentPlayerId="napoleon"
      />
    )

    expect(getWinnerText()).toContain(ADJUTANT_BADGE)
  })

  it('always shows the badge to the adjutant themselves', () => {
    render(
      <TrickResult
        trick={trick}
        players={players}
        onContinue={jest.fn()}
        isAdjutantRevealed={false}
        currentPlayerId="adjutant"
      />
    )

    expect(getWinnerText()).toContain(ADJUTANT_BADGE)
  })

  it('keeps the public Napoleon badge visible before the reveal', () => {
    const napoleonWonTrick: Trick = { ...trick, winnerPlayerId: 'napoleon' }

    render(
      <TrickResult
        trick={napoleonWonTrick}
        players={players}
        onContinue={jest.fn()}
        isAdjutantRevealed={false}
        currentPlayerId="adjutant"
      />
    )

    expect(getWinnerText()).toContain(NAPOLEON_BADGE)
  })
})
