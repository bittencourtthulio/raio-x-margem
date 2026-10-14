import { createOpenApi } from '@/lib/integration/openapi';
import { artifactResponse } from '@/lib/integration/public-artifacts';
export function GET(request: Request) { return artifactResponse(request, JSON.stringify(createOpenApi(), null, 2) + '\n', 'application/json'); }
