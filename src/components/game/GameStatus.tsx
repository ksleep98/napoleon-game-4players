'use client'

import {
  BIDDING_LABELS,
  DECLARATION_LABELS,
  GAME_PHASES,
  PLAYER_ROLES,
  SOLO_NAPOLEON_LABELS,
  SUIT_SYMBOLS,
} from '@/lib/constants'
import { getPlayerStats } from '@/lib/scoring'
import type { GameState } from '@/types/game'
import {
  checkAdjutantRevealed,
  isAdjutantIdentityPublic,
  isSoloNapoleon,
  showsAdjutantBadge,
} from '@/utils/gameUtils'
import {
  ADJUTANT_BADGE_SUIT_LABELS,
  ADJUTANT_BADGE_TONES,
  AdjutantCardBadge,
} from './AdjutantCardBadge'

interface GameStatusProps {
  gameState: GameState
  currentPlayerId?: string | null
}

export function GameStatus({ gameState, currentPlayerId }: GameStatusProps) {
  const napoleonPlayer = gameState.players.find((p) => p.isNapoleon)
  const adjutantPlayer = gameState.players.find((p) => p.isAdjutant)
  // マスク済みなので、閲覧者に公開してよい場合のみ true になる
  const soloNapoleon = isSoloNapoleon(gameState)

  // 競りの最中。declareNapoleon は宣言のたびに isNapoleon / trumpSuit を
  // 立てるため、この時点でも napoleonPlayer は取れてしまうが、それは
  // 「現在の最高提示者」でしかない。まだ誰でも上乗せしてナポレオンを
  // 奪えるので、確定したチーム・役職として見せてはいけない
  const isBidding = gameState.phase === GAME_PHASES.NAPOLEON

  const currentPlayerStats = currentPlayerId
    ? getPlayerStats(gameState, currentPlayerId)
    : null

  const getRoleDisplay = (role: string) => {
    const roleMap = {
      napoleon: PLAYER_ROLES.NAPOLEON,
      adjutant: PLAYER_ROLES.ADJUTANT,
      citizen: PLAYER_ROLES.ALLIED_FORCES,
    }
    return roleMap[role as keyof typeof roleMap] || role
  }

  // 副官の正体を出してよいかは共通ヘルパーに委ねる。
  // 旧実装はここで `phase === PLAYING` を先頭条件に置いた独自式を持っていたが、
  // GameStatus は PLAYING では描画されない（PLAYING は page.tsx の専用
  // レイアウトが TopHUD だけを出す）ため、常に false になっていた。
  // その結果、実際に描画される終了画面でも副官が「??? (Hidden)」のままだった。
  // 判定を二重に持たず isAdjutantIdentityPublic に一本化する
  // （競り前フェーズはトリックが 1 つも無いので、従来どおり非公開のまま）
  const isAdjutantRevealed = isAdjutantIdentityPublic(gameState)

  // 副官指定カードが実際に場に出たか。早期終了（isGameDecided）では
  // 1 度も出ないまま終わるため、「このカードで見つかった」という表示だけは
  // 正体の公開可否ではなくカードが出たかどうかで判定する
  const adjutantCardPlayed = checkAdjutantRevealed(gameState)

  // 一人ナポレオンで公開済みなら、ナポレオン本人を副官としても表示する。
  // 判定は共通ヘルパーに委ねる（player.isAdjutant は立てていない）
  const showNapoleonAsAdjutant = napoleonPlayer
    ? showsAdjutantBadge({
        player: napoleonPlayer,
        soloNapoleon,
        isAdjutantRevealed,
      })
    : false

  return (
    <div className="bg-white rounded-lg shadow-md p-2 md:p-4 space-y-2 md:space-y-4">
      {/* ゲーム基本情報 - Phase と Game ID を非表示 */}
      <div className="border-b pb-2 md:pb-3">
        <h3 className="font-bold text-base md:text-lg text-gray-800">
          Game Status
        </h3>
      </div>

      {/* ナポレオン宣言情報 - モバイル最適化 */}
      {gameState.napoleonDeclaration && (
        <div className="border-b pb-2 md:pb-3">
          <h4 className="font-semibold text-sm md:text-base text-gray-800 mb-1 md:mb-2">
            {isBidding ? BIDDING_LABELS.SECTION_TITLE : 'Napoleon Declaration'}
          </h4>
          <div className="bg-yellow-50 border border-yellow-200 p-2 md:p-3 rounded-lg">
            <div className="flex items-center justify-center gap-2 md:gap-4 text-sm">
              <div className="text-center">
                <div className="text-base md:text-xl font-bold text-yellow-700">
                  {gameState.napoleonDeclaration.targetTricks}
                </div>
                {/* targetTricks は「絵札数」。トリック数ではないので
                    ラベルを face cards にして誤解を防ぐ */}
                <div className="text-[0.6rem] md:text-xs text-yellow-600">
                  {DECLARATION_LABELS.FACE_CARDS}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xl md:text-2xl font-bold text-yellow-700">
                  {SUIT_SYMBOLS[gameState.napoleonDeclaration.suit]}
                </div>
                <div className="text-[0.6rem] md:text-xs text-yellow-600 capitalize">
                  {gameState.napoleonDeclaration.suit}
                </div>
              </div>
            </div>
            <div className="text-center text-xs md:text-sm text-yellow-700 mt-1 md:mt-2">
              <span className="font-semibold">
                {isBidding ? BIDDING_LABELS.BID_BY : 'Declared by:'}{' '}
                {napoleonPlayer?.name}
              </span>
            </div>
            {isBidding && (
              <div className="text-center text-[0.6rem] md:text-xs text-gray-600 mt-1">
                {BIDDING_LABELS.UNDECIDED_NOTE}
              </div>
            )}
            {/* 副官「指定カード」は宣言が確定したあとの公開情報。
                競りの最中は maskGameStateForPlayer が宣言者以外へ渡さないため、
                ここは undefined になり表示されない */}
            {gameState.napoleonCard && (
              <div className="flex justify-center mt-2 pt-2 border-t border-yellow-200">
                <AdjutantCardBadge
                  card={gameState.napoleonCard}
                  tone={ADJUTANT_BADGE_TONES.LIGHT}
                  suitLabel={ADJUTANT_BADGE_SUIT_LABELS.JA}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* チーム構成 - 副官は判明した場合のみ表示。
          競りの最中は「Napoleon / Adjutant / Allied Forces」がまだ確定して
          いないので出さない（上乗せすれば閲覧者自身がナポレオンになりうる）。
          最高提示者は上の Current Highest Bid ブロックが示している */}
      {napoleonPlayer && !isBidding && (
        <div className="border-b pb-3">
          <h4 className="font-semibold text-gray-800 mb-2">Teams</h4>
          <div className="space-y-2 text-sm">
            {/* 一人ナポレオンの公開後は、同じ 1 行に Napoleon と Adjutant の
                両方のピルを並べる。副官用の行を別に作るとナポレオンが 2 行に
                重複表示されてしまうため、必ずこの行だけで表現する */}
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-yellow-200 text-yellow-800 rounded-full text-xs font-bold">
                {PLAYER_ROLES.NAPOLEON}
              </span>
              {showNapoleonAsAdjutant && (
                <span className="px-2 py-1 bg-green-200 text-green-800 rounded-full text-xs font-bold">
                  {PLAYER_ROLES.ADJUTANT}
                </span>
              )}
              <span>{napoleonPlayer.name}</span>
            </div>
            {/* 一人ナポレオン: 副官指定カードが埋め札にあり副官が不在。
                「??? (Hidden)」を出し続けると存在しない副官を待たせてしまう */}
            {soloNapoleon && (
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-orange-200 text-orange-800 rounded-full text-xs font-bold">
                  {SOLO_NAPOLEON_LABELS.BADGE}
                </span>
                <span className="text-gray-600">
                  {SOLO_NAPOLEON_LABELS.TEAM_NOTE}
                </span>
              </div>
            )}
            {!soloNapoleon && isAdjutantRevealed && adjutantPlayer && (
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-green-200 text-green-800 rounded-full text-xs font-bold">
                  {PLAYER_ROLES.ADJUTANT}
                </span>
                <span>{adjutantPlayer.name}</span>
              </div>
            )}
            {!soloNapoleon && !isAdjutantRevealed && (
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-gray-200 text-gray-600 rounded-full text-xs font-bold">
                  {PLAYER_ROLES.ADJUTANT}
                </span>
                <span className="text-gray-600">??? (Hidden)</span>
              </div>
            )}
            <div className="text-xs text-gray-500 mt-2">
              Allied Forces:{' '}
              {gameState.players
                .filter(
                  (p) => !p.isNapoleon && (!isAdjutantRevealed || !p.isAdjutant)
                )
                .map((p) => p.name)
                .join(', ')}
              {!soloNapoleon &&
                !isAdjutantRevealed &&
                ' (includes hidden adjutant)'}
            </div>
          </div>
        </div>
      )}

      {/* 切り札スート表示 - 非PLAYINGフェーズのみ（PLAYING中はTopHUDに表示） */}
      {gameState.phase !== GAME_PHASES.PLAYING && gameState.trumpSuit && (
        <div className="border-b pb-3">
          <h4 className="font-semibold text-gray-800 mb-2">Trump Suit</h4>
          <div className="flex items-center justify-center bg-red-50 border border-red-200 p-3 rounded-lg">
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">
                {SUIT_SYMBOLS[gameState.trumpSuit]}
              </div>
              <div className="text-sm text-red-600 capitalize font-medium">
                {gameState.trumpSuit}
              </div>
            </div>
          </div>
        </div>
      )}

      {currentPlayerStats && (
        <div className="border-b pb-3">
          <h4 className="font-semibold text-gray-800 mb-2">Your Stats</h4>
          <div className="space-y-1 text-sm">
            {/* 競り中の role は「今のところナポレオンではない」だけの暫定値。
                Allied Forces と断定表示すると、上乗せでナポレオンになれる
                ことが伝わらないので出さない */}
            {!isBidding && (
              <div className="flex justify-between">
                <span>Role:</span>
                <span className="font-medium">
                  {getRoleDisplay(currentPlayerStats.role)}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Face Cards Won:</span>
              <span>{currentPlayerStats.faceCardsWon}</span>
            </div>
            <div className="flex justify-between">
              <span>Cards in Hand:</span>
              <span>{currentPlayerStats.cardsInHand}</span>
            </div>
            <div className="flex justify-between">
              <span>Cards Played:</span>
              <span>{currentPlayerStats.cardsPlayed}</span>
            </div>
          </div>
        </div>
      )}

      {/* 現在のトリック情報 */}
      {gameState.currentTrick.cards.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-800 mb-2">Current Trick</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Cards Played:</span>
              <span>{gameState.currentTrick.cards.length}/4</span>
            </div>
            {gameState.leadingSuit && (
              <div className="flex justify-between">
                <span>Leading Suit:</span>
                <span className="capitalize">{gameState.leadingSuit}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 「このカードで副官が見つかった」は、指定カードが実際に場に出た
          ときだけ意味を持つ。早期終了で 1 度も出ずに終わった場合に出すと嘘になる */}
      {gameState.napoleonCard && adjutantCardPlayed && (
        <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
          <div className="text-sm text-green-700">
            <span className="font-semibold">
              {PLAYER_ROLES.ADJUTANT} was found by:{' '}
            </span>
            <span>
              {gameState.napoleonCard.rank} of {gameState.napoleonCard.suit}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
