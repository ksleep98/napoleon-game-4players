/**
 * TopHUD の宣言（絵札数）視認性テスト
 *
 * 文言の完全一致ではなく、次の不変条件だけを検証する:
 * - 宣言した絵札数が HUD に出ていること（トリック数と取り違えられない表記であること）
 * - 「あと何枚必要か」が両陣営分、宣言と獲得枚数から導かれた値で出ること
 * - 目標に届いている side には「あと 0 枚」ではなく達成表記が出ること
 */

import { render, screen } from '@testing-library/react'
import { TopHUD } from '@/components/game/TopHUD'
import {
  CARD_RANKS,
  DECLARATION_LABELS,
  GAME_PHASES,
  NAPOLEON_RULES,
  PLAYER_ROLES,
  SUIT_ENUM,
} from '@/lib/constants'
import { getGameProgress } from '@/lib/scoring'
import type { Card, GameState, Player, Trick } from '@/types/game'

const NAPOLEON_ID = 'nap'
const CITIZEN_ID = 'cit'

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

/** 絵札 1 枚だけを含む獲得済みトリック */
const createFaceCardTrick = (index: number, winnerPlayerId: string): Trick => {
  const card: Card = {
    id: `face-${index}`,
    suit: SUIT_ENUM.SPADES,
    rank: CARD_RANKS.KING,
    value: 13,
  }
  return {
    id: `trick-${index}`,
    completed: true,
    winnerPlayerId,
    cards: [{ card, playerId: winnerPlayerId, order: 0 }],
  }
}

