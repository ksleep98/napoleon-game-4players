/**
 * 特殊ルール込みのトリック勝敗判定（trickOutcome）の回帰テスト
 *
 * 背景: AI のヒューリスティック層は素の `getCardStrength()` だけで勝敗を
 * 判定していたため、狩りJ・よろめき・セイム2 のように「素の強度と勝敗が
 * 逆転する」ルールが見えていなかった。実際に、切り札♠のとき場に表J(♠J)が
 * 出ていても AI は狩J(♥J) を「勝てない札」と判断して出さなかった。
 *
 * ここでは個別のカード選択（脆くなりやすい）ではなく、
 * 「trickOutcome の判定が実際の勝者判定 determineWinnerWithSpecialRules と
 * 常に一致する」という不変条件を検証する。
 */

import {
  getCurrentTrickWinner,
  getWinningCards,
  isTrickSafeAfterPlaying,
  wouldWinTrick,
} from '@/lib/ai/strategies/trickOutcome'
import { createDeck, GAME_PHASES, SUIT_ENUM } from '@/lib/constants'
import { determineWinnerWithSpecialRules } from '@/lib/napoleonCardRules'
import type { Card, GameState, Player, Suit, Trick } from '@/types/game'

type Rank = Card['rank']

const DECK = createDeck()

/** デッキ実体から引く（id 採番規則をテスト側で二重定義しないため） */
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

/** 完了済みトリック（枚数だけ意味があり、札は空でよい場面向け） */
const emptyCompletedTricks = (n: number): Trick[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `done-${i}`,
    cards: [],
    completed: true,
  }))

const baseGameState = (over: Partial<GameState> = {}): GameState =>
  ({
    id: 'test-game',
    players: [],
    phase: GAME_PHASES.PLAYING,
    currentPlayerIndex: 0,
    hiddenCards: [],
    trumpSuit: SUIT_ENUM.SPADES,
    currentTrick: { id: 'current-trick', cards: [], completed: false },
    // 1トリック目は切り札判定が無効になるため、既定では 2 トリック目以降にする
    tricks: emptyCompletedTricks(3),
    passedPlayers: [],
    declarationTurn: 0,
    needsRedeal: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }) as unknown as GameState

/** 「その札を出したら勝つか」を実際の勝者判定で求める参照実装 */
const winsAccordingToRules = (
  card: Card,
  currentTrick: Trick,
  gameState: GameState
): boolean => {
  const probe: Trick = {
    ...currentTrick,
    cards: [
      ...currentTrick.cards,
      { card, playerId: 'probe', order: currentTrick.cards.length },
    ],
  }
  const winner = determineWinnerWithSpecialRules(
    probe,
    gameState.trumpSuit as Suit,
    (gameState.tricks?.length ?? 0) === 0
  )
  return winner?.playerId === 'probe'
}

describe('trickOutcome: wouldWinTrick は実際の勝者判定と一致する', () => {
  // 切り札♠のとき 表J=♠J / 裏J=♣J / ♠J の狩J=♥J / ♣J の狩J=♦J
  const scenarios: Array<{ name: string; trumpSuit: Suit; table: Card[] }> = [
    {
      name: '表J(♠J)が出ている（狩J=♥J が勝つ）',
      trumpSuit: SUIT_ENUM.SPADES,
      table: [c(SUIT_ENUM.SPADES, 'J')],
    },
    {
      name: '裏J(♣J)が出ている（狩J=♦J が勝つ）',
      trumpSuit: SUIT_ENUM.SPADES,
      table: [c(SUIT_ENUM.SPADES, '5'), c(SUIT_ENUM.CLUBS, 'J')],
    },
    {
      name: 'マイティ(♠A)が出ている（よろめき=♥Q が勝つ）',
      trumpSuit: SUIT_ENUM.DIAMONDS,
      table: [c(SUIT_ENUM.SPADES, '3'), c(SUIT_ENUM.SPADES, 'A')],
    },
    {
      name: '通常のリード（特殊ルールなし）',
      trumpSuit: SUIT_ENUM.HEARTS,
      table: [c(SUIT_ENUM.CLUBS, '9')],
    },
    {
      name: '3枚出ていて4枚目でセイム2が成立しうる',
      trumpSuit: SUIT_ENUM.SPADES,
      table: [
        c(SUIT_ENUM.HEARTS, 'K'),
        c(SUIT_ENUM.HEARTS, '7'),
        c(SUIT_ENUM.HEARTS, '4'),
      ],
    },
  ]

  test.each(scenarios)('$name', ({ trumpSuit, table }) => {
    const currentTrick = trick(
      table.map((card, i) => ({ card, playerId: `p${i}` }))
    )
    const gameState = baseGameState({ trumpSuit, currentTrick })

    // 場に出ていない全ての札について、判定が参照実装と一致すること
    const onTable = new Set(table.map((card) => card.id))
    const candidates = DECK.filter((card) => !onTable.has(card.id))

    for (const candidate of candidates) {
      expect({
        card: candidate.id,
        wins: wouldWinTrick(candidate, currentTrick, gameState),
      }).toEqual({
        card: candidate.id,
        wins: winsAccordingToRules(candidate, currentTrick, gameState),
      })
    }
  })
})

