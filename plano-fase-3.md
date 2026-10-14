# Raio X de Margem da Loja fase 3

SPEC e plano de execução do cadastro e login social com Firebase Authentication.

Data: 14/10/2026. Status: planejamento concluído; integração e provisionamento ainda não executados. Base: [plano.md](plano.md), [plano-fase-2.md](plano-fase-2.md) e código atual do projeto.

## 1 Objetivo e responsabilidade pela entrega

Facilitar o cadastro com **Continuar com Google** e, quando os requisitos da Apple estiverem disponíveis, **Continuar com Apple**. A mesma ação cria a conta no primeiro acesso e autentica nos seguintes, sem senha própria do aplicativo.

O agente deve executar toda a parte técnica: identificar ou criar os projetos, registrar a aplicação, habilitar provedores, obter configurações e credenciais, configurar ambientes, desenvolver a integração, testar os fluxos reais e entregar acesso funcionando. O usuário não deve receber uma lista de tarefas de configuração, instalação ou cópia de chaves.

O pedido imediato é criar este plano. A entrega funcional descrita abaixo é o objetivo da execução da fase 3; a existência deste arquivo não significa que o login já foi implementado ou que contas externas foram criadas.

“Fazer tudo sozinho” depende de acesso autorizado às contas do titular. O agente deve aproveitar acessos já disponíveis e pedir intervenção somente diante de uma barreira real, como autenticação pessoal, MFA, verificação de identidade ou adesão ao programa da Apple. Criar um projeto Firebase é diferente de criar uma identidade Google/Apple: recursos devem pertencer ao usuário ou à sua empresa, com recuperação sob seu controle. Não inventar dados de titularidade ou declarar como concluída uma etapa inacessível.

## 2 Situação atual e relação com a fase 2

| Tema | Situação observada | Decisão da fase 3 |
|---|---|---|
| Aplicação | Next.js App Router, React e TypeScript | Integrar na aplicação existente |
| Acesso atual | Cookie assinado de sessão anônima em `lib/server.ts` e `/api/session` | Preservar sessão anônima e adicionar sessão autenticada distinta |
| Cadastro | Formulário de lead em `components/margin-app.tsx` | Oferecer login social e preencher dados disponíveis, mantendo confirmação |
| Persistência | SQLite local; adapter de produção ainda pendente | Perfil local no piloto; Postgres compartilhado antes da publicação |
| Identidade da fase 2 | Proposta de Supabase Auth, sem implementação encontrada | Firebase Authentication passa a ser a identidade humana proposta |
| ERP | Chaves opacas previstas na fase 2 | Manter credenciais de integração separadas do login social |
| Catálogo CSV | Somente na memória do navegador | Não enviar catálogo ao Firebase nem ao backend por fazer login |

Esta SPEC prevalece sobre a proposta de **Supabase Auth** da seção 5 da fase 2 quando as fases forem implementadas juntas. Supabase/Postgres pode continuar como banco; Firebase não exige adotar Firestore, Storage ou Firebase Hosting para hospedar toda a aplicação. Preservar as demais regras da fase 2.

O login pode ser implementado antes da API de ERP. Conta autenticada não implica que lojas, histórico, integrações ou armazenamento do catálogo já estejam implementados. Revisar os planos e documentação operacional durante a implementação para remover instruções conflitantes sobre autenticação.

## 3 Escopo e condições de liberação

### Obrigatório

- Google real via Firebase, com cadastro no primeiro acesso e retorno à mesma conta nos seguintes.
- Entrada, saída, sessão protegida no servidor e perfil mínimo persistido.
- Integração com o formulário atual, sem exigir preencher novamente nome e email quando disponíveis.
- Complementação apenas dos dados do negócio que o provedor não fornece.
- Tratamento de cancelamento, popup bloqueado, conexão, sessão expirada e conflito entre contas.
- Proteção de rotas e operações autenticadas; autorização por loja quando a fase 2 existir.
- Configuração e validação pelo agente em desenvolvimento, homologação e produção.
- Registro da entrega, propriedade dos recursos e evidência dos testes sem segredos.

### Apple, condicionada à viabilidade

