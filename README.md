# Raio-X de Margem da Loja

Aplicação para importar CSV de produtos, conferir dados e simular margens, com login Google e API de integração para ERPs.

- Aplicação: https://raio-x-margem-five.vercel.app
- Documentação da API: https://raio-x-margem-five.vercel.app/docs/api
- Repositório: https://github.com/bittencourtthulio/raio-x-margem

## Executar localmente

Requer Node.js 22.13 ou superior.

```sh
npm ci
npm run setup
npm run dev
```

Configure o Firebase em `.env.local` conforme `.env.example`. Abra http://127.0.0.1:3000. O desenvolvimento pode usar SQLite; o deploy usa exclusivamente Postgres. O catálogo CSV permanece na memória do navegador. Contas, consentimentos, limites e metadados persistem no backend. Resumos de diagnóstico só são guardados quando autorizados.

## Produção

Next.js na Vercel, região São Paulo, conectado à branch `main` deste repositório. Supabase `raio-x-margem` na organização PlannerX, também em São Paulo. O Firebase Authentication mantém o login Google; o backend valida sessão, revogação e cadastro completo.

`STORAGE_DRIVER=postgres` usa `app_private` para contas/leads e `integration` para integrações. Todos os dados ficam em schemas privados com RLS; a credencial `rxm_backend` tem somente acesso de leitura/escrita, sem privilégios de administração do banco. A conexão usa Supavisor em modo transação e TLS com certificado verificado. As secrets estão no ambiente Production da Vercel e não são fornecidas a deployments de pull requests públicos.

As quatro migrations estão em `supabase/migrations`. Em produção, o histórico é gerenciado pela CLI Supabase:

```sh
supabase link --project-ref xtjpxlnpvlprelkgkkns
supabase db push
supabase migration list
```

Não execute o runner local de migrations no banco remoto. Para desenvolvimento e CI em um Postgres separado, use `npm run integration:migrate`.

Análises são enfileiradas de forma durável. Na Vercel, o processamento é iniciado após a resposta e retomado por Cron a cada minuto. A limpeza de retenção roda diariamente às 06:00 UTC. Os endpoints de Cron exigem `CRON_SECRET`. Localmente, execute `npm run integration:worker`.

Diagnósticos com IA usam Vercel AI Gateway. A chave de produção tem limite de US$ 5/mês, além das quotas da aplicação. Falha do provedor usa interpretação determinística identificada como fallback. O ambiente local pode usar `AI_MODE=mock`.

## Integrações e testes

Crie loja, autorize uma origem e emita uma credencial em `/app/integracoes`. A API usa credenciais por loja, escopos, versões de origem, idempotência, snapshots e fila durável. Valores monetários são centavos; percentuais de entrada são pontos-base. Resultados representam margem ou contribuição estimada, sem representar lucro líquido.

```sh
npm test
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

Para testar Postgres, defina `INTEGRATION_TEST_DATABASE_URL` para um banco local descartável previamente migrado. Nunca aponte testes para produção. O Playwright usa Firebase Auth Emulator e dados sintéticos.

```sh
npm run docs:generate
npm run test:connectors
```

O portal oferece OpenAPI 3.1.1, guias Markdown, `/llms.txt` e uma skill em ZIP com SHA-256. Consulte [operação](docs/integration-operations.md) para quotas, retenção e recuperação. O sandbox hospedado e conectores com ERPs externos não fazem parte deste deploy.

Credenciais, bancos locais e materiais de campanha ficam fora do Git. Publicar o código não concede automaticamente uma licença adicional de reutilização.

## Aula de primeiros passos

O botão **Como usar**, no cabeçalho de `/app`, abre uma aula de aproximadamente cinco minutos com importação de CSV, conferência dos dados e simulações. O modal também abre no primeiro acesso de cada conta neste navegador; o fechamento é lembrado em `localStorage` por conta e versão da aula. Limpar os dados do navegador ou usar outro navegador apresenta a aula novamente. O vídeo não reproduz automaticamente e só carrega enquanto o modal está aberto.

O MP4 fica no [release da aula](https://github.com/bittencourtthulio/raio-x-margem/releases/tag/tutorial-primeiros-passos-v1). Capa e legendas WebVTT ficam em `public/tutorial`. Para atualizar a aula, publique um novo asset versionado e atualize a URL e a versão em `components/tutorial-dialog.tsx`.
