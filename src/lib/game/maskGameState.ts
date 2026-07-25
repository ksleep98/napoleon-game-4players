/**
 * ゲーム状態のマスキング（F-3 対策）
 *
 * サーバーは全プレイヤーの手札を保持するが、クライアントへ返す際は
 * 閲覧者本人以外の手札と伏せ札をダミーカードへ置き換える。
 * 枚数は保持するため、`hand.length` に依存する UI（OpponentHand /
 * GameBoard / scoring の cardsInHand）はそのまま動作する。
 *
 * AI の思考はすべてサーバーサイド（processAITurn / processAIPlayingPhase）で
 * 行われ、DB から読み直した未マスクの状態を使うため、マスキングの影響を受けない。
 */

import { MASKED_CARD } from '@/lib/constants'
import type { Card, GameState } from '@/types/game'

function createMaskedCard(ownerKey: string, index: number): Card {
  return {
    id: `${MASKED_CARD.ID_PREFIX}${ownerKey}_${index}`,
    suit: MASKED_CARD.SUIT,
    rank: MASKED_CARD.RANK,
    value: MASKED_CARD.VALUE,
  }
}

function maskCards(cards: Card[], ownerKey: string): Card[] {
  return cards.map((_, index) => createMaskedCard(ownerKey, index))
}

/**
 * 閲覧者以外の手札・伏せ札をマスクしたゲーム状態を返す
 * @param gameState 未マスクのゲーム状態
 * @param viewerPlayerId 閲覧者（認証済みプレイヤー）のID
 */
export function maskGameStateForPlayer(
  gameState: GameState,
  viewerPlayerId: string
): GameState {
  return {
    ...gameState,
    players: gameState.players.map((player) =>
      player.id === viewerPlayerId
        ? player
        : { ...player, hand: maskCards(player.hand, player.id) }
    ),
    hiddenCards: maskCards(
      gameState.hiddenCards,
      MASKED_CARD.HIDDEN_PILE_OWNER
    ),
    // ナポレオンが交換で捨てた札もクライアントには公開しない
    exchangedCards: gameState.exchangedCards
      ? maskCards(gameState.exchangedCards, MASKED_CARD.HIDDEN_PILE_OWNER)
      : undefined,
  }
}
