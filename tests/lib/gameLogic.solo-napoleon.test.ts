/**
 * 一人ナポレオン（副官指定カードが埋め札にあった場合）のテスト
 *
 * 副官指定カードが hiddenCards にあると、そのカードはカード交換でナポレオンの
 * 手札に入るため副官が成立しない。この場合は「ナポレオン＝副官」= 1 vs 3 として
 * 進行する。GameState.soloNapoleon がその状態を表す。
 */

import { type AIStrategyConfig, selectAICard } from '@/lib/ai/aiStrategy'
import { identifyAlliancePartners } from '@/lib/ai/alliance'
import { createDeck, GAME_PHASES, NAPOLEON_RULES } from '@/lib/constants'
import { maskGameStateForPlayer } from '@/lib/game/maskGameState'
import {
  checkNapoleonVictory,
  initializeGame,
  setAdjutant,
} from '@/lib/gameLogic'
import { findAdjutant, isAdjutantCardBuried } from '@/lib/napoleonRules'
import {
  calculateGameResult,
  getPlayerStats,
  getTeamFaceCardCounts,
} from '@/lib/scoring'
import type { Card, GameState, Trick } from '@/types/game'
import { isSoloNapoleon } from '@/utils/gameUtils'

const PLAYER_NAMES = ['Player1', 'Player2', 'Player3', 'Player4']

/**
 * 決定的な配札を作る。
 * initializeGame はシャッフルするため、埋め札の中身を固定するには
 * 手札と hiddenCards を明示的に置き換える必要がある。
 *
 * @param buryAdjutantCard true なら副官指定カードを埋め札に置く（一人ナポレオン）
 */
function createAdjutantPhaseState(buryAdjutantCard: boolean): {
  gameState: GameState
  adjutantCard: Card
} {
  const deck = createDeck()
  const gameState = initializeGame(PLAYER_NAMES)

  // 副官指定カードは常にハートのジャック
  const adjutantCard = deck.find(
    (card) => card.suit === 'hearts' && card.rank === 'J'
  )
  if (!adjutantCard) {
    throw new Error('Adjutant card fixture not found in deck')
  }

  const rest = deck.filter((card) => card.id !== adjutantCard.id)

  // 各プレイヤーに 12 枚ずつ。副官指定カードは最後に配置先を決める
  gameState.players.forEach((player, index) => {
    player.hand = rest.slice(index * 12, index * 12 + 12)
    player.isNapoleon = index === 0
    player.isAdjutant = false
  })

  if (buryAdjutantCard) {
    // 埋め札 4 枚のうち 1 枚が副官指定カード
    gameState.hiddenCards = [adjutantCard, ...rest.slice(48, 51)]
  } else {
    // Player2 の手札に副官指定カードを入れる（通常ケース）
    gameState.players[1].hand = [
      ...gameState.players[1].hand.slice(0, 11),
      adjutantCard,
    ]
    gameState.hiddenCards = [
      rest.slice(48, 51)[0],
      rest.slice(48, 51)[1],
      rest.slice(48, 51)[2],
      gameState.players[1].hand[0],
    ].slice(0, 4)
    // 手札から重複を除く
    gameState.players[1].hand = gameState.players[1].hand.slice(1)
  }

  gameState.napoleonDeclaration = {
    playerId: gameState.players[0].id,
    targetTricks: NAPOLEON_RULES.TARGET_FACE_CARDS,
    suit: 'spades',
    adjutantCard,
  }
  gameState.phase = GAME_PHASES.ADJUTANT

  return { gameState, adjutantCard }
}

/** 指定プレイヤーが勝った、絵札 `faceCardCount` 枚を含むトリックを作る */
function createWonTrick(
  id: string,
  winnerPlayerId: string,
  faceCards: Card[]
): Trick {
  return {
    id,
    completed: true,
    winnerPlayerId,
    cards: faceCards.map((card, order) => ({
      card,
      playerId: winnerPlayerId,
      order,
    })),
  }
}