const createGameState = ({
  targetTricks,
  napoleonFaceCards,
  citizenFaceCards,
}: {
  targetTricks: number
  napoleonFaceCards: number
  citizenFaceCards: number
}): GameState => {
  const tricks: Trick[] = []
  for (let i = 0; i < napoleonFaceCards; i++) {
    tricks.push(createFaceCardTrick(tricks.length, NAPOLEON_ID))
  }
  for (let i = 0; i < citizenFaceCards; i++) {
    tricks.push(createFaceCardTrick(tricks.length, CITIZEN_ID))
  }

  return {
    id: 'hud-declaration-test',
    players: [
      createPlayer(NAPOLEON_ID, { isNapoleon: true }),
      createPlayer('adj'),
      createPlayer(CITIZEN_ID),
      createPlayer('cit2'),
    ],
    phase: GAME_PHASES.PLAYING,
    currentPlayerIndex: 0,
    currentTrick: { id: 'current', cards: [], completed: false },
    tricks,
    hiddenCards: [],
    // ロゴが常に ♠ を描画するため、切り札は ♦ にして表示の衝突を避ける
    trumpSuit: SUIT_ENUM.DIAMONDS,
    napoleonDeclaration: {
      playerId: NAPOLEON_ID,
      targetTricks,
      suit: SUIT_ENUM.DIAMONDS,
    },
    passedPlayers: [],
    declarationTurn: 0,
    needsRedeal: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

/** 「<verb> <count> more」が HUD 内のどこかに現れることを表すパターン */
const remainingPattern = (verb: string, count: number) =>
  new RegExp(`${verb}\\s+${count}\\s+${DECLARATION_LABELS.MORE}`)

/**
 * 指定した断片をすべて含む最も内側の <span> を返す。
 * getByText は直下のテキストノードしか見ないため、<b> を挟む行は拾えない。
 * ここでは textContent を使い、祖先を除外して「1 行」を特定する
 */
const findLine = (...fragments: (string | RegExp)[]): HTMLElement => {
  const matches = Array.from(
    document.body.querySelectorAll<HTMLElement>('span')
  ).filter((element) => {
    const text = (element.textContent ?? '').replace(/\s+/g, ' ')
    return fragments.every((fragment) =>
      typeof fragment === 'string'
        ? text.includes(fragment)
        : fragment.test(text)
    )
  })
  const innermost = matches.filter(
    (element) =>
      !matches.some((other) => other !== element && element.contains(other))
  )
  if (innermost.length !== 1 || !innermost[0]) {
    throw new Error(`Expected exactly one line, found ${innermost.length}`)
  }
  return innermost[0]
}

describe('TopHUD declaration visibility', () => {
  it('shows the declared face card count labelled as face cards, not tricks', () => {
    const gameState = createGameState({
      targetTricks: 15,
      napoleonFaceCards: 0,
      citizenFaceCards: 0,
    })

    render(<TopHUD gameState={gameState} currentPlayerId={CITIZEN_ID} />)

    // 宣言枚数そのものが独立した見出し付きチップとして出ている
    const declaredLabel = screen.getByText(DECLARATION_LABELS.DECLARED)
    const chip = declaredLabel.parentElement
    expect(chip).not.toBeNull()
    // 宣言枚数と「絵札」の単位が必ず同じチップ内に並ぶ
    expect(chip).toHaveTextContent('15')
    expect(chip).toHaveTextContent(DECLARATION_LABELS.FACE_CARDS)
  })

  it('omits the declaration chip when nobody has declared yet', () => {
    const gameState = createGameState({
      targetTricks: 15,
      napoleonFaceCards: 0,
      citizenFaceCards: 0,
    })

    render(
      <TopHUD
        gameState={{ ...gameState, napoleonDeclaration: undefined }}
        currentPlayerId={CITIZEN_ID}
      />
    )

    expect(
      screen.queryByText(DECLARATION_LABELS.DECLARED)
    ).not.toBeInTheDocument()
  })

  it('shows how many more face cards each side needs, derived from the declaration', () => {
    const gameState = createGameState({
      targetTricks: 15,
      napoleonFaceCards: 8,
      citizenFaceCards: 2,
    })
    const progress = getGameProgress(gameState)

    const { container } = render(
      <TopHUD gameState={gameState} currentPlayerId={CITIZEN_ID} />
    )

    // 前提: ナポレオンは 15 - 8 = 7 枚、連合軍は (20 - 15 + 1) - 2 = 4 枚必要
    expect(progress.napoleonNeedsToWin).toBe(7)
    expect(progress.allianceNeedsToWin).toBe(4)

    expect(container).toHaveTextContent(
      remainingPattern(DECLARATION_LABELS.NEEDS, progress.napoleonNeedsToWin)
    )
    expect(container).toHaveTextContent(
      remainingPattern(DECLARATION_LABELS.NEED, progress.allianceNeedsToWin)
    )
  })

  it('recomputes the remaining counts when the declaration changes', () => {
    const low = createGameState({
      targetTricks: 13,
      napoleonFaceCards: 5,
      citizenFaceCards: 0,
    })
    const { container, rerender } = render(
      <TopHUD gameState={low} currentPlayerId={CITIZEN_ID} />
    )
    expect(container).toHaveTextContent(
      remainingPattern(DECLARATION_LABELS.NEEDS, 13 - 5)
    )

    const high = createGameState({
      targetTricks: 18,
      napoleonFaceCards: 5,
      citizenFaceCards: 0,
    })
    rerender(<TopHUD gameState={high} currentPlayerId={CITIZEN_ID} />)
    expect(container).toHaveTextContent(
      remainingPattern(DECLARATION_LABELS.NEEDS, 18 - 5)
    )
  })

  it('replaces "0 more" with an explicit met/blocked label', () => {
    const napoleonDone = createGameState({
      targetTricks: 13,
      napoleonFaceCards: 13,
      citizenFaceCards: 0,
    })
    const { container } = render(
      <TopHUD gameState={napoleonDone} currentPlayerId={NAPOLEON_ID} />
    )

    expect(container).not.toHaveTextContent(
      remainingPattern(DECLARATION_LABELS.NEEDS, 0)
    )
    expect(
      screen.getByText(DECLARATION_LABELS.NAPOLEON_MET)
    ).toBeInTheDocument()
  })

  it('keeps both teams face card counts visible next to their remaining counts', () => {
    const gameState = createGameState({
      targetTricks: 15,
      napoleonFaceCards: 6,
      citizenFaceCards: 3,
    })

    render(<TopHUD gameState={gameState} currentPlayerId={CITIZEN_ID} />)

    // ナポレオン行: 獲得 6 枚と「あと 9 枚」が同じ行に並ぶ
    const napoleonLine = findLine(
      PLAYER_ROLES.NAPOLEON,
      remainingPattern(DECLARATION_LABELS.NEEDS, 15 - 6)
    )
    expect(napoleonLine.textContent).toMatch(/\b6\b/)

    // 連合軍行: 獲得 3 枚と「阻止まであと何枚」が同じ行に並ぶ
    const allianceRemaining = NAPOLEON_RULES.TOTAL_FACE_CARDS - 15 + 1 - 3
    const allianceLine = findLine(
      PLAYER_ROLES.ALLIED_FORCES,
      remainingPattern(DECLARATION_LABELS.NEED, allianceRemaining)
    )
    expect(allianceLine.textContent).toMatch(/\b3\b/)
  })
})
