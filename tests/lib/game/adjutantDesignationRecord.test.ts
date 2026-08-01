/**
 * 副官指定カードが `napoleonDeclaration.adjutantCard` に必ず記録されることの不変条件
 *
 * AI ナポレオンは宣言時に副官カードまで決めるが、人間ナポレオンは宣言後に
 * AdjutantSelector で選ぶ（setAdjutantAction → gameLogic.setAdjutant）。
 * そのため人間の局では `napoleonCard` だけが埋まり、
 * `napoleonDeclaration.adjutantCard` が undefined のまま保存されていた
 * （実際に壊れたゲーム game_1785552113648_0bkhfcut3 の declaration にも
 * adjutantCard フィールドが無い）。
 *
 * playCard の revealsAdjutant 判定と DeclarationDisplay は
 * `napoleonDeclaration.adjutantCard` を見るため、未設定だと
 * 一人ナポレオンで埋め札の副官カードを出しても公開フラグが立たない。
 */

import { CARD_RANKS, createDeck, GAME_PHASES, SUIT_ENUM } from '@/lib/constants'
import { playCard, setAdjutant } from '@/lib/gameLogic'
import type { Card, GameState, Player, Rank, Suit } from '@/types/game'

const DECK = createDeck()

function card(suit: Suit, rank: Rank): Card {
  const found = DECK.find((c) => c.suit === suit && c.rank === rank)
  if (!found) {
    throw new Error(`card not found: ${suit} ${rank}`)
  }
  return { ...found }
}

const NAPOLEON_ID = 'player_1'
const OTHER_IDS = ['player_2', 'player_3', 'player_4']
const TRUMP_SUIT: Suit = SUIT_ENUM.HEARTS
const ADJUTANT_CARD = card(SUIT_ENUM.SPADES, CARD_RANKS.ACE)

function makePlayer(id: string, position: number, hand: Card[]): Player {
  return {
    id,
    name: id,
    hand,
    isNapoleon: id === NAPOLEON_ID,
    isAdjutant: false,
    position,
    isAI: id !== NAPOLEON_ID,
  }
}

/** ナポレオンが人間の局: 宣言に adjutantCard を含めずに ADJUTANT フェーズへ来る */
function adjutantPhaseStateWithoutDeclaredCard(options: {
  buryAdjutantCard: boolean
}): GameState {
  const filler = DECK.filter(
    (c) => c.id !== ADJUTANT_CARD.id && c.suit !== SUIT_ENUM.SPADES
  )

  const hiddenCards = options.buryAdjutantCard
    ? [ADJUTANT_CARD, ...filler.slice(0, 3)]
    : filler.slice(0, 4)

  const holderHand = options.buryAdjutantCard
    ? filler.slice(4, 8)
    : [ADJUTANT_CARD, ...filler.slice(4, 7)]

  return {
    id: 'game_adjutant_record',
    players: [
      makePlayer(NAPOLEON_ID, 1, filler.slice(8, 12)),
      makePlayer(OTHER_IDS[0], 2, holderHand),
      makePlayer(OTHER_IDS[1], 3, filler.slice(12, 16)),
      makePlayer(OTHER_IDS[2], 4, filler.slice(16, 20)),
    ],
    currentTrick: { id: 'trick_1', cards: [], completed: false },
    tricks: [],
    currentPlayerIndex: 0,
    phase: GAME_PHASES.ADJUTANT,
    // 人間ナポレオンの宣言には adjutantCard が入らない
    napoleonDeclaration: {
      playerId: NAPOLEON_ID,
      targetTricks: 15,
      suit: TRUMP_SUIT,
    },
    trumpSuit: TRUMP_SUIT,
    hiddenCards,
    passedPlayers: [],
    declarationTurn: 0,
    needsRedeal: false,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  }
}

describe('setAdjutant records the designation card on the declaration', () => {
  it('fills napoleonDeclaration.adjutantCard when the declaration had none', () => {
    const state = adjutantPhaseStateWithoutDeclaredCard({
      buryAdjutantCard: false,
    })
    expect(state.napoleonDeclaration?.adjutantCard).toBeUndefined()

    const result = setAdjutant(state, ADJUTANT_CARD)

    expect(result.napoleonDeclaration?.adjutantCard?.id).toBe(ADJUTANT_CARD.id)
  })

  it('keeps napoleonCard and napoleonDeclaration.adjutantCard in sync', () => {
    const state = adjutantPhaseStateWithoutDeclaredCard({
      buryAdjutantCard: false,
    })

    const result = setAdjutant(state, ADJUTANT_CARD)

    expect(result.napoleonCard?.id).toBe(
      result.napoleonDeclaration?.adjutantCard?.id
    )
  })

  it('lets a human Napoleon reveal a buried adjutant card when playing it', () => {
    const adjutantPhase = adjutantPhaseStateWithoutDeclaredCard({
      buryAdjutantCard: true,
    })
    const afterAdjutant = setAdjutant(adjutantPhase, ADJUTANT_CARD)

    // 交換フェーズを飛ばして、埋め札を受け取ったナポレオンの手番から打つ
    const playing: GameState = {
      ...afterAdjutant,
      phase: GAME_PHASES.PLAYING,
      currentPlayerIndex: 0,
    }

    const played = playCard(playing, NAPOLEON_ID, ADJUTANT_CARD.id)

    expect(played.currentTrick.cards[0].revealsAdjutant).toBe(true)
  })
})