“Conta do iPhone/iCloud” corresponde a **Sign in with Apple**, usando a Apple Account. A integração web exige participação no Apple Developer Program e configuração de identificadores e chave. Uma conta pessoal de iCloud, isoladamente, não atende ao requisito. [Firebase: Apple](https://firebase.google.com/docs/auth/web/apple).

O agente verifica primeiro se existe equipe habilitada e acesso suficiente; configura Apple quando possível. Se a adesão ou outro requisito externo impedir a execução, entrega Google funcionando e registra Apple como pendente com causa concreta. O botão Apple só aparece quando o fluxo real estiver habilitado e validado.

Ficam fora desta fase: app nativo de iPhone, leitura de arquivos iCloud, Google Drive, contatos, login Facebook, autenticação por telefone e migração geral do banco para Firestore. Login social também não implementa os endpoints de ERP da fase 2.

## 4 Jornada de cadastro e login

1. A demonstração e a análise básica de CSV continuam acessíveis sem conta.
2. No cadastro do diagnóstico e na entrada da futura área da loja, apresentar os provedores habilitados. O formulário de contato existente continua disponível para quem não usar login social.
3. Após a escolha, o Firebase conduz a autorização; a aplicação não recebe a senha Google/Apple.
4. O frontend obtém um ID token e o envia ao backend. Somente após validação no servidor o perfil e a sessão da aplicação são criados.
5. O backend localiza ou cria o perfil pelo identificador Firebase e ambiente. Nome e email disponíveis são sugestões; usuário pode completar ou corrigir o cadastro. Email editado no formulário não altera a identidade autenticada.
6. Pedir nome do negócio, segmento, papel e forma de controle quando necessários ao diagnóstico. Nome ausente na Apple não deve impedir o acesso; pedir complementação.
7. Apresentar os avisos e escolhas de privacidade. Consentimento comercial e armazenamento do resumo continuam independentes, desmarcados por padrão.
8. Voltar à análise ou destino interno solicitado. Login não dispara diagnóstico, contato comercial ou integração ERP automaticamente.
9. Acessos seguintes recuperam a mesma conta e, quando existir, suas memberships. Sair encerra a sessão autenticada; excluir conta é uma operação diferente.

Não vincular um lead antigo, loja ou convite apenas porque seu email coincide com o do login. Papel declarado no formulário é informação de cadastro, sem conceder `owner`. Criar loja própria ou aceitar convite exige o fluxo verificável da fase 2.

## 5 Provisionamento executado pelo agente

| Ordem | Ação do agente | Evidência de conclusão |
|---|---|---|
| 1 | Inspecionar acessos autorizados Google, Firebase, hospedagem e Apple; localizar projetos pertinentes | Titular, projetos e permissões confirmados |
| 2 | Criar ou reutilizar projetos Firebase separados para homologação e produção | IDs reais e proprietário registrados |
| 3 | Registrar o app web, ativar Authentication e habilitar Google | Provedor ativo e configuração recuperada |
| 4 | Configurar identificação pública do aplicativo, email de suporte e tela de consentimento conforme exigências do provedor | Aplicação identificável, sem placeholders |
| 5 | Definir URLs e domínios autorizados por ambiente | Callbacks exatos; localhost explicitamente configurado |
| 6 | Configurar identidade do backend com privilégios mínimos e segredos na hospedagem | Admin SDK opera no projeto correto |
| 7 | Implementar e validar Google em homologação | Cadastro, retorno e sessão reais aprovados |
| 8 | Verificar e configurar Apple | Identificadores, chave e provedor válidos, ou impedimento documentado |
| 9 | Configurar produção, publicar a integração e repetir os testes reais | URL final e evidência por provedor |

Preferir APIs/CLI para operações reproduzíveis; usar console autenticado quando necessário. A Management API permite provisionar recursos e apps Firebase com credenciais e permissões apropriadas; a configuração de cada provedor precisa usar sua API suportada ou console. [Firebase: gerenciamento de projetos](https://firebase.google.com/docs/projects/api/workflow_set-up-and-manage-project).

Não criar projetos em contas de terceiros nem deixar recursos pertencendo ao agente. Registrar recursos existentes antes de alterar sua configuração. Reexecução deve reutilizar os projetos corretos, sem duplicar apps ou sobrescrever credenciais alheias.

Usar os recursos necessários ao login, sem ativar analytics por padrão. Conferir quotas, plano e custos vigentes na execução. Eventual adesão paga à Apple ou cobrança adicional deve ter valor e titular definidos; não presumir um meio de pagamento ou concluir contratação sem esses dados.

## 6 Google

Usar o SDK modular Firebase com `GoogleAuthProvider`, habilitado no projeto correspondente. Solicitar apenas dados básicos para autenticação e perfil, sem escopos de Drive, Gmail ou contatos. Configurar domínio e callback de cada ambiente e testar com uma conta autorizada. [Firebase: Google](https://firebase.google.com/docs/auth/web/google-signin).

Primeira autenticação cria uma conta Firebase; o backend faz upsert idempotente do perfil. Cliques repetidos ou duas abas não podem criar duas contas internas. O email precisa ter seu estado de verificação considerado pelo backend, sem confiar em campos enviados pelo navegador.

## 7 Apple

O agente deverá:

1. Confirmar equipe Apple Developer habilitada e acesso a Certificates, Identifiers & Profiles.
2. Configurar um App ID primário habilitado para Sign in with Apple e um Services ID web associado. Verificar os requisitos de elegibilidade da aplicação na equipe existente; não prometer resolver exigências da Apple apenas criando identificadores. [Apple: configuração web](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web/).
3. Registrar domínios e Return URLs exatas, coerentes com o `authDomain` efetivo.
4. Criar ou reutilizar uma chave autorizada e configurar Services ID, Team ID, Key ID e chave privada no provedor Apple do Firebase.
5. Usar `OAuthProvider('apple.com')` no SDK. Solicitar somente nome e email necessários ao cadastro.
6. Testar primeiro acesso, retorno e opção Ocultar Meu Email. Nome pode estar ausente nos acessos seguintes; preservar o dado previamente confirmado. Não depender de foto de perfil.
7. Configurar remetentes no private email relay quando forem enviados emails a endereços privados Apple.
8. Documentar custódia, rotação e revogação da chave, e validar novamente o provedor após mudanças.

Nunca enviar a chave `.p8` ao navegador ou ao Git. O email privado Apple é um contato válido; não exigir que o usuário revele o email pessoal. Associação dessa identidade a outros dados ou provedores deve respeitar o consentimento exigido pela Apple. [Firebase: Apple](https://firebase.google.com/docs/auth/web/apple).

## 8 Sessão e backend

Fluxo proposto: provedor → Firebase Auth no navegador → ID token → backend Next.js → cookie de sessão → endpoints autenticados.

- Novo `POST /api/auth/session`: validar origem e CSRF, limite de corpo e tentativas; verificar ID token com Admin SDK do projeto esperado, revogação e autenticação recente, antes de persistir perfil e criar cookie.
- Cookie de produção `__Host-rxm_auth`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, sem `Domain`, duração inicial proposta de cinco dias. Desenvolvimento HTTP usa nome próprio sem prefixo `__Host-`.
- Novo `GET /api/auth/me`: verificar cookie com `verifySessionCookie(..., true)`, retornar perfil mínimo ou `401`, com `Cache-Control: no-store`.
- Novo `POST /api/auth/logout`: validar origem/CSRF e apagar cookie; limpar o estado do SDK no cliente. Logout comum encerra este navegador. Uma ação explícita de sair de todos os dispositivos revoga sessões Firebase.
- Cada operação protegida valida sessão, perfil ativo e permissão efetiva. Não depender somente de ocultar elementos da interface ou redirecionar a página.
- Expiração pede nova autenticação; não renovar indefinidamente sem autenticação recente. Falha de verificação não libera acesso.

O Admin SDK deve rodar no runtime Node.js do servidor, isolado do bundle cliente. Conferir as APIs da versão instalada do Next.js em `node_modules/next/dist/docs/` antes de implementar, conforme `AGENTS.md`. [Firebase: cookies de sessão](https://firebase.google.com/docs/auth/admin/manage-cookies).

O cookie anônimo atual é separado da identidade humana. Vincular uma solicitação atual exige prova da sessão anônima e ação explícita; nunca converter histórico de leads por email. Quotas por sessão anônima não podem ser reiniciadas apenas por login/logout: compor limites por usuário, sessão e IP mantendo limite global.

## 9 Identidade, banco e autorização

Modelo mínimo proposto:

| Entidade | Campos e regra |
|---|---|
| `users` | ID interno, projeto Firebase, UID Firebase, nome, email opcional, estado de verificação, status, datas; unicidade `(firebaseProjectId, firebaseUid)` |
| `user_consents` | Usuário, finalidade, versão/texto, valor e data; preservar histórico de mudanças |
| `lead_user_links` | Vínculo explícito da solicitação atual ao usuário, com prova de sessão; sem fusão automática |
| Memberships da fase 2 | Usuário interno, organização/loja e papel; concessão por criação autorizada ou convite |

O UID identifica a conta; email é atributo e pode mudar. Não usar UID como UUID Postgres sem mapeamento. Não armazenar senha social, ID tokens ou cookies em tabelas de perfil.

Para o piloto, adicionar migrações locais compatíveis com SQLite. Para produção, implementar persistência compartilhada: o `getRepository()` atual rejeita Vercel, portanto Firebase sozinho não torna o projeto publicável. A fase 3 depende do adapter de produção da fase 1/2 ou deve implementá-lo com o mínimo necessário a perfis, leads, consentimentos e quotas.

Se Supabase/Postgres for usado, acessar os dados pelo backend com autorização por usuário e loja. Uma sessão Firebase não se transforma automaticamente em sessão Supabase, e políticas baseadas em `auth.uid()` não podem presumir que recebem o usuário Firebase. Esta fase não depende de acesso direto do navegador à Data API. Usar schema privado para entidades internas e grants restritos; manter RLS nas tabelas expostas e revisar o acesso privilegiado, que pode contorná-la. [Supabase: segurança da API](https://supabase.com/docs/guides/api/securing-your-api).

Chaves de ERP continuam opacas, por loja, origem, escopos e ambiente. Não aceitar um ID token Google/Firebase como chave ERP. Administrar integrações exige sessão humana e papel `owner` confirmado no banco.

## 10 Retorno no celular e preservação da análise

Iniciar popup a partir do clique em desktop. Oferecer redirecionamento quando adequado ou quando o navegador bloquear popup, após ação explícita do usuário; cancelamento não dispara novo login automático.

`signInWithRedirect` pode falhar com armazenamento de terceiros bloqueado. Para hospedagem fora do Firebase, preparar reverse proxy transparente de `/__/auth/*` para o projeto e configurar `authDomain` e callbacks coerentes, conforme a alternativa oficial. Validar cookies, métodos e comportamento do proxy; um redirect HTTP 302 não substitui esse proxy. Não usar a alternativa de hospedar manualmente os helpers para Apple, pois ela não é suportada nesse caso. [Firebase: retorno por redirecionamento](https://firebase.google.com/docs/auth/web/redirect-best-practices).

Como o catálogo atual vive em memória, salvar um checkpoint local temporário antes de navegar: produtos já normalizados, cenário, etapa e campos em edição, sem tokens, segredos ou arquivo CSV bruto. Proposta: `sessionStorage` com versão e expiração de 30 minutos, removido após restauração, cancelamento ou reinício. O checkpoint fica no navegador, sem upload. Se indisponível ou exceder quota, impedir redirecionamento que perderia a análise e oferecer popup ou aviso acionável antes de navegar.

Após `getRedirectResult`, restaurar o estado uma única vez. Aceitar somente destinos internos permitidos em `returnTo`, prevenindo redirecionamento externo. Persistência do SDK deve ser compatível com o retorno, depois limpa ao estabelecer a sessão do servidor; não usar `inMemoryPersistence` cegamente antes de um fluxo que recarrega a página.

## 11 Credenciais e configuração

| Configuração proposta | Destino |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Configuração web pública |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Configuração web pública e domínio de autenticação validado |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Projeto do ambiente |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | App web registrado |
| `FIREBASE_PROJECT_ID` | Validação do backend; deve corresponder ao projeto web |
| Identidade Admin SDK | Preferir identidade federada quando suportada; alternativa: segredo de conta de serviço no cofre da hospedagem |
| Services ID, Team ID, Key ID e `.p8` Apple | Configuração do provedor Firebase e custódia administrativa segura |
| Flags Google/Apple habilitados | Configuração por ambiente; botão liberado após teste real |

A API key da configuração web Firebase não equivale à chave privada administrativa. Ela pode integrar o bundle, com restrições compatíveis e quotas; autorização continua obrigatória. Secrets do backend, tokens administrativos e chave Apple nunca usam `NEXT_PUBLIC_`. [Firebase: API keys](https://firebase.google.com/docs/projects/api-keys).

O agente configura `.env.local` ignorado pelo Git e variáveis reais na hospedagem; atualiza `.env.example` somente com nomes e valores vazios. Não pedir ao usuário para copiar chaves. Logs e evidências omitem tokens, cookies, chaves e contatos pessoais.

## 12 Contas repetidas, exclusão e recuperação

Mesmo UID retorna sempre ao mesmo usuário interno. Um conflito entre provedores pede login pelo método existente e vínculo explícito após autenticar ambos; email igual não autoriza fusão. Não prometer unificação automática de contas Google e Apple com email privado. Vínculo Apple exige o consentimento aplicável.

Perfil pendente após falha de banco deve ser recuperável no próximo login, sem conceder acesso com cadastro incompleto. Exclusão exige autenticação recente: bloquear perfil interno, revogar sessões, revogar credenciais ERP pertinentes e tratar memberships/transferência da última titularidade, quando existentes. Implementar remoção ou anonimização dos dados conforme política vigente e exclusão da identidade Firebase com retry rastreável. Para Apple, conferir também revogação da autorização do provedor conforme o fluxo oficial disponível na implementação.

Definir e publicar retenção específica para contas: os 90 dias dos leads e 30 dias dos resumos não devem ser aplicados silenciosamente às contas ativas. Login não reinicia nem amplia autorizações comerciais anteriores.

## 13 Plano de implementação e validação

| Marco | Entrega | Critério para avançar |
|---|---|---|
| 1 | Confirmar acessos, projetos, URLs e viabilidade Apple | Recursos sob controle do titular e impedimentos conhecidos |
| 2 | Provisionar Firebase/Google, secrets e homologação | App web e backend usam o mesmo projeto |
| 3 | Implementar perfis, sessão, logout e guards | Tokens inválidos, expirados, revogados e de outro projeto são rejeitados |
| 4 | Integrar cadastro, consentimentos e checkpoint | Menos digitação; análise preservada; nenhuma autorização implícita |
| 5 | Preparar persistência compartilhada e hospedagem | Ambiente remoto opera sem SQLite local |
| 6 | Configurar Apple quando elegível | Primeiro acesso, retorno e email privado funcionam |
| 7 | Testar, publicar e verificar URL final | Google real passa; Apple tem evidência própria ou pendência registrada |

Os marcos 3 e 4 podem ser desenvolvidos com o Auth Emulator enquanto o provisionamento estiver indisponível. Emulador não comprova Google/Apple OAuth real, callback, elegibilidade Apple ou funcionamento no iPhone.

### Testes exigidos na execução

- Google: primeiro cadastro, retorno ao mesmo usuário, cancelamento, expiração, logout e tentativa em duas abas.
- Apple: primeiro cadastro, retorno sem nome, Ocultar Meu Email, cancelamento e vínculo com consentimento quando habilitado.
- Servidor: token adulterado/de outro projeto, usuário bloqueado, revogação, login CSRF, destino externo, rate limit e falha do banco.
- Dados: upsert concorrente, consentimentos independentes e ausência de associação por email; isolamento de duas lojas e papéis quando a fase 2 existir.
- Regressão: demonstração, CSV, cálculo, diagnóstico por formulário, impressão, quotas e idempotência.
- Navegadores: desktop, mobile e WebKit em automação; completar OAuth real em Chrome e Safari/iPhone disponível. Emulação WebKit não substitui evidência em aparelho real.
- Rodar testes relevantes, typecheck e build. Login em mocks/emulador e build aprovado não bastam para declarar o provedor funcionando.

## 14 Aceite e entrega final

A entrega Google está concluída quando uma conta real autorizada consegue cadastrar-se, completar dados, sair e voltar à mesma conta pela URL final, com sessão verificada no servidor e estado da análise preservado. A entrega Apple exige evidência equivalente e tratamento do email privado.

O agente entrega:

- Código integrado, configuração real dos ambientes e URL funcionando.
- Projetos, titularidade, provedores habilitados e local seguro de custódia das credenciais documentados.
- Registro de testes por ambiente, provedor e navegador, sem dados sensíveis.
- Instruções operacionais de recuperação, rotação e desativação, destinadas à manutenção futura; configuração inicial feita pelo agente.
- Pendências externas precisas, caso existam, sem declarar Apple ou produção concluídos antes de validar.

Rollback deve desabilitar a entrada social com falha e preservar o fluxo anônimo/formulário. Migrações são aditivas; não apagar perfis, lojas ou credenciais como parte do rollback de interface. Sessões e permissões continuam verificadas no servidor.

## 15 Estado desta etapa

Este arquivo entrega o planejamento solicitado. Foram examinados o código atual e os dois planos, e consultadas referências oficiais. Nenhuma conta Google/Apple foi criada, nenhum projeto Firebase foi provisionado, nenhuma chave real foi obtida e nenhum login social foi implementado ou testado nesta etapa. A viabilidade dos acessos externos permanece a confirmar na execução.

O resultado esperado da execução é uma entrega técnica integral pelo agente. Se um provedor exigir ação exclusiva do titular, comunicar a barreira específica e executar todo o trabalho independente dela; não devolver ao usuário a integração para que ele a faça manualmente.
