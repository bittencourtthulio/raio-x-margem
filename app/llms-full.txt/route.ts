import { guides, llmsIndex, endpointMarkdown } from '@/lib/integration/docs-content';
import { examplesMarkdown } from '@/lib/integration/examples';
import { artifactResponse } from '@/lib/integration/public-artifacts';
export function GET(request: Request) { return artifactResponse(request, llmsIndex(new URL(request.url).origin) + '\n' + guides.map(g => `# ${g.title}\n\n${g.text}`).join('\n\n') + '\n\n' + endpointMarkdown + '\n\n' + examplesMarkdown, 'text/plain'); }
