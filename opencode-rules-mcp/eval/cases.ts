export type UseCase = {
  query: string;
  expected: string[];
};

// Real task shapes from consumer repos. Expected IDs are the rules an agent
// should read before starting the task.
export const cases: UseCase[] = [
  {
    query: 'Add a NestJS controller with DTO validation and Swagger documentation',
    expected: ['nestjs', 'general', 'libraries'],
  },
  {
    query: 'Add a file upload endpoint that stores images on disk',
    expected: ['upload', 'nestjs'],
  },
  {
    query: 'Set up Prisma 7 migrations in the API service',
    expected: ['prisma', 'nestjs'],
  },
  {
    query: 'Add an AI agent using @nestjs/ai with embeddings and a model registry',
    expected: ['nestjs-ai', 'libraries'],
  },
  {
    query: 'Configure GitHub Actions CI with concurrency and path filters',
    expected: ['github-actions', 'github-supply-chain'],
  },
  {
    query: 'Add Dependabot config with the baseline ecosystems and validators',
    expected: ['dependabot', 'github-supply-chain'],
  },
  {
    query: 'Build a Next.js page with accessible UI and IME-safe Enter handling',
    expected: ['frontend', 'real-user-qa', 'i18n'],
  },
  {
    query: 'Run a full codebase audit and write a triaged report',
    expected: ['audit', 'wf-codebase-audit'],
  },
  {
    query: 'Create deterministic fixtures with one timezone anchor',
    expected: ['fixtures', 'test-audit'],
  },
  {
    query: 'Convert a Claude Design export into a Next.js page',
    expected: ['wf-claude-design-to-nextjs', 'frontend', 'i18n'],
  },
];
