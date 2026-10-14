# Operação da integração v1

A produção está em https://raio-x-margem-five.vercel.app, com Supabase na organização PlannerX e Vercel na equipe Expx-Pro. O backend usa Postgres real em schema privado `integration`; o CSV e a identidade Firebase existentes permanecem independentes. Os identificadores humanos são verificados pelo backend, no formato `projectId:uid`.

## Configuração

Os comandos `npm run integration:*` e `npm run test:connectors` carregam os arquivos de ambiente pelo `@next/env`, como o servidor Next.js. Variáveis já exportadas pelo operador prevalecem. Reinicie o servidor e o worker após alterar a configuração.

- `INTEGRATION_DATABASE_URL`: conexão Postgres acessível somente ao backend e ao worker. Em ambiente remoto, use conexão TLS com verificação de certificado e o pooler apropriado. Nunca use prefixo `NEXT_PUBLIC_`.
- `INTEGRATION_ENVIRONMENT`: `sandbox` ou `production`, obrigatório em produção. Sem configuração explícita, desenvolvimento usa `sandbox`.
- `INTEGRATION_API_BASE_URL`: endereço local opcional usado pelo seed, padrão `http://127.0.0.1:3000/api/v1`.

Cada implantação atende um ambiente. Use bancos e credenciais independentes para sandbox e produção. O schema não deve integrar a lista de schemas expostos pela Data API do Supabase. A migration revoga acesso de `PUBLIC`, `anon` e `authenticated`, ativa RLS em todas as tabelas e não concede acesso a clientes públicos. O papel interno `rxm_backend` tem políticas de leitura/escrita limitadas aos schemas privados. A conexão do backend precisa ser proprietária das tabelas ou ter privilégios internos explicitamente revisados; as verificações de loja e membership permanecem obrigatórias no repositório mesmo nesse caminho privilegiado.

O pool mantém até cinco conexões por processo, com timeout de conexão de cinco segundos, idle de 30 segundos e timeout SQL de 15 segundos por comando dentro das transações. Dimensione o limite de instâncias junto ao pooler. Transações de loja usam `FOR UPDATE`; escritas, snapshots, quotas e revalidação de credencial compartilham essa ordem de lock. Os produtos e eventos de cada lote são gravados em duas operações SQL em bloco, evitando um round-trip por item. Alertas alterados por barcode duplicado também integram essas gravações. A latência do Postgres remoto precisa ser medida antes do piloto. Timeout é falha técnica; o conector repete a mesma operação com sua chave de idempotência.

## Migrações

As migrations são aditivas e versionadas em `supabase/migrations`. O arquivo inicial foi criado com `supabase migration new`. Nunca aplique automaticamente durante requests HTTP. Para um banco local vazio e descartável, com a variável de conexão já configurada:

```sh
npx tsx scripts/integration-migrate.ts
```

O runner registra nome e SHA-256 em `integration.schema_migrations`, usa um lock de migração e executa tudo em uma transação. Uma migration já aplicada com checksum diferente interrompe a execução. Se a equipe escolher o gerenciamento nativo do Supabase, mantenha uma única autoridade de histórico e aplique via fluxo revisado da CLI; não misture dois runners no mesmo banco. Antes de uma aplicação remota, revisar backup, privilégios e janela operacional. Produção usa somente `supabase db push`; o runner npm é reservado aos bancos locais e de CI.

## Sandbox local

Com Postgres local já migrado:

```sh
INTEGRATION_ENVIRONMENT=sandbox npx tsx scripts/integration-sandbox.ts
```

O script exige host loopback para banco e API, cria uma loja fictícia, registra autorização e emite uma credencial. Grava `.data/integration-sandbox.json` com permissão `0600`, sem imprimir o segredo. O arquivo contém `storeId`, `sourceId`, `secret`, `environment` e `apiBaseUrl`; `.data/` deve permanecer fora do Git. Reexecução reutiliza a configuração se válida. `--reset` exclui somente a loja sandbox pertencente ao ator sintético local e cria outra. Não aponte testes para uma loja real.

## Worker durável

Na Vercel, `after()` inicia o processamento e `/api/cron/worker` recupera pendências a cada minuto. `/api/cron/cleanup` aplica retenção diariamente às 06:00 UTC. Ambos exigem `CRON_SECRET`. Localmente, execute:

```sh
npx tsx scripts/integration-worker.ts
```

Para processar no máximo um job e executar a rotina de retenção:

```sh
npx tsx scripts/integration-worker.ts --once
```

