import { render, screen } from '@testing-library/react'
import {
  ADJUTANT_BADGE_TONES,
  AdjutantCardBadge,
} from '@/components/game/AdjutantCardBadge'
import { ADJUTANT_CARD_LABEL, SUIT_SYMBOLS } from '@/lib/constants'
import type { Card } from '@/types/game'

const heartsAce: Card = {
  id: 'adjutant-card',
  suit: 'hearts',
  rank: 'A',
  value: 14,
}

const clubsTen: Card = {
  id: 'adjutant-card-2',
  suit: 'clubs',
  rank: '10',
  value: 10,
}

describe('AdjutantCardBadge', () => {
  it('labels the badge as a card so it is not read as the adjutant player', () => {
    render(<AdjutantCardBadge card={heartsAce} />)

    expect(screen.getByText(ADJUTANT_CARD_LABEL)).toBeInTheDocument()
  })

  it('renders the suit as a symbol and as text, not by color alone', () => {
    render(<AdjutantCardBadge card={heartsAce} />)

    // スート記号（形状で判別）
    expect(screen.getByText(SUIT_SYMBOLS.hearts)).toBeInTheDocument()
    // ランク + スート名（テキストで判別）
    expect(
      screen.getByText(`${heartsAce.rank} ${heartsAce.suit}`)
    ).toBeVisible()
  })

  it('renders a two-character rank correctly', () => {
    render(<AdjutantCardBadge card={clubsTen} />)

    expect(screen.getByText(SUIT_SYMBOLS.clubs)).toBeInTheDocument()
    expect(screen.getByText(`${clubsTen.rank} ${clubsTen.suit}`)).toBeVisible()
  })

  it('renders an actual card face rather than plain text', () => {
    const { container } = render(<AdjutantCardBadge card={heartsAce} />)

    // Card コンポーネントは button として描画される（クリック不可の表示専用）
    const cardFace = container.querySelector('button')
    expect(cardFace).toBeInTheDocument()
    expect(cardFace).toBeDisabled()
    expect(cardFace?.textContent).toContain(SUIT_SYMBOLS.hearts)
  })

  it('supports the light tone used inside declaration panels', () => {
    const { container } = render(
      <AdjutantCardBadge card={heartsAce} tone={ADJUTANT_BADGE_TONES.LIGHT} />
    )

    expect(container.firstElementChild?.className).toContain('bg-yellow-100')
  })
})
