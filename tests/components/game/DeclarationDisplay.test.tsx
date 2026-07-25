import { render, screen } from '@testing-library/react'
import { DeclarationDisplay } from '@/components/game/DeclarationDisplay'
import { ADJUTANT_CARD_LABEL, SUIT_NAMES } from '@/lib/constants'
import type { Card, NapoleonDeclaration } from '@/types/game'

const adjutantCard: Card = {
  id: 'adjutant-card',
  suit: 'hearts',
  rank: 'A',
  value: 14,
}

const declaration: NapoleonDeclaration = {
  playerId: 'napoleon-player',
  targetTricks: 14,
  suit: 'spades',
  adjutantCard,
}

describe('DeclarationDisplay adjutant card wording', () => {
  it('states the suit in Japanese, matching the trump suit wording in the same panel', () => {
    render(<DeclarationDisplay declaration={declaration} />)

    // 切り札
    expect(screen.getByText(SUIT_NAMES.spades)).toBeInTheDocument()
    // 副官指定カード（同じパネル内なので同じ表記に揃える）
    expect(screen.getByText(ADJUTANT_CARD_LABEL)).toBeInTheDocument()
    expect(
      screen.getByText(`${adjutantCard.rank} ${SUIT_NAMES.hearts}`)
    ).toBeVisible()
  })

  it('never leaks the raw suit key as display text', () => {
    render(<DeclarationDisplay declaration={declaration} />)

    expect(
      screen.queryByText(`${adjutantCard.rank} ${adjutantCard.suit}`)
    ).not.toBeInTheDocument()
  })

  it('omits the badge when no adjutant card has been designated', () => {
    render(
      <DeclarationDisplay
        declaration={{ ...declaration, adjutantCard: undefined }}
      />
    )

    expect(screen.queryByText(ADJUTANT_CARD_LABEL)).not.toBeInTheDocument()
  })
})
