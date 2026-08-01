/**
 * 副官のカード選択に関する回帰テスト
 *
 * 実プレイで報告された事象:
 *  - ナポレオンが副官指定カードのスートを 10/Q あたりでリードして副官を
 *    「呼んで」いるのに、副官がその副官カードを出さず、別の絵札を捨てて
 *    連合軍にトリックごと持っていかれる。
 *
 * 原因は 2 つ:
 *  1. `shouldPassFaceCard` がトリック内の自分の順番を見ておらず、後続に
 *     まだ 2 人残っていても「ナポレオンが今勝っている」だけで絵札を捨てていた。
 *  2. 副官カードがマイティ・表J・裏Jだと `optimalRevealTiming` が 0 に
 *     落とされ、開示ロジックからは永久に出せなかった。
 *
 * 個別のカード選択ではなく「渡した絵札が相手に取られない」という不変条件で
 * 検証する（脆い戦略テストにしないため）。
 */

import { getPlayableCards } from '@/lib/ai/gameSimulator'
import { selectBestStrategicCard } from '@/lib/ai/strategicCardEvaluator'
import { evaluateAdjutantTactics } from '@/lib/ai/strategies/adjutantTactics'
import { isFaceCard } from '@/lib/ai/strategies/helpers'
import { wouldWinTrick } from '@/lib/ai/strategies/trickOutcome'
import type { WinningRequirements } from '@/lib/ai/strategies/types'
import { createDeck, GAME_PHASES, SUIT_ENUM } from '@/lib/constants'
import { determineWinnerWithSpecialRules } from '@/lib/napoleonCardRules'
import type { Card, GameState, Player, Suit, Trick } from '@/types/game'

type Rank = Card['rank']

const DECK = createDeck()

const c = (suit: Suit, rank: Rank): Card => {
  const found = DECK.find((card) => card.suit === suit && card.rank === rank)
  if (!found) throw new Error(`card not found: ${suit} ${rank}`)
  return found
}

const player = (id: string, opts: Partial<Player> = {}): Player => ({
  id,
  name: id,
  hand: [],
  isNapoleon: false,
  isAdjutant: false,
  isAI: true,
  position: 1,
  ...opts,
})

const trick = (cards: Array<{ card: Card; playerId: string }>): Trick => ({
  id: 'current-trick',
  cards: cards.map((x, i) => ({ ...x, order: i })),
  leadingSuit: cards[0]?.card.suit,
  completed: false,
})

const completedTricks = (n: number): Trick[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `done-${i}`,
    cards: [],
    completed: true,
  }))

const requirements: WinningRequirements = {
  napoleonTeamFaceCards: 0,
  allianceTeamFaceCards: 0,
  remainingFaceCards: 20,
  remainingTricks: 8,
  napoleonNeedsToWin: 4,
  allianceNeedsToBlock: 4,
  napoleonCanAffordToLose: 0,
  isNapoleonAhead: false,
  isAllianceAhead: false,
  isCriticalPhase: false,
}

/**
 * 「ナポレオンが副官カード(♠A=マイティ)のスートを♠Q で呼んでいる」局面。
 * 副官は 2 番手で、後続の連合軍 2 人がまだ残っている。
 */