O request HTTP apenas captura o snapshot, cria a análise, agenda o job e confirma idempotência na mesma transação. O worker reclama trabalhos com locks, lease de 60 segundos, heartbeat a cada 20 segundos e fencing pelo token de lease. O limite é de três tentativas. Retentativa técnica aguarda dez segundos e reutiliza o snapshot. Um processo interrompido deixa seu lease expirar; outro processo pode assumir o mesmo job. Um worker antigo não consegue confirmar resultados com token vencido ou substituído. A rotina nunca envia produtos a IA.

A ordenação dos resultados usa percentual crescente, coloca percentuais não aplicáveis no fim e desempata por `externalId` e `id` em ordem binária. O motor `lib/analysis.ts` é o mesmo usado na fase 1. A versão persistida do cálculo é `margin-v1`; alterações de fórmula exigem uma nova versão.

Supervisione o processo e acompanhe contagens por status, idade do job mais antigo, jobs `running` com lease vencido, tentativas, latência de análise, falhas de autenticação e saturação de quota. O piloto deve medir 5.000 produtos em até 30 segundos; isso é um objetivo de validação, não SLA. O processo emite apenas erros operacionais genéricos, sem segredo, contato ou conteúdo de catálogo.

## Retenção e desligamento

O worker executa limpeza aproximadamente a cada hora. Ela remove snapshots expirados após 30 minutos, idempotência após sete dias, jobs encerrados após sete dias, análises encerradas, feed e auditoria após 90 dias, e buckets antigos de quota. Catálogo atual permanece enquanto a loja existir. Limpeza e consultas usam o mesmo lock por loja; lojas ocupadas são tentadas no próximo ciclo.

Cursores opacos têm um indicador público de expiração e um componente aleatório de 256 bits. O hash persistido é a autoridade de acesso: loja, ambiente e tipo são sempre comparados; o indicador não autoriza consultas. Após a expiração, o payload do cursor é apagado, e o registro compacto permanece por mais 90 dias. Após o expurgo, um token bem formado cuja expiração já passou continua retornando `410`; tokens desconhecidos não expirados retornam `400`. A loja mantém `feed_floor`, a maior revisão expurgada, impedindo que renovar um cursor esconda uma lacuna no feed.

Revogar uma credencial impede novas transações mesmo que a autenticação tenha ocorrido antes. Rotação limita a chave anterior a uma sobreposição de 24 horas, e a nova vale 90 dias. Desconectar revoga todas as credenciais e cancela jobs ainda em fila; jobs já iniciados podem concluir. Uma origem nova não reutiliza IDs ou barcodes da anterior automaticamente. Nesta versão, reiniciar com outra origem exige nova loja ou exclusão explícita da antiga.

Excluir a loja elimina imediatamente catálogo, snapshots, análises, jobs, credenciais e dados de sincronização por cascata. O acesso fica indisponível na mesma transação. É mais curto que o prazo máximo proposto de sete dias. Uma exclusão não apaga automaticamente cópias históricas mantidas pelo provedor de backups.

## Backup, restauração e liberação

Antes de produção, escolher e registrar política de backups e PITR do provedor, janela máxima de retenção de backups, responsáveis por restauração e atendimento de exclusão. Testar restauração em banco isolado, incluindo RLS e grants, e impedir que uma restauração reative credenciais revogadas ou lojas excluídas: reaplicar o registro operacional de revogações/exclusões antes de abrir tráfego. Não copiar banco de produção para o sandbox público.

Ainda dependem de decisão operacional e validação externa: executor e monitoramento do worker, infraestrutura pública de sandbox, domínio comercial, contato de suporte/privacidade, política de retenção aprovada, backup/restauração demonstrados e testes com ERPs reais. As credenciais locais e os testes automatizados não substituem essas decisões. Publicação em produção requer uma instrução própria.

## Instalação local deste workspace

Foi instalado PostgreSQL 17 pelo Homebrew e inicializado um cluster isolado em `.data/integration-test/pgdata`, escutando somente `127.0.0.1:55432`. O banco de uso manual é `rxm_sandbox`; `rxm_test` e `rxm_migration_test` são exclusivos de validação. `.env.local` aponta para o sandbox e não é versionado. O cluster local usa autenticação de desenvolvimento; não o exponha na rede nem o reutilize em produção.

Após reiniciar o computador, o cluster pode ser iniciado com:

```sh
/opt/homebrew/opt/postgresql@17/bin/pg_ctl -D .data/integration-test/pgdata -l .data/integration-test/postgres.log -o '-h 127.0.0.1 -p 55432 -k /tmp' start
npm run dev
# Em outro terminal:
npm run integration:worker
```

Para encerrá-lo após parar servidor e worker, use `pg_ctl -D .data/integration-test/pgdata stop` com o mesmo caminho do executável. Nenhum serviço foi registrado para iniciar automaticamente com o macOS. Em outras máquinas, configure seu próprio Postgres e sua conexão; estes caminhos descrevem apenas o ambiente onde a implementação foi validada.
