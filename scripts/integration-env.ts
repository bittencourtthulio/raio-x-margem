import { loadEnvConfig } from '@next/env';

// Match Next.js configuration without replacing environment variables supplied by CI/operators.
loadEnvConfig(process.cwd());