function buildAdjutantCallState(adjutantHand: Card[]): {
  gameState: GameState
  adjutant: Player
} {
  const adjutantCard = c(SUIT_ENUM.SPADES, 'A')
  const napoleon = player('nap', { isNapoleon: true })
  const adjutant = player('adj', { isAdjutant: true, hand: adjutantHand })
  const ally1 = player('ally1')
  const ally2 = player('ally2')

  const currentTrick = trick([
    { card: c(SUIT_ENUM.SPADES, 'Q'), playerId: napoleon.id },
  ])

  const gameState = {
    id: 'adjutant-call',
    players: [napoleon, adjutant, ally1, ally2],
    phase: GAME_PHASES.PLAYING,
    currentPlayerIndex: 1,
    hiddenCards: [],
    trumpSuit: SUIT_ENUM.HEARTS,
    leadingSuit: SUIT_ENUM.SPADES,
    currentTrick,
    tricks: completedTricks(3),
    passedPlayers: [],
    declarationTurn: 0,
    needsRedeal: false,
    napoleonDeclaration: {
      playerId: napoleon.id,
      targetTricks: 15,
      suit: SUIT_ENUM.HEARTS,
      adjutantCard,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as GameState

  return { gameState, adjutant }
}

describe('副官: ナポレオンの副官呼びに応える', () => {
  test('副官カード(マイティ)で取れるなら、それを出す', () => {
    const hand = [
      c(SUIT_ENUM.SPADES, 'A'), // 副官指定カード = マイティ
      c(SUIT_ENUM.SPADES, '10'),
      c(SUIT_ENUM.SPADES, '4'),
      c(SUIT_ENUM.HEARTS, '3'),
    ]
    const { gameState, adjutant } = buildAdjutantCallState(hand)
    const playable = getPlayableCards(gameState, adjutant.id)

    const tactics = evaluateAdjutantTactics(
      playable,
      gameState.currentTrick,
      gameState,
      requirements,
      adjutant.hand
    )

    // マイティは開示ロジック側では出せない（特殊カードは開示に使わない）。
    // 呼びに応える判定が別に立つことを確認する。
    expect(tactics.shouldRevealNow).toBe(false)
    expect(tactics.shouldAnswerAdjutantCall).toBe(true)
    expect(tactics.adjutantCallCard?.id).toBe(c(SUIT_ENUM.SPADES, 'A').id)

    const picked = selectBestStrategicCard(playable, gameState, adjutant)
    expect(picked?.id).toBe(c(SUIT_ENUM.SPADES, 'A').id)
  })

  test('選んだ札で実際にナポレオンチームがトリックを取れる（不変条件）', () => {
    const hand = [
      c(SUIT_ENUM.SPADES, 'A'),
      c(SUIT_ENUM.SPADES, '10'),
      c(SUIT_ENUM.SPADES, '4'),
    ]
    const { gameState, adjutant } = buildAdjutantCallState(hand)
    const playable = getPlayableCards(gameState, adjutant.id)
    const picked = selectBestStrategicCard(playable, gameState, adjutant)

    expect(picked).not.toBeNull()

    // 後続の連合軍が最強の♠(=♠K)を出しても、副官の札で取り切れていること
    const finished: Trick = {
      ...gameState.currentTrick,
      cards: [
        ...gameState.currentTrick.cards,
        { card: picked as Card, playerId: adjutant.id, order: 1 },
        { card: c(SUIT_ENUM.SPADES, 'K'), playerId: 'ally1', order: 2 },
        { card: c(SUIT_ENUM.SPADES, '9'), playerId: 'ally2', order: 3 },
      ],
    }
    const winner = determineWinnerWithSpecialRules(
      finished,
      SUIT_ENUM.HEARTS,
      false
    )

    expect([gameState.players[0].id, adjutant.id]).toContain(winner?.playerId)
  })

  test('副官カードが後続に抜かれうる普通の絵札なら応えない', () => {
    // 副官カード = ♠K。♠Q リードには今は勝てるが、未確認の♠A を持つ
    // 連合軍が後ろに 2 人残っている。出すと絵札 3 枚を献上することになる。
    const adjutantCard = c(SUIT_ENUM.SPADES, 'K')
    const hand = [adjutantCard, c(SUIT_ENUM.SPADES, '4')]
    const { gameState, adjutant } = buildAdjutantCallState(hand)
    const declaration = gameState.napoleonDeclaration as unknown as {
      adjutantCard: Card
    }
    declaration.adjutantCard = adjutantCard

    const playable = getPlayableCards(gameState, adjutant.id)
    const tactics = evaluateAdjutantTactics(
      playable,
      gameState.currentTrick,
      gameState,
      requirements,
      adjutant.hand
    )

    // 今このトリックは取れる（＝旧ロジックはこれだけで出していた）
    expect(wouldWinTrick(adjutantCard, gameState.currentTrick, gameState)).toBe(
      true
    )
    // が、未確認の♠A に抜かれるので応えてはいけない
    expect(tactics.shouldAnswerAdjutantCall).toBe(false)
    expect(tactics.adjutantCallCard).toBeNull()
  })

  test('♠A が自分の手札にあり抜かれないなら、♠K でも応える', () => {
    // 上と同じ局面だが、リードスートの上位札(♠A)を自分が握っているので
    // ♠K は抜かれない。抑制が効きすぎていないことの確認。
    const adjutantCard = c(SUIT_ENUM.SPADES, 'K')
    const hand = [
      adjutantCard,
      c(SUIT_ENUM.SPADES, 'A'),
      c(SUIT_ENUM.SPADES, '4'),
    ]
    const { gameState, adjutant } = buildAdjutantCallState(hand)
    const declaration = gameState.napoleonDeclaration as unknown as {
      adjutantCard: Card
    }
    declaration.adjutantCard = adjutantCard

    const playable = getPlayableCards(gameState, adjutant.id)
    const tactics = evaluateAdjutantTactics(
      playable,
      gameState.currentTrick,
      gameState,
      requirements,
      adjutant.hand
    )

    expect(tactics.shouldAnswerAdjutantCall).toBe(true)
    expect(tactics.adjutantCallCard?.id).toBe(adjutantCard.id)
  })

  test('自チームが既に取り切っているならマイティを無駄打ちしない', () => {
    // 場 [nap:♠Q, ally1:♠3, ally2:♠5] で副官が最後の打ち手。
    // ナポレオンの♠Q が既に確定勝ち。ここに副官カード(♠A)を重ねる意味はない。
    const adjutantCard = c(SUIT_ENUM.SPADES, 'A')
    const napoleon = player('nap', { isNapoleon: true })
    const hand = [adjutantCard, c(SUIT_ENUM.SPADES, '4')]
    const adjutant = player('adj', { isAdjutant: true, hand })

    const currentTrick = trick([
      { card: c(SUIT_ENUM.SPADES, 'Q'), playerId: napoleon.id },
      { card: c(SUIT_ENUM.SPADES, '3'), playerId: 'ally1' },
      { card: c(SUIT_ENUM.SPADES, '5'), playerId: 'ally2' },
    ])

    const gameState = {
      id: 'already-secured',
      players: [napoleon, adjutant, player('ally1'), player('ally2')],
      phase: GAME_PHASES.PLAYING,
      currentPlayerIndex: 1,
      hiddenCards: [],
      trumpSuit: SUIT_ENUM.HEARTS,
      leadingSuit: SUIT_ENUM.SPADES,
      currentTrick,
      tricks: completedTricks(3),
      passedPlayers: [],
      declarationTurn: 0,
      needsRedeal: false,
      napoleonDeclaration: {
        playerId: napoleon.id,
        targetTricks: 15,
        suit: SUIT_ENUM.HEARTS,
        adjutantCard,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as GameState

    const tactics = evaluateAdjutantTactics(
      hand,
      currentTrick,
      gameState,
      requirements,
      hand
    )

    expect(tactics.napoleonIsWinning).toBe(true)
    expect(tactics.shouldAnswerAdjutantCall).toBe(false)
  })

  test('副官カードでは取れない場合は呼び応答が立たない', () => {
    // 副官カードを♠10 にすると、♠Q リードには勝てない
    const adjutantCard = c(SUIT_ENUM.SPADES, '10')
    const hand = [adjutantCard, c(SUIT_ENUM.SPADES, '4')]
    const { gameState, adjutant } = buildAdjutantCallState(hand)
    const declaration = gameState.napoleonDeclaration as unknown as {
      adjutantCard: Card
    }
    declaration.adjutantCard = adjutantCard

    const playable = getPlayableCards(gameState, adjutant.id)
    const tactics = evaluateAdjutantTactics(
      playable,
      gameState.currentTrick,
      gameState,
      requirements,
      adjutant.hand
    )

    expect(tactics.shouldAnswerAdjutantCall).toBe(false)
    expect(tactics.adjutantCallCard).toBeNull()
  })
})

describe('副官: 未確定のトリックに絵札を捨てない', () => {
  test('2番手では絵札を渡さない（後続の連合軍に抜かれうる）', () => {
    const hand = [
      c(SUIT_ENUM.SPADES, '10'),
      c(SUIT_ENUM.SPADES, '8'),
      c(SUIT_ENUM.SPADES, '4'),
    ]
    const { gameState, adjutant } = buildAdjutantCallState(hand)
    const playable = getPlayableCards(gameState, adjutant.id)

    const tactics = evaluateAdjutantTactics(
      playable,
      gameState.currentTrick,
      gameState,
      requirements,
      adjutant.hand
    )

    expect(tactics.napoleonIsWinning).toBe(true)
    expect(tactics.shouldPassFaceCard).toBe(false)
    expect(tactics.faceCardToPass).toBeNull()
  })

  test('渡す絵札が決まったなら、そのトリックは自チームのものとして確定している', () => {
    // 4番手（3枚出ている）でナポレオンのマイティが勝っている局面
    const napoleon = player('nap', { isNapoleon: true })
    const adjutant = player('adj', { isAdjutant: true })
    const currentTrick = trick([
      { card: c(SUIT_ENUM.CLUBS, '9'), playerId: 'ally1' },
      { card: c(SUIT_ENUM.SPADES, 'A'), playerId: napoleon.id },
      { card: c(SUIT_ENUM.CLUBS, '8'), playerId: 'ally2' },
    ])

    const hand = [c(SUIT_ENUM.CLUBS, 'K'), c(SUIT_ENUM.CLUBS, '3')]
    const gameState = {
      id: 'secured',
      players: [napoleon, adjutant, player('ally1'), player('ally2')],
      phase: GAME_PHASES.PLAYING,
      currentPlayerIndex: 1,
      hiddenCards: [],
      trumpSuit: SUIT_ENUM.DIAMONDS,
      leadingSuit: SUIT_ENUM.CLUBS,
      currentTrick,
      tricks: completedTricks(3),
      passedPlayers: [],
      declarationTurn: 0,
      needsRedeal: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as GameState

    const tactics = evaluateAdjutantTactics(
      hand,
      currentTrick,
      gameState,
      requirements,
      hand
    )

    expect(tactics.shouldPassFaceCard).toBe(true)
    expect(tactics.faceCardToPass).not.toBeNull()
    expect(isFaceCard(tactics.faceCardToPass as Card)).toBe(true)

    // 不変条件: 渡した絵札を含めた完成トリックの勝者はナポレオンチーム
    const finished: Trick = {
      ...currentTrick,
      cards: [
        ...currentTrick.cards,
        {
          card: tactics.faceCardToPass as Card,
          playerId: adjutant.id,
          order: 3,
        },
      ],
    }
    const winner = determineWinnerWithSpecialRules(
      finished,
      SUIT_ENUM.DIAMONDS,
      false
    )

    expect([napoleon.id, adjutant.id]).toContain(winner?.playerId)
  })
})
