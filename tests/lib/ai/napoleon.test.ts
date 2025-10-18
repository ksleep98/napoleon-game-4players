/**
 * ナポレオンAI戦略のテスト
 */

import { selectAdjutantCard } from '@/lib/ai/napoleon'
import type { Card } from '@/types/game'

// テスト用のモックカード作成
const createMockCard = (
  id: string,
  suit: 'spades' | 'hearts' | 'diamonds' | 'clubs',
  rank:
    | 'A'
    | 'K'
    | 'Q'
    | 'J'
    | '10'
    | '9'
    | '8'
    | '7'
    | '6'
    | '5'
    | '4'
    | '3'
    | '2',
  value: number
): Card => ({
  id,
  suit,
  rank,
  value,
})

describe('Napoleon AI Strategy - Adjutant Card Selection', () => {
  describe('マイティー・表J・裏Jの優先選択', () => {
    test('マイティー（スペードA）を持っていない場合、最優先で選択される', () => {
      // スペードA以外のカードを持つ手札
      const hand = [
        createMockCard('hearts-A', 'hearts', 'A', 14),
        createMockCard('clubs-K', 'clubs', 'K', 13),
        createMockCard('diamonds-Q', 'diamonds', 'Q', 12),
      ]

      const adjutantCard = selectAdjutantCard(hand, 'hearts')

      expect(adjutantCard).toEqual({
        id: 'spades-A',
        suit: 'spades',
        rank: 'A',
        value: 14,
      })
    })

    test('マイティーを持っている場合、表J（切り札J）が選択される', () => {
      // スペードAは持っているが、ハートJ（表J）は持っていない
      const hand = [
        createMockCard('spades-A', 'spades', 'A', 14), // マイティーを所持
        createMockCard('clubs-K', 'clubs', 'K', 13),
        createMockCard('diamonds-Q', 'diamonds', 'Q', 12),
      ]

      const adjutantCard = selectAdjutantCard(hand, 'hearts')

      expect(adjutantCard).toEqual({
        id: 'hearts-J',
        suit: 'hearts',
        rank: 'J',
        value: 11,
      })
    })

    test('マイティーと表Jを持っている場合、裏J（同色反対スートJ）が選択される', () => {
      // スペードAとハートJ（表J）を持っているが、ダイヤJ（裏J）は持っていない
      const hand = [
        createMockCard('spades-A', 'spades', 'A', 14), // マイティーを所持
        createMockCard('hearts-J', 'hearts', 'J', 11), // 表Jを所持
        createMockCard('clubs-K', 'clubs', 'K', 13),
      ]

      const adjutantCard = selectAdjutantCard(hand, 'hearts')

      expect(adjutantCard).toEqual({
        id: 'diamonds-J',
        suit: 'diamonds',
        rank: 'J',
        value: 11,
      })
    })

    test('切り札がスペードの場合、裏Jはクラブになる', () => {
      const hand = [
        createMockCard('spades-A', 'spades', 'A', 14), // マイティーを所持
        createMockCard('spades-J', 'spades', 'J', 11), // 表Jを所持
        createMockCard('hearts-K', 'hearts', 'K', 13),
      ]

      const adjutantCard = selectAdjutantCard(hand, 'spades')

      expect(adjutantCard).toEqual({
        id: 'clubs-J',
        suit: 'clubs',
        rank: 'J',
        value: 11,
      })
    })

    test('切り札がクラブの場合、裏Jはスペードになる', () => {
      const hand = [
        createMockCard('spades-A', 'spades', 'A', 14), // マイティーを所持
        createMockCard('clubs-J', 'clubs', 'J', 11), // 表Jを所持
        createMockCard('hearts-K', 'hearts', 'K', 13),
      ]

      const adjutantCard = selectAdjutantCard(hand, 'clubs')

      expect(adjutantCard).toEqual({
        id: 'spades-J',
        suit: 'spades',
        rank: 'J',
        value: 11,
      })
    })

    test('切り札がダイヤの場合、裏Jはハートになる', () => {
      const hand = [
        createMockCard('spades-A', 'spades', 'A', 14), // マイティーを所持
        createMockCard('diamonds-J', 'diamonds', 'J', 11), // 表Jを所持
        createMockCard('clubs-K', 'clubs', 'K', 13),
      ]

      const adjutantCard = selectAdjutantCard(hand, 'diamonds')

      expect(adjutantCard).toEqual({
        id: 'hearts-J',
        suit: 'hearts',
        rank: 'J',
        value: 11,
      })
    })

    test('マイティー、表J、裏Jをすべて持っている場合、従来ロジックで選択される', () => {
      // 特殊カードをすべて所持
      const hand = [
        createMockCard('spades-A', 'spades', 'A', 14), // マイティーを所持
        createMockCard('hearts-J', 'hearts', 'J', 11), // 表Jを所持
        createMockCard('diamonds-J', 'diamonds', 'J', 11), // 裏Jを所持
        createMockCard('clubs-2', 'clubs', '2', 2),
      ]

      const adjutantCard = selectAdjutantCard(hand, 'hearts')

      // 従来ロジックで最初に見つかるA（ハートA）が選択されるはず
      expect(adjutantCard?.rank).toBe('A')
      expect(adjutantCard?.suit).not.toBe('spades') // スペードA以外のA
    })
  })

  describe('フォールバック動作', () => {
    test('手札が空の場合でもエラーにならない', () => {
      const hand: Card[] = []
      const adjutantCard = selectAdjutantCard(hand, 'hearts')

      expect(adjutantCard).toEqual({
        id: 'spades-A',
        suit: 'spades',
        rank: 'A',
        value: 14,
      })
    })

    test('すべてのカードを持っている場合、nullが返される', () => {
      // 全52枚のカードを作成（実際にはあり得ないが、テストのため）
      const hand = [
        // すべてのA
        createMockCard('spades-A', 'spades', 'A', 14),
        createMockCard('hearts-A', 'hearts', 'A', 14),
        createMockCard('diamonds-A', 'diamonds', 'A', 14),
        createMockCard('clubs-A', 'clubs', 'A', 14),
        // すべてのK
        createMockCard('spades-K', 'spades', 'K', 13),
        createMockCard('hearts-K', 'hearts', 'K', 13),
        createMockCard('diamonds-K', 'diamonds', 'K', 13),
        createMockCard('clubs-K', 'clubs', 'K', 13),
        // すべてのQ
        createMockCard('spades-Q', 'spades', 'Q', 12),
        createMockCard('hearts-Q', 'hearts', 'Q', 12),
        createMockCard('diamonds-Q', 'diamonds', 'Q', 12),
        createMockCard('clubs-Q', 'clubs', 'Q', 12),
        // すべてのJ
        createMockCard('spades-J', 'spades', 'J', 11),
        createMockCard('hearts-J', 'hearts', 'J', 11),
        createMockCard('diamonds-J', 'diamonds', 'J', 11),
        createMockCard('clubs-J', 'clubs', 'J', 11),
      ]

      const adjutantCard = selectAdjutantCard(hand, 'hearts')

      expect(adjutantCard).toBeNull()
    })
  })
})
