# Napoleon Game (4 Players)

A web-based Napoleon card game implementation built with modern web technologies.

## Tech Stack

- **Framework**: Next.js 15.4
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Prisma ORM with SQLite
- **Testing**: Jest with React Testing Library
- **Code Quality**: ESLint + Prettier

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- Yarn or npm

### Installation

1. Clone the repository:
```bash
git clone https://github.com/username/napoleon-game-4players.git
cd napoleon-game-4players
```

2. Install dependencies:
```bash
yarn install
```

3. Set up the database:
```bash
npx prisma migrate dev
npx prisma generate
```

4. Start the development server:
```bash
yarn dev
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

- `yarn dev` - Start development server
- `yarn build` - Build for production
- `yarn start` - Start production server
- `yarn lint` - Run ESLint
- `yarn test` - Run Jest tests
- `yarn type-check` - Run TypeScript compiler

## Game Rules

Napoleon is a trick-taking card game for 4 players. [Add game rules here]

## Contributing

1. Follow Git Flow branching strategy
2. Use Conventional Commits for commit messages
3. Ensure all tests pass and code follows ESLint rules
4. Update documentation as needed

## Development Guidelines

- Write code primarily in English with Japanese comments for complex logic
- Follow ESLint and Prettier configurations
- Write tests for new functionality
- Use TypeScript for type safety

## License

[Add license information]