describe('Solo Napoleon (buried adjutant card)', () => {
  describe('isAdjutantCardBuried / findAdjutant', () => {
    it('detects the adjutant card in hiddenCards', () => {
      const { gameState, adjutantCard } = createAdjutantPhaseState(true)

      expect(isAdjutantCardBuried(gameState, adjutantCard)).toBe(true)
      // 誰の手札にも無いので null
      expect(findAdjutant(gameState, adjutantCard)).toBeNull()
    })

    it('does not flag a normal (held) adjutant card as buried', () => {
      const { gameState, adjutantCard } = createAdjutantPhaseState(false)

      expect(isAdjutantCardBuried(gameState, adjutantCard)).toBe(false)
      expect(findAdjutant(gameState, adjutantCard)?.id).toBe(
        gameState.players[1].id
      )
    })
  })

  describe('setAdjutant', () => {
    it('marks the game as solo napoleon and assigns nobody as adjutant', () => {
      const { gameState, adjutantCard } = createAdjutantPhaseState(true)

      const result = setAdjutant(gameState, adjutantCard)

      expect(result.soloNapoleon).toBe(true)
      expect(isSoloNapoleon(result)).toBe(true)
      // 副官バッジが別人に付かないこと
      expect(result.players.filter((p) => p.isAdjutant)).toHaveLength(0)
      // ナポレオンにも isAdjutant は立てない（AI 戦略の分岐が壊れるため）
      const napoleon = result.players.find((p) => p.isNapoleon)
      expect(napoleon?.isAdjutant).toBe(false)
    })

    it('gives the buried adjutant card to Napoleon with wasHidden flag', () => {
      const { gameState, adjutantCard } = createAdjutantPhaseState(true)

      const result = setAdjutant(gameState, adjutantCard)
      const napoleon = result.players.find((p) => p.isNapoleon)

      const received = napoleon?.hand.find((c) => c.id === adjutantCard.id)
      expect(received).toBeDefined()
      expect(received?.wasHidden).toBe(true)
      expect(napoleon?.hand).toHaveLength(16)
    })

    it('keeps soloNapoleon false and assigns the adjutant in a normal game', () => {
      const { gameState, adjutantCard } = createAdjutantPhaseState(false)

      const result = setAdjutant(gameState, adjutantCard)

      expect(result.soloNapoleon).toBe(false)
      expect(isSoloNapoleon(result)).toBe(false)
      const adjutants = result.players.filter((p) => p.isAdjutant)
      expect(adjutants).toHaveLength(1)
      expect(adjutants[0].id).toBe(gameState.players[1].id)
    })
  })

  describe('scoring is not double counted', () => {
    /**
     * 一人ナポレオンではナポレオン 1 人がチーム全体。
     * 「ナポレオン側」を isNapoleon と isAdjutant の和で集計している箇所が
     * あると、同一人物のトリックを 2 回数えてしまう危険がある。
     */
    const faceCard = (id: string): Card => ({
      id,
      suit: 'spades',
      rank: 'K',
      value: 13,
    })

    function buildFinishedSoloState(): GameState {
      const { gameState, adjutantCard } = createAdjutantPhaseState(true)
      const afterAdjutant = setAdjutant(gameState, adjutantCard)
      const napoleonId = afterAdjutant.players[0].id
      const citizenId = afterAdjutant.players[1].id

      return {
        ...afterAdjutant,
        phase: GAME_PHASES.FINISHED,
        tricks: [
          // ナポレオンが絵札 2 枚を含むトリックを取る
          createWonTrick('t1', napoleonId, [faceCard('f1'), faceCard('f2')]),
          // 連合軍が絵札 1 枚を含むトリックを取る
          createWonTrick('t2', citizenId, [faceCard('f3')]),
        ],
      }
    }

    it('counts Napoleon team face cards exactly once', () => {
      const state = buildFinishedSoloState()

      const counts = getTeamFaceCardCounts(state)
      // 2 枚（4 枚ではない）
      expect(counts.napoleonTeam).toBe(2)
      expect(counts.citizenTeam).toBe(1)
    })

    it('does not double count even if Napoleon were also flagged as adjutant', () => {
      // 将来 isAdjutant をナポレオンに立てる実装へ変わっても
      // 集計が壊れないことを保証する回帰テスト
      const state = buildFinishedSoloState()
      const withBothFlags: GameState = {
        ...state,
        players: state.players.map((p) =>
          p.isNapoleon ? { ...p, isAdjutant: true } : p
        ),
      }

      expect(getTeamFaceCardCounts(withBothFlags).napoleonTeam).toBe(2)

      const result = calculateGameResult(withBothFlags)
      expect(result.faceCardsWon).toBe(2)
      // ナポレオンのスコアは 1 件だけ（副官として二重に加点されない）
      const napoleonScores = result.scores.filter(
        (s) => s.playerId === withBothFlags.players[0].id
      )
      expect(napoleonScores).toHaveLength(1)
    })

    it('checkNapoleonVictory does not count a trick twice for a solo napoleon', () => {
      const state = buildFinishedSoloState()
      const napoleonId = state.players[0].id

      // ナポレオンが 5 トリック取った状態（副官フラグも同時に立てる）
      const tricks = Array.from({ length: 5 }, (_, i) =>
        createWonTrick(`n${i}`, napoleonId, [faceCard(`nf${i}`)])
      )
      const withBothFlags: GameState = {
        ...state,
        tricks,
        players: state.players.map((p) =>
          p.isNapoleon ? { ...p, isAdjutant: true } : p
        ),
      }

      // 二重計上されれば 10 トリック扱いになり 8 以上で true になってしまう
      expect(checkNapoleonVictory(withBothFlags)).toBe(false)
    })

    it('treats all three non-Napoleon players as Allied Forces', () => {
      const state = buildFinishedSoloState()
      const result = calculateGameResult(state)

      // 副官は存在しない
      expect(result.adjutantPlayerId).toBeUndefined()

      const roles = state.players.map((p) => getPlayerStats(state, p.id)?.role)
      expect(roles).toEqual(['napoleon', 'citizen', 'citizen', 'citizen'])
    })
  })

  describe('masking (adjutant identity secrecy)', () => {
    function buildPlayingSoloState(): GameState {
      const { gameState, adjutantCard } = createAdjutantPhaseState(true)
      return {
        ...setAdjutant(gameState, adjutantCard),
        phase: GAME_PHASES.PLAYING,
      }
    }

    it('hides soloNapoleon from Allied Forces before it is revealed', () => {
      const state = buildPlayingSoloState()
      const citizenId = state.players[1].id

      const masked = maskGameStateForPlayer(state, citizenId)

      expect(masked.soloNapoleon).toBeUndefined()
      expect(isSoloNapoleon(masked)).toBe(false)
    })

    it('always shows soloNapoleon to Napoleon (they hold the card)', () => {
      const state = buildPlayingSoloState()
      const napoleonId = state.players[0].id

      const masked = maskGameStateForPlayer(state, napoleonId)

      expect(masked.soloNapoleon).toBe(true)
    })

    it('does not leak "an adjutant exists" in a normal game either', () => {
      // 通常ゲームでも未公開時は undefined。false を返すと
      // 一人ナポレオンかどうかを区別できてしまうため。
      const { gameState, adjutantCard } = createAdjutantPhaseState(false)
      const state: GameState = {
        ...setAdjutant(gameState, adjutantCard),
        phase: GAME_PHASES.PLAYING,
      }
      const citizenId = state.players[2].id

      const masked = maskGameStateForPlayer(state, citizenId)

      expect(masked.soloNapoleon).toBeUndefined()
    })

    it('reveals soloNapoleon to everyone once the game is finished', () => {
      const state: GameState = {
        ...buildPlayingSoloState(),
        phase: GAME_PHASES.FINISHED,
      }
      const citizenId = state.players[1].id

      const masked = maskGameStateForPlayer(state, citizenId)

      expect(masked.soloNapoleon).toBe(true)
    })

    it('reveals soloNapoleon once Napoleon plays the buried adjutant card', () => {
      const state = buildPlayingSoloState()
      const napoleonId = state.players[0].id
      const citizenId = state.players[1].id

      const revealedState: GameState = {
        ...state,
        currentTrick: {
          ...state.currentTrick,
          cards: [
            {
              card: state.napoleonCard as Card,
              playerId: napoleonId,
              order: 0,
              revealsAdjutant: true,
            },
          ],
        },
      }

      const masked = maskGameStateForPlayer(revealedState, citizenId)

      expect(masked.soloNapoleon).toBe(true)
    })
  })

  describe('AI behaviour', () => {
    function buildPlayingSoloState(): GameState {
      const { gameState, adjutantCard } = createAdjutantPhaseState(true)
      return {
        ...setAdjutant(gameState, adjutantCard),
        phase: GAME_PHASES.PLAYING,
      }
    }

    it('treats the other two non-Napoleon players as alliance partners', () => {
      const state = buildPlayingSoloState()
      const citizen = state.players[1]

      const partners = identifyAlliancePartners(state, citizen.id)

      // ナポレオンと自分を除いた 2 人
      expect(partners).toHaveLength(2)
      expect(partners).toEqual([state.players[2].id, state.players[3].id])
      expect(partners).not.toContain(state.players[0].id)
    })

    it('selects a playable card for Napoleon without an adjutant present', () => {
      const state = buildPlayingSoloState()
      // ナポレオンは交換前なので 16 枚。12 枚に減らして通常局面に近づける
      const napoleon = { ...state.players[0] }
      napoleon.hand = napoleon.hand.slice(0, 12)
      const playingState: GameState = {
        ...state,
        players: state.players.map((p) => (p.isNapoleon ? napoleon : p)),
      }
      const config: AIStrategyConfig = {
        strategy: 'heuristic',
        difficulty: 'easy',
      }

      const selected = selectAICard(playingState, napoleon, config)

      expect(selected).not.toBeNull()
      expect(napoleon.hand).toContainEqual(selected)
    })

    it('selects a playable card for an Allied Forces player', () => {
      const state = buildPlayingSoloState()
      const citizen = state.players[2]
      const config: AIStrategyConfig = {
        strategy: 'heuristic',
        difficulty: 'easy',
      }

      const selected = selectAICard(state, citizen, config)

      expect(selected).not.toBeNull()
      expect(citizen.hand).toContainEqual(selected)
    })
  })
})
