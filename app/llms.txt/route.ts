import { llmsIndex } from '@/lib/integration/docs-content';
import { artifactResponse } from '@/lib/integration/public-artifacts';
export function GET(request: Request) { return artifactResponse(request, llmsIndex(new URL(request.url).origin), 'text/plain'); }
