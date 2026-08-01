/**
 * 宣言数のラベル不変条件テスト
 *
 * `NapoleonDeclaration.targetTricks` は名前に反して「絵札数」を表す。
 * 宣言数を描画する画面は、必ず絵札（face cards）と分かる単位で出すこと。
 * トリック数（12 トリック）と取り違えられる表記を出してはいけない。
 */

import { render, screen, within } from '@testing-library/react'
import { AdjutantSelector } from '@/components/game/AdjutantSelector'
import { DeclarationDisplay } from '@/components/game/DeclarationDisplay'
import { GameStatus } from '@/components/game/GameStatus'
import {
  CARD_RANKS,
  DECLARATION_LABELS,
  GAME_PHASES,
  SUIT_ENUM,
} from '@/lib/constants'
import type { Card, GameState, Player } from '@/types/game'

const TARGET_FACE_CARDS = 15
const NAPOLEON_ID = 'nap'

/** トリック数と取り違えられる単位表記 */
const TRICK_UNIT_PATTERN = /\btricks?\b/i

const adjutantCard: Card = {
  id: 'adjutant-card',
  suit: SUIT_ENUM.HEARTS,
  rank: CARD_RANKS.KING,
  value: 13,
}

const createPlayer = (id: string, overrides: Partial<Player> = {}): Player => ({
  id,
  name: `${id} player`,
  hand: [],
  isNapoleon: false,
  isAdjutant: false,
  position: 1,
  isAI: false,
  ...overrides,
})

const createGameState = (): GameState => ({
  id: 'declaration-label-test',
  players: [
    createPlayer(NAPOLEON_ID, { isNapoleon: true }),
    createPlayer('p2'),
    createPlayer('p3'),
    createPlayer('p4'),
  ],
  phase: GAME_PHASES.ADJUTANT,
  currentPlayerIndex: 0,
  currentTrick: { id: 'current', cards: [], completed: false },
  tricks: [],
  hiddenCards: [],
  napoleonCard: adjutantCard,
  trumpSuit: SUIT_ENUM.SPADES,
  napoleonDeclaration: {
    playerId: NAPOLEON_ID,
    targetTricks: TARGET_FACE_CARDS,
    suit: SUIT_ENUM.SPADES,
    adjutantCard,
  },
  passedPlayers: [],
  declarationTurn: 0,
  needsRedeal: false,
  createdAt: new Date(),
  updatedAt: new Date(),
})

/** 見出しを持つセクション（見出しの親要素）を取得する */
const getSection = (headingText: string): HTMLElement => {
  const heading = screen.getByText(headingText)
  const section = heading.parentElement
  if (!section) throw new Error(`Section not found: ${headingText}`)
  return section
}

describe('declared count is labelled as face cards', () => {
  it('labels the GameStatus declaration block with face cards, not tricks', () => {
    render(<GameStatus gameState={createGameState()} />)

    const section = getSection('Napoleon Declaration')
    expect(section).toHaveTextContent(String(TARGET_FACE_CARDS))
    expect(
      within(section).getByText(DECLARATION_LABELS.FACE_CARDS)
    ).toBeInTheDocument()
    expect(section.textContent ?? '').not.toMatch(TRICK_UNIT_PATTERN)
  })

  it('labels the AdjutantSelector declaration block with face cards, not tricks', () => {
    render(
      <AdjutantSelector
        gameState={createGameState()}
        napoleonPlayerId={NAPOLEON_ID}
        onAdjutantSelect={() => {}}
      />
    )

    const section = getSection('Your Napoleon Declaration')
    expect(section).toHaveTextContent(String(TARGET_FACE_CARDS))
    expect(
      within(section).getByText(DECLARATION_LABELS.FACE_CARDS)
    ).toBeInTheDocument()
    expect(section.textContent ?? '').not.toMatch(TRICK_UNIT_PATTERN)
  })

  it('labels the DeclarationDisplay block with face cards, not tricks', () => {
    const { container } = render(
      <DeclarationDisplay
        declaration={{
          playerId: NAPOLEON_ID,
          targetTricks: TARGET_FACE_CARDS,
          suit: SUIT_ENUM.SPADES,
        }}
      />
    )

    expect(container).toHaveTextContent(String(TARGET_FACE_CARDS))
    expect(screen.getByText(DECLARATION_LABELS.FACE_CARDS)).toBeInTheDocument()
    expect(container.textContent ?? '').not.toMatch(TRICK_UNIT_PATTERN)
  })
})