describe('trickOutcome: 狩りJ を「勝てる札」として認識する', () => {
  test('表J(♠J)に対して狩J(♥J)が勝ち札に含まれる', () => {
    const currentTrick = trick([
      { card: c(SUIT_ENUM.SPADES, 'J'), playerId: 'nap' },
    ])
    const gameState = baseGameState({
      trumpSuit: SUIT_ENUM.SPADES,
      currentTrick,
    })

    const huntingJack = c(SUIT_ENUM.HEARTS, 'J')
    const hand = [
      huntingJack,
      c(SUIT_ENUM.HEARTS, '3'),
      c(SUIT_ENUM.CLUBS, '5'),
    ]

    expect(wouldWinTrick(huntingJack, currentTrick, gameState)).toBe(true)
    expect(getWinningCards(hand, currentTrick, gameState)).toContain(
      huntingJack
    )
  })

  test('マイティが同席していれば狩J は勝ち札にならない', () => {
    const currentTrick = trick([
      { card: c(SUIT_ENUM.SPADES, 'J'), playerId: 'nap' },
      { card: c(SUIT_ENUM.SPADES, 'A'), playerId: 'ally' },
    ])
    const gameState = baseGameState({
      trumpSuit: SUIT_ENUM.SPADES,
      currentTrick,
    })

    expect(
      wouldWinTrick(c(SUIT_ENUM.HEARTS, 'J'), currentTrick, gameState)
    ).toBe(false)
  })

  test('対角線ではない J（♦J）は表J(♠J)の狩J にならない', () => {
    const currentTrick = trick([
      { card: c(SUIT_ENUM.SPADES, 'J'), playerId: 'nap' },
    ])
    const gameState = baseGameState({
      trumpSuit: SUIT_ENUM.SPADES,
      currentTrick,
    })

    expect(
      wouldWinTrick(c(SUIT_ENUM.DIAMONDS, 'J'), currentTrick, gameState)
    ).toBe(false)
  })
})

describe('trickOutcome: getCurrentTrickWinner', () => {
  test('リード局面では null', () => {
    const currentTrick = trick([])
    const gameState = baseGameState({ currentTrick })
    expect(getCurrentTrickWinner(currentTrick, gameState)).toBeNull()
  })

  test('狩J が出ていれば表J ではなく狩J の持ち主が勝者', () => {
    const currentTrick = trick([
      { card: c(SUIT_ENUM.SPADES, 'J'), playerId: 'nap' },
      { card: c(SUIT_ENUM.HEARTS, 'J'), playerId: 'ally' },
    ])
    const gameState = baseGameState({
      trumpSuit: SUIT_ENUM.SPADES,
      currentTrick,
    })

    expect(getCurrentTrickWinner(currentTrick, gameState)?.playerId).toBe(
      'ally'
    )
  })
})

