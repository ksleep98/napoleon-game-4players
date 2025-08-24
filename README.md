# Napoleon Game (4 Players)

A web-based Napoleon card game implementation built with modern web technologies.

## Tech Stack

- **Framework**: Next.js 15.4 (App Router)
- **Language**: TypeScript
- **UI Library**: React 19.x
- **Styling**: Tailwind CSS
- **Database**: Prisma ORM with SQLite
- **Testing**: Jest + React Testing Library
- **Code Quality**: Biome (Linter + Formatter)
- **Pre-commit**: Husky + lint-staged

## Getting Started

### Prerequisites

- Node.js 22.14.0 or higher
- npm (package manager)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/ksleep98/napoleon-game-4players.git
cd napoleon-game-4players
```

2. Install dependencies:

```bash
npm install
```

3. Set up the database (when ready):

```bash
npx prisma migrate dev
npx prisma generate
```

4. Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── src/              # Source code
│   ├── app/          # Next.js app router pages
│   └── components/   # React components
├── tests/            # Test files
├── docs/             # Documentation
├── prisma/           # Database schema and migrations
└── public/           # Static assets
```

## Available Scripts

### Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server

### Code Quality

- `npm run lint` - Biome lint + format check
- `npm run lint:fix` - Biome automatic fixes
- `npm run format` - Biome format execution
- `npm run type-check` - TypeScript type checking

### Testing

- `npm test` - Run Jest tests
- `npm run test:watch` - Jest watch mode
- `npm run test:coverage` - Coverage report

### CI/CD

- `npm run ci-check` - Run all quality checks (lint, type-check, format, test, build)

## Development Workflow

### Automated Quality Checks

This project uses **Husky** and **lint-staged** for automated pre-commit quality checks:

#### What happens on `git commit`:

1. **Automatic fixes applied to staged files:**
   - Biome linting with auto-fix
   - Code formatting

2. **Quality checks run on entire project:**
   - TypeScript type checking
   - Jest test execution
   - All checks must pass to commit

#### Pre-commit Hook Options:

**Default (Comprehensive):**

```bash
# Current setup - runs all checks
git commit -m "your message"
```

**Light version (format + lint only):**

```bash
# Switch to light version
cp .husky/pre-commit-light .husky/pre-commit
```

**Skip checks (emergency only):**

```bash
# Bypass pre-commit hooks
git commit -m "your message" --no-verify
```

### Recommended Workflow:

1. Make changes to your code
2. Run `npm run ci-check` manually to verify all is good
3. `git add .` - stage your changes
4. `git commit -m "message"` - automatic checks run
5. Fix any issues if checks fail
6. Push when all checks pass

### VSCode Extensions (Recommended):

- **Biome** (biomejs.biome) - Integrated linting and formatting
- **Tailwind CSS IntelliSense** (bradlc.vscode-tailwindcss)
- **Prisma** (Prisma.prisma) - Database schema support

## Game Rules

Napoleon is a trick-taking card game for 4 players using a 52-card deck (no Jokers).

### Basic Setup

- **Players**: 4 players
- **Cards**: 52 cards (4 suits × 13 ranks, Jokers excluded)
- **Deal**: 12 cards per player + 4 hidden cards
- **Objective**: Napoleon team must win 8+ tricks

### Game Flow

1. **Napoleon Declaration**: Players declare if they want to be Napoleon
2. **Adjutant Selection**: Napoleon chooses an adjutant by specifying a card
3. **Trick Playing**: Turn-based card play with follow-suit rules
4. **Scoring**: Napoleon team wins with 8+ tricks, otherwise citizens win

## Implementation Status

### ✅ Completed Features

- **Core Game Logic**: Card management, game state, scoring system
- **TypeScript Types**: Comprehensive type definitions for all game entities
- **Testing Suite**: Jest tests covering game logic, utilities, and constants
- **Code Quality**: Biome linting, formatting, and pre-commit hooks
- **CI/CD Pipeline**: GitHub Actions with automated quality checks
- **PR Automation**: Auto-generated descriptions and code analysis
- **UI Components**: Card display, game board, player hands (basic implementation)

### 🚧 In Progress

- **Supabase Integration**: Database setup and real-time multiplayer
- **Game UI Polish**: Enhanced animations and user experience
- **AI Players**: Computer opponents for single-player mode

### 📋 Planned

- **Multiplayer Rooms**: Real-time game sessions
- **Player Statistics**: Game history and performance tracking
- **Mobile Responsiveness**: Optimized mobile gameplay

## Contributing

1. Follow **Git Flow** branching strategy:
   - `main` - Production releases
   - `develop` - Development integration
   - `feature/xxx` - Feature branches
2. Use **Conventional Commits** for commit messages
3. Ensure all quality checks pass before committing
4. Update documentation and tests as needed

## Development Guidelines

- Write code primarily in **English** with Japanese comments for complex logic
- Follow **Biome** linting and formatting rules
- Write **Jest tests** for new functionality
- Use **TypeScript** for type safety
- **52-card deck**: No Jokers, standard suits and ranks

## License

[Add license information]