describe('trickOutcome: isTrickSafeAfterPlaying', () => {
  const napoleon = player('nap', { isNapoleon: true })
  const adjutant = player('adj', { isAdjutant: true })
  const ally1 = player('ally1')
  const ally2 = player('ally2')
  const players = [napoleon, adjutant, ally1, ally2]
  const isNapoleonTeam = (playerId: string) => playerId === napoleon.id

  test('リード局面では確定しない', () => {
    const currentTrick = trick([])
    const gameState = baseGameState({ players, currentTrick })

    expect(
      isTrickSafeAfterPlaying(
        c(SUIT_ENUM.HEARTS, 'K'),
        currentTrick,
        gameState,
        [],
        isNapoleonTeam
      )
    ).toBe(false)
  })

  test('2番手で後続に抜かれうるなら確定しない（バグの再現条件）', () => {
    // ナポレオンが副官を呼ぶ ♠Q をリード。副官は2番手で、後続の連合軍2人が
    // ♠A/♠K を持ちうる。ここで絵札(♠10)を捨てると絵札ごと持っていかれる。
    const currentTrick = trick([
      { card: c(SUIT_ENUM.SPADES, 'Q'), playerId: napoleon.id },
    ])
    const gameState = baseGameState({
      players,
      trumpSuit: SUIT_ENUM.HEARTS,
      leadingSuit: SUIT_ENUM.SPADES,
      currentTrick,
    })

    const hand = [c(SUIT_ENUM.SPADES, '10'), c(SUIT_ENUM.SPADES, '4')]

    expect(
      isTrickSafeAfterPlaying(
        c(SUIT_ENUM.SPADES, '10'),
        currentTrick,
        gameState,
        hand,
        isNapoleonTeam
      )
    ).toBe(false)
  })

  test('最後の打ち手で味方が勝っているなら確定する', () => {
    const currentTrick = trick([
      { card: c(SUIT_ENUM.CLUBS, '9'), playerId: ally1.id },
      { card: c(SUIT_ENUM.SPADES, 'A'), playerId: napoleon.id },
      { card: c(SUIT_ENUM.CLUBS, '8'), playerId: ally2.id },
    ])
    const gameState = baseGameState({
      players,
      trumpSuit: SUIT_ENUM.DIAMONDS,
      leadingSuit: SUIT_ENUM.CLUBS,
      currentTrick,
    })

    const passed = c(SUIT_ENUM.CLUBS, 'K')

    expect(
      isTrickSafeAfterPlaying(
        passed,
        currentTrick,
        gameState,
        [passed],
        isNapoleonTeam
      )
    ).toBe(true)
  })

  test('最後の打ち手で自分の札によろめきで勝ちが移っても確定扱いになる', () => {
    // マイティで味方が勝っているが、自分が出す ♥Q でよろめきが発動し
    // 自分がトリックを取る。自チームのものになる点は変わらないので safe。
    const currentTrick = trick([
      { card: c(SUIT_ENUM.HEARTS, '9'), playerId: ally1.id },
      { card: c(SUIT_ENUM.SPADES, 'A'), playerId: napoleon.id },
      { card: c(SUIT_ENUM.HEARTS, '8'), playerId: ally2.id },
    ])
    const gameState = baseGameState({
      players,
      trumpSuit: SUIT_ENUM.DIAMONDS,
      leadingSuit: SUIT_ENUM.HEARTS,
      currentTrick,
    })

    const heartQueen = c(SUIT_ENUM.HEARTS, 'Q')
    const winner = determineWinnerWithSpecialRules(
      {
        ...currentTrick,
        cards: [
          ...currentTrick.cards,
          { card: heartQueen, playerId: 'self', order: 3 },
        ],
      },
      SUIT_ENUM.DIAMONDS,
      false
    )

    // 参照実装ではよろめきで自分(♥Q)が勝つ = 自チームのまま
    expect(winner?.playerId).toBe('self')
    expect(
      isTrickSafeAfterPlaying(
        heartQueen,
        currentTrick,
        gameState,
        [heartQueen],
        isNapoleonTeam
      )
    ).toBe(true)
  })

  test('4枚目でセイム2 が成立して相手が取るなら確定しない', () => {
    // 全員♥（非切り札）で、既に♥2 が場にある。4枚目を足すとセイム2 が発動し、
    // ♥2 を出した連合軍が勝つ。
    const currentTrick = trick([
      { card: c(SUIT_ENUM.HEARTS, 'K'), playerId: napoleon.id },
      { card: c(SUIT_ENUM.HEARTS, '2'), playerId: ally1.id },
      { card: c(SUIT_ENUM.HEARTS, '7'), playerId: ally2.id },
    ])
    const gameState = baseGameState({
      players,
      trumpSuit: SUIT_ENUM.SPADES,
      leadingSuit: SUIT_ENUM.HEARTS,
      currentTrick,
    })

    const passed = c(SUIT_ENUM.HEARTS, '10')

    expect(
      isTrickSafeAfterPlaying(
        passed,
        currentTrick,
        gameState,
        [passed],
        isNapoleonTeam
      )
    ).toBe(false)
  })

  test('セイム2 の余地が残る3番手では確定しない', () => {
    // ♥リードで全員同スート、♥2 はまだ未確認 → 4枚揃えばセイム2 が成立しうる
    const currentTrick = trick([
      { card: c(SUIT_ENUM.HEARTS, 'K'), playerId: napoleon.id },
      { card: c(SUIT_ENUM.HEARTS, '7'), playerId: ally1.id },
    ])
    const gameState = baseGameState({
      players,
      trumpSuit: SUIT_ENUM.SPADES,
      leadingSuit: SUIT_ENUM.HEARTS,
      currentTrick,
    })

    const passed = c(SUIT_ENUM.HEARTS, '10')

    expect(
      isTrickSafeAfterPlaying(
        passed,
        currentTrick,
        gameState,
        [passed],
        isNapoleonTeam
      )
    ).toBe(false)
  })

  // 回帰: 「追加された未確認札そのものが勝つか」だけを見ていたため、
  // 特殊ルールで **既に場に出ている相手の札へ勝ちが移る** ケースを
  // 取りこぼして safe と誤判定していた（絵札を献上するバグ）。
  describe('勝ちが場の相手札に移るケースを検出する', () => {
    test('よろめき: 未確認の♥Q で勝ちが相手の裏J に移る', () => {
      // 切り札♥ → 裏J = ♦J。場は [相手:♦J, 味方:♦4]。
      // 自分がマイティ(♠A)を出すと今は自分が勝つが、未確認の♥Q が来ると
      // よろめきが成立し、♥Q 自身ではなく相手の♦J(裏J)が勝つ。
      const currentTrick = trick([
        { card: c(SUIT_ENUM.DIAMONDS, 'J'), playerId: ally1.id },
        { card: c(SUIT_ENUM.DIAMONDS, '4'), playerId: napoleon.id },
      ])
      const gameState = baseGameState({
        players,
        trumpSuit: SUIT_ENUM.HEARTS,
        leadingSuit: SUIT_ENUM.DIAMONDS,
        currentTrick,
      })

      const mighty = c(SUIT_ENUM.SPADES, 'A')

      // 前提: マイティを出せば「今は」自分が勝っている
      expect(wouldWinTrick(mighty, currentTrick, gameState)).toBe(true)

      // 前提: ♥Q 自身は勝たない（だから旧ロジックは見逃していた）
      const probe: Trick = {
        ...currentTrick,
        cards: [
          ...currentTrick.cards,
          { card: mighty, playerId: 'self', order: 2 },
          { card: c(SUIT_ENUM.HEARTS, 'Q'), playerId: 'threat', order: 3 },
        ],
      }
      const winner = determineWinnerWithSpecialRules(
        probe,
        SUIT_ENUM.HEARTS,
        false
      )
      expect(winner?.playerId).toBe(ally1.id)

      // よって確定していない
      expect(
        isTrickSafeAfterPlaying(
          mighty,
          currentTrick,
          gameState,
          [mighty],
          isNapoleonTeam
        )
      ).toBe(false)
    })

    test('狩りJ 無効化: 未確認の裏J で勝ちが相手の表J に戻る', () => {
      // 切り札♠ → 表J = ♠J、その狩J = ♥J、裏J = ♣J。
      // 場は [相手:♠J, 味方:♠5]。自分の♥J(狩J)は今は勝つが、
      // 未確認の♣J(裏J)が来ると狩りJ が無効化され相手の♠J が勝つ。
      const currentTrick = trick([
        { card: c(SUIT_ENUM.SPADES, 'J'), playerId: ally1.id },
        { card: c(SUIT_ENUM.SPADES, '5'), playerId: napoleon.id },
      ])
      const gameState = baseGameState({
        players,
        trumpSuit: SUIT_ENUM.SPADES,
        leadingSuit: SUIT_ENUM.SPADES,
        currentTrick,
      })

      const huntingJack = c(SUIT_ENUM.HEARTS, 'J')
      expect(wouldWinTrick(huntingJack, currentTrick, gameState)).toBe(true)

      expect(
        isTrickSafeAfterPlaying(
          huntingJack,
          currentTrick,
          gameState,
          [huntingJack],
          isNapoleonTeam
        )
      ).toBe(false)
    })

    test('不変条件: safe と判定したなら、未確認札をどう足しても自チームが勝つ', () => {
      // 3番手（残り1席）の局面を総当たりで検証する。
      const currentTrick = trick([
        { card: c(SUIT_ENUM.CLUBS, 'A'), playerId: napoleon.id },
        { card: c(SUIT_ENUM.CLUBS, '5'), playerId: ally1.id },
      ])
      const gameState = baseGameState({
        players,
        trumpSuit: SUIT_ENUM.DIAMONDS,
        leadingSuit: SUIT_ENUM.CLUBS,
        currentTrick,
      })

      const onTable = new Set(currentTrick.cards.map((pc) => pc.card.id))
      const myCards = DECK.filter(
        (card) => !onTable.has(card.id) && card.suit === SUIT_ENUM.CLUBS
      )

      for (const mine of myCards) {
        const safe = isTrickSafeAfterPlaying(
          mine,
          currentTrick,
          gameState,
          myCards,
          isNapoleonTeam
        )
        if (!safe) continue

        const withMine: Trick = {
          ...currentTrick,
          cards: [
            ...currentTrick.cards,
            { card: mine, playerId: 'self', order: 2 },
          ],
        }
        const seen = new Set([...onTable, ...myCards.map((card) => card.id)])

        for (const threat of DECK.filter((card) => !seen.has(card.id))) {
          const winner = determineWinnerWithSpecialRules(
            {
              ...withMine,
              cards: [
                ...withMine.cards,
                { card: threat, playerId: 'threat', order: 3 },
              ],
            },
            SUIT_ENUM.DIAMONDS,
            false
          )
          // safe と言った以上、どの未確認札が来ても自チームが勝つはず
          expect({
            mine: mine.id,
            threat: threat.id,
            winner: winner?.playerId,
          }).toEqual({
            mine: mine.id,
            threat: threat.id,
            winner: expect.stringMatching(/^(nap|self)$/),
          })
        }
      }
    })
  })

  test('相手の勝ち札を全て自分が握っていれば確定する', () => {
    // ♣リード、ナポレオンの♣A が勝っている。3番手の自分が♣K を渡す。
    // 残り1人が抜ける手段は切り札(♦)・マイティ・J 系・セイム2用の♣2 だが、
    // それらを全部自分の手札に握っているので理論上抜かれない。
    const currentTrick = trick([
      { card: c(SUIT_ENUM.CLUBS, 'A'), playerId: napoleon.id },
      { card: c(SUIT_ENUM.CLUBS, '5'), playerId: ally1.id },
    ])
    const gameState = baseGameState({
      players,
      trumpSuit: SUIT_ENUM.DIAMONDS,
      leadingSuit: SUIT_ENUM.CLUBS,
      currentTrick,
    })

    // 未確認札から「勝てる札」を全て自分の手札に入れる。
    // 加えて、4枚揃って初めて成立するセイム2 用の♣2 も握っておく
    // （これが場に残っていると最後の1人にセイム2 で取られうる）。
    const onTable = new Set(currentTrick.cards.map((pc) => pc.card.id))
    const threats = DECK.filter(
      (card) =>
        !onTable.has(card.id) && wouldWinTrick(card, currentTrick, gameState)
    )
    const passed = c(SUIT_ENUM.CLUBS, 'K')
    const same2Card = c(SUIT_ENUM.CLUBS, '2')
    const hand = [
      passed,
      same2Card,
      ...threats.filter(
        (card) => card.id !== passed.id && card.id !== same2Card.id
      ),
    ]

    expect(
      isTrickSafeAfterPlaying(
        passed,
        currentTrick,
        gameState,
        hand,
        isNapoleonTeam
      )
    ).toBe(true)
  })
})
