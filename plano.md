# Raio-X de Margem da Loja — spec e plano de implementação

Data: 14/10/2026. Status: planejamento concluído; implementação não iniciada.

## 1. Objetivo e decisões

Criar uma ferramenta gratuita para pequenos varejistas analisarem a margem dos produtos cadastrados e simularem descontos. O objetivo comercial é captar oportunidades qualificadas para o software de gestão da software house, atendendo também serviços com custos unitários conhecidos.

Promessa: **“Importe seus produtos e descubra quais estão abaixo da margem que você deseja.”**

Decisões fechadas:

- Next.js com App Router e TypeScript.
- Validação inicial: aplicação local com SQLite.
- Publicação: aplicação e APIs na Vercel, persistência no Supabase/Postgres.
- CSV processado em memória no navegador; nenhum upload ou armazenamento do catálogo.
- Cálculos determinísticos; IA interpreta indicadores agregados.
- Análise básica gratuita sem cadastro. Cadastro opcional para gerar diagnóstico com IA.
- Sem login, painel administrativo ou integração com ERP na primeira versão.
- O alvo original de quatro horas aplica-se ao MVP local delimitado. A preparação e publicação com Supabase são uma etapa adicional.

Este documento é o único artefato desta etapa. Não instalar dependências, criar aplicação, provisionar serviços, gerar banco ou publicar antes de uma instrução posterior do usuário.

## 2. Discussão entre os agentes

Três agentes especializados revisaram a proposta e trocaram críticas entre si:

| Frente | Discussão | Decisão consolidada |
|---|---|---|
| Produto e UX | A importação traz mais valor, mas pode impedir o primeiro uso | Demo pronta, arquivo modelo, prévia e mapeamento confirmado |
| Dados e cálculos | Formatos monetários e arquivos inconsistentes podem distorcer a análise | Formato BR/US explícito, erros por linha e matemática em centavos |
| Arquitetura | SQLite local não é persistência adequada para Functions na Vercel | Adapter local SQLite e adapter Supabase na etapa de publicação |
| Produto + dados | Código de barras obrigatório excluiria cadastros legítimos | Suportar código de barras como texto, mas torná-lo opcional |
| Produto + arquitetura | Salvar o catálogo aumenta sensibilidade e escopo | Persistir contato e, opcionalmente, resumo agregado; não salvar produtos |
| Dados + arquitetura | IA não deve calcular nem receber todo o CSV | Servidor valida agregados e IA apenas os explica |
| Todas as frentes | Quatro horas não comportam importação universal e infraestrutura completa | P0 local estrito; publicação e recursos avançados em etapas próprias |

O limite de importação é **25 MB e 150.000 registros**, para acomodar bases de cadastro exportadas de ERPs.

## 3. Usuário, valor e limites da análise

Usuário principal: dono ou gestor de pequeno varejo que exporta produtos de um sistema ou planilha. Usuário secundário: prestador de serviços que conhece custo direto e preço de venda por serviço.

A ferramenta responde:

1. Quais cadastros têm custo maior que preço de venda?
2. Quantos estão abaixo da margem mínima definida pelo usuário?
3. O que acontece com as margens se aplicar um desconto?
4. Quais dados e preços merecem conferência?

Sem quantidade em estoque e histórico de vendas, não estimar estoque parado, faturamento, dinheiro investido, giro ou impacto financeiro total. Cada linha é um cadastro, não uma venda. Não apresentar média de margens como margem total da empresa.

Preço de compra pode não incluir frete, custos de aquisição e outras despesas. Exibir aviso curto para conferir a composição do custo. Sem taxas, mostrar **margem bruta estimada**. Com taxa variável global informada, mostrar **contribuição estimada**. Nenhum dos dois resultados equivale a lucro líquido.

## 4. Escopo por etapa

| Recurso | P0: validar localmente | Etapa de publicação | P1: depois da validação |
|---|---|---|---|
| Next.js, TypeScript, interface responsiva | Sim | Mesmo aplicativo | — |
| CSV, prévia, mapeamento e erros por linha | Sim | Mesmo comportamento | Mais formatos e encodings |
| Gráfico, ranking e tabela | Sim | Mesmo comportamento | Mais visualizações |
| Desconto global e taxa variável opcional | Sim | Mesmo comportamento | Taxa por produto e desconto máximo |
| Lead e resumo opcional | SQLite | Supabase/Postgres | CRM e histórico autenticado |
| Diagnóstico IA de agregados | Real se houver credenciais; modo demonstrativo identificado se não houver | Integração real obrigatória para anunciar IA | Recomendações mais detalhadas |
| Imprimir relatório e copiar diagnóstico | Navegador | Mesmo comportamento | PDF com layout próprio e exportação enriquecida |
| Sessão anônima e quota | Banco local | Banco compartilhado Supabase | Proteções adicionais conforme tráfego |
| Login, emissão fiscal, WhatsApp automático, integração ERP | Não | Não | Avaliar separadamente |
| XLSX, PDF, OCR, áudio e importação de qualquer layout | Não | Não | Avaliar separadamente |

## 5. Jornada e interface

Uma página principal com estados sequenciais, sem exigir navegação por várias páginas:

1. **Entrada:** promessa, botão “Analisar meus produtos”, “Experimentar com dados de exemplo” e arquivo modelo para download.
2. **Importação:** selecionar CSV, informar formato numérico BR ou US e confirmar delimitador sugerido.
3. **Mapeamento:** sugerir colunas por aliases e pedir confirmação. Mostrar cinco linhas de prévia.
4. **Conferência:** informar registros válidos, inválidos, duplicados e alertas. Permitir continuar com as linhas válidas, explicitamente.
5. **Análise:** cards, gráfico, ranking e tabela. Alterar margem mínima, desconto e taxa atualiza os resultados.
6. **Diagnóstico IA opcional:** explicar quais agregados serão enviados; apresentar formulário de contato e autorização comercial independente.
7. **Resultado interpretado:** até três achados e três ações de conferência, opção de copiar/imprimir e convite contextual ao ERP.

Texto do convite: “Quer acompanhar vendas, custos e margem no mesmo sistema? Conheça nosso software de gestão.” URL e nome comercial configuráveis.

Estados necessários: inicial, lendo arquivo, erro de arquivo, mapeamento, conferência, análise disponível, enviando cadastro, gerando diagnóstico, falha recuperável e diagnóstico pronto. Falha na persistência ou na IA não remove a análise do navegador.

Usabilidade: labels acessíveis, navegação por teclado, contraste adequado, valores formatados em pt-BR e tabela com rolagem horizontal no celular. Não depender apenas de cores para indicar margens negativas. Demo claramente identificada e excluída das métricas de aquisição real.

## 6. Contrato de importação CSV

| Campo normalizado | Obrigatório | Regra |
|---|---|---|
| `barcode` | Não | String; preservar zeros à esquerda; não converter em número |
| `name` | Sim | Texto não vazio, até 200 caracteres |
| `purchaseCostCents` | Sim | Custo unitário, inteiro em centavos, maior ou igual a zero |
| `salePriceCents` | Sim | Preço unitário, inteiro em centavos, maior que zero |
| `sourceRow` | Gerado | Linha original para rastrear erros e diferenciar duplicados |

Modelo disponibilizado:

```csv
codigo_barras;produto;preco_compra;preco_venda
0012345678905;Camiseta;60,00;100,00
0012345678906;Boné;30,00;50,00
```

Regras P0:

- UTF-8 com ou sem BOM, LF ou CRLF, cabeçalho e separador `;` ou `,`.
- Usar biblioteca de parsing CSV; não dividir texto manualmente por vírgulas.
- Suportar aspas, separadores dentro de campos e quebras de linha em campos citados.
- Ignorar linhas vazias; contar registros de dados para o limite de 150.000.
- Arquivo acima de 25 MB, excesso de registros, aspas malformadas ou encoding inválido impedem a importação com orientação para corrigir.
- Sugerir mapeamento por aliases como `descricao`, `nome`, `custo`, `preco_custo`, `valor_venda`, `ean` e `codigo_barras`; a decisão final é do usuário.
- Exigir nome, custo e venda em colunas distintas. Código de barras é opcional; colunas extras são ignoradas.
- Seletor numérico por arquivo: BR aceita `1.234,56` e `1234,56`; US aceita `1,234.56` e `1234.56`; ambos aceitam inteiros. Não adivinhar formato por célula nem aceitar mistura silenciosamente.
- Permitir espaços externos e prefixo `R$`. Aceitar no máximo duas casas decimais. Valores ambíguos ou incompatíveis geram erro por linha.
- Limite por valor: R$ 1.000.000,00. Valores fora do limite geram erro, sem truncamento.
- Custo ausente não vira zero. Custo negativo, venda negativa ou venda zero invalidam a linha.
- Custo zero permanece com alerta “confira se o custo foi informado”. Custo acima da venda permanece válido com margem negativa.
- Duplicados por código de barras não vazio são sinalizados e mantidos separados; não somar, sobrescrever nem deduplicar automaticamente. Nome repetido sozinho não prova duplicação.
- Se Excel já removeu zeros ou converteu códigos para notação científica, não tentar reconstruí-los. Alertar e orientar reexportação como texto.
- Exibir linha e motivo dos erros, sem exigir que todo o arquivo esteja correto para analisar registros válidos. Se não houver nenhum válido, bloquear a análise.
- Células são dados: não executar fórmulas nem renderizar HTML fornecido no CSV.

O arquivo e as linhas normalizadas ficam em memória. Recarregar ou fechar a página exige nova importação. Não usar localStorage para catálogo ou dados pessoais no P0.

## 7. Modelo de cálculo

Dinheiro em centavos inteiros; percentuais de entrada em pontos-base (100 pontos-base = 1%). Arredondamento monetário para o centavo mais próximo, com empate para cima. Percentuais de margem podem ser negativos e só são arredondados na exibição.

Entradas globais:

- Desconto: padrão 0%, permitido de 0% a 99%, até duas casas decimais.
- Margem mínima: padrão demonstrativo 20%, editável de 0% a 99%. Não é recomendação setorial.
- Taxa variável global: opcional, de 0% a 99%, até duas casas decimais. Representa percentual sobre a venda; não inclui despesas fixas nem valores fixos por transação.

Para cada cadastro, `P` é o preço em centavos, `C` o custo, `d` o desconto em pontos-base e `t` a taxa em pontos-base:

```text
precoSimulado = arredondar(P × (10.000 − d) / 10.000)
margemBrutaCentavos = precoSimulado − C
margemBrutaPercentual = margemBrutaCentavos / precoSimulado × 100
taxasCentavos = arredondar(precoSimulado × t / 10.000)
contribuicaoCentavos = precoSimulado − C − taxasCentavos
contribuicaoPercentual = contribuicaoCentavos / precoSimulado × 100
```

Mesmo com desconto menor que 100%, preços muito pequenos podem arredondar para zero. Nesse caso, mostrar resultado monetário e margem percentual “não aplicável”; excluir das faixas percentuais e informar a quantidade excluída.

Não inferir alíquota do Simples Nacional por segmento ou código de barras. Taxas informadas são estimativas do usuário. Não recomendar alteração automática de preço.

## 8. Dashboard P0

- Cards: registros válidos; registros inválidos; quantidade com resultado unitário negativo; quantidade abaixo da margem mínima.
- Um gráfico de barras com contagens por faixa fixa: negativa; de 0% a menos de 10%; de 10% a menos de 20%; 20% ou mais.
- As faixas do gráfico não mudam com a margem mínima escolhida. A margem mínima controla o card e o filtro “abaixo da meta”; os rótulos deixam isso claro.
- Se houver taxa informada, gráfico, ranking e filtro usam contribuição percentual; caso contrário, margem bruta percentual.
- Ranking dos dez cadastros com menor percentual no cenário atual, incluindo negativos. Desempate pela linha original. Não rotular como “maior prejuízo da loja”.
- Tabela pesquisável por nome e código de barras, ordenável por margem e paginada em 50 registros.
- Colunas: código, nome, custo, preço original, preço simulado, margem bruta em reais e percentual; contribuição em reais e percentual quando aplicável; alertas.
- Um desconto global recalcula todos os produtos; desconto individual, preço recomendado e limite de desconto ficam em P1.
- Mostrar sempre desconto, taxa e base de cálculo ativa. Disponibilizar reset para o cenário original.
- Impressão pelo navegador inclui parâmetros, gráfico e resumo, sem prometer PDF elaborado. Sem exportação enriquecida no P0.

## 9. IA: função e contrato

Usar endpoint server com Vercel AI Gateway e modelo configurável. A infraestrutura do produto permanece em Vercel/Supabase; o Gateway acessa um provedor de modelo. Não executar ou hospedar LLM próprio.

A IA recebe somente: número de registros válidos/inválidos, alertas, contagem por faixa, quantidade abaixo da meta e negativa, parâmetros do cenário e setor em categoria controlada. Não recebe contato, nome da loja, nomes dos produtos, códigos, preços individuais, arquivo ou texto livre do CSV.

Saída estruturada: `findings` (até três), `actions` (até três) e `limitations` (até duas). Validar limites e schema antes de mostrar. Achados citam apenas números fornecidos; ações sugerem conferência de custos, despesas e preços. A resposta não calcula indicadores novos, presume demanda, garante lucro ou prescreve tributação.

Prazo inicial de resposta: 15 segundos. Em indisponibilidade, apresentar interpretação por regras fixas identificada como **“Resumo automático, sem IA”**. O gráfico e os cálculos continuam disponíveis.

Sem credenciais, a validação local pode usar modo demonstrativo explicitamente marcado. Não contar resposta simulada como validação da integração real. Registrar origem da resposta: `ai`, `fallback` ou `mock`.

## 10. Captura, qualificação e métricas

Cadastro opcional para diagnóstico: nome, nome do negócio, um contato (email ou WhatsApp), segmento, papel na empresa e controle atual (sistema, planilha, caderno ou outro). Nome do sistema atual é opcional. Validar formato do contato; isso não comprova que ele pertence ao visitante.

Autorizações independentes:

- Aviso de tratamento dos dados para atender a solicitação e gerar diagnóstico.
- Checkbox opcional, desmarcado por padrão: “Aceito contato sobre o software de gestão”. Recusar não bloqueia o diagnóstico.
- Checkbox opcional para salvar o resumo agregado junto ao cadastro. Recusar mantém o processamento transitório e não salva indicadores.

Salvar versão do texto e momento da autorização. Não tratar consentimento comercial como condição para acesso à análise gratuita.

Definições:

- Lead captado: contato com formato válido e segmento preenchido; não é contato verificado.
- Oportunidade qualificada: responsável pela decisão, segmento atendido e controle manual ou dificuldade declarada com o sistema atual.
- Lead elegível para abordagem comercial: oportunidade qualificada com autorização de contato registrada.
- Importação ou uso da demo não equivalem a lead.

Eventos mínimos: `landing_view`, `demo_started`, `file_selected`, `import_validated`, `analysis_viewed`, `lead_submitted`, `insights_generated` e `erp_cta_clicked`. Sem dados pessoais ou produtos no payload; usar sessão opaca. Eventos são auxiliares, não prova de receita.

Medir: importações concluídas / arquivos selecionados; leads / análises reais vistas; leads qualificados autorizados / leads; cliques no ERP / leads. Excluir demo e geração mock. Conversão a demonstração ou venda exige confirmação comercial externa e não faz parte do P0.

Validar com 20 lojistas do público-alvo, observando onde precisam de ajuda. É teste exploratório, sem promessa de taxa de conversão. Tráfego e divulgação ficam fora das quatro horas de desenvolvimento.

## 11. Arquitetura e persistência

```text
Navegador
  CSV → parsing → mapeamento → validação → cálculos → gráfico/tabela
  Contato + agregados opcionais → Route Handler Next.js (Node)
    → validação / sessão / quotas
    → adapter SQLite local OU Supabase em produção
    → agregados sem PII → Vercel AI Gateway
    ← diagnóstico estruturado ou fallback
```

Organização prevista: `app/page.tsx`, `app/api/session/route.ts`, `app/api/diagnostics/route.ts`, `app/api/events/route.ts`, módulos `lib/csv`, `lib/analysis`, `lib/validation`, `lib/ai` e `lib/repositories`. Componentes de importação, mapeamento, dashboard e formulário de lead separados.

Bibliotecas candidatas: Papa Parse para CSV; Zod para contratos; Recharts para o gráfico; driver SQLite para Node na validação; cliente Supabase server na publicação. Conferir compatibilidade e versões ao implementar, fixar versões e manter lockfile.

Contratos de repositório pequenos: criar lead, salvar diagnóstico autorizado, reservar quota atomicamente, registrar evento e limpar registros expirados. Interfaces comuns não implicam SQL idêntico entre SQLite e Postgres. Banco local em arquivo fora do Git, ignorado no futuro `.gitignore`.

Entidades previstas:

| Entidade | Dados persistidos |
|---|---|
| `leads` | UUID, hash de sessão, nome, negócio, contato normalizado, segmento, papel, controle atual, consentimentos/versões e timestamps |
| `diagnostics` | UUID, lead, hash de sessão, parâmetros/estatísticas apenas quando autorizados, origem, status e timestamps |
| `diagnostic_requests` | Sessão, chave de idempotência, hash do pedido, status e resposta transitória expirada; sem catálogo ou PII |
| `request_limits` | Hash do sujeito, tipo/janela e contador, com chave única composta |
| `events` | Evento permitido, sessão opaca, indicador de demo e timestamp |

Quando não houver autorização de salvar resumo, não persistir resposta ou indicadores em `diagnostics`/`diagnostic_requests`; manter somente metadados mínimos do pedido. Repetição concluída informa o estado e exige ação explícita para nova geração, sem repetir a cobrança automaticamente.

P0 não oferece conta, histórico, catálogo salvo ou link público do relatório. CSV deve ser reimportado ao recarregar. Não anunciar “salvar meus produtos”. Consulta de leads para o piloto ocorre no banco local; na publicação, pelo Supabase Studio autorizado, sem criar endpoint público de listagem.

## 12. APIs, segurança e operação

- `POST /api/session`: sessão anônima com identificador aleatório, assinatura e cookie HttpOnly, SameSite=Lax, validade de 24 horas; Secure em HTTPS.
- `POST /api/diagnostics`: contato, consentimentos, parâmetros e agregados. Validar sessão, origem, schema e quota; registrar lead; gerar diagnóstico. Nenhum arquivo neste endpoint.
- `POST /api/events`: somente eventos permitidos e sem PII, com limites próprios; falha de métrica não bloqueia a análise.
- Não criar GET de relatórios ou leads no P0. IDs aleatórios não substituem autorização.
- Limitar corpo do diagnóstico a 32 KB. Retornar erros compreensíveis para schema inválido, quota e indisponibilidade; manter dados na interface para tentar novamente.
- Agregados vêm do navegador e são declarações não verificadas. Validar intervalos, soma das faixas e contagens, sem presumir autenticidade do catálogo.
- Idempotência por sessão + chave de pedido, comparando hash do corpo: impedir inserts e geração duplicados; corpo diferente com a mesma chave retorna conflito.
- Quota inicial configurável: cinco gerações por sessão/hora, dez por IP/hora e cem globais/dia. Reservar todas as quotas atomicamente no banco; não usar memória da Function para controle em produção.
- HMAC do IP com segredo server para controle; nunca registrar IP bruto. Confiar apenas no mecanismo de origem/IP documentado pela plataforma ao publicar.
- Validação de mesma origem e honeypot em formulários. Limitar também criação de sessão, cadastro e eventos para evitar spam e escrita ilimitada.
- Secrets de IA, assinatura e Supabase exclusivamente server; sem prefixo `NEXT_PUBLIC_`.
- Na publicação, tabelas Supabase com RLS, acesso público revogado e sem policies para `anon`/`authenticated`. APIs server usam credencial privilegiada e verificam a sessão antes de qualquer operação.
- Não logar payloads, contato, catálogo ou resposta completa do diagnóstico. Logar ID técnico, status e tempo.
- `STORAGE_DRIVER=sqlite` só em ambiente local. Configuração Vercel com SQLite deve falhar, sem fallback silencioso.
- Falhar configuração de publicação sem banco compartilhado, assinatura de sessão e quota persistente.
- Retenção proposta para o piloto: diagnósticos agregados 30 dias; leads 90 dias; eventos 30 dias; quotas e pedidos transitórios até 48 horas. São escolhas operacionais, não prazos legais presumidos.
- Validação local: limpeza por comando manual. Antes de publicação: limpeza programada no Supabase ou Vercel e contato configurado para solicitações de exclusão. Excluir lead remove diagnósticos vinculados.

Configuração prevista: `STORAGE_DRIVER`, `SQLITE_PATH`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SESSION_SECRET`, `RATE_LIMIT_SECRET`, `AI_GATEWAY_API_KEY`, `AI_MODEL`, `AI_MODE`, `ERP_CTA_URL`, `COMPANY_LABEL` e `PRIVACY_CONTACT_EMAIL`. Não colocar valores reais neste plano.

## 13. Plano de execução — P0 local, alvo de quatro horas

Pré-condições: ambiente Node compatível, stack conhecida e uso de IA para acelerar desenvolvimento. Credenciais reais de modelo, identidade visual e URL comercial podem ser configuradas depois; ausências ficam explicitamente sinalizadas. O prazo é estimativa, não garantia.

| Ordem | Entrega | Tempo alvo |
|---|---|---:|
| 1 | Scaffold Next.js, módulos, configuração e demo | 25 min |
| 2 | Parser CSV, mapeamento, prévia e validação por linha | 50 min |
| 3 | Cálculos puros, normalização e cenários de referência | 30 min |
| 4 | Gráfico, ranking, tabela, filtros e parâmetros globais | 45 min |
| 5 | SQLite, sessão, cadastro, consentimentos, idempotência e quota local | 35 min |
| 6 | Diagnóstico IA/agregados, fallback, eventos mínimos e CTA | 25 min |
| 7 | Casos essenciais, navegação no celular e revisão do fluxo | 30 min |
| | **Total alvo** | **240 min** |

Se houver atraso, simplificar acabamento, ordenações secundárias e impressão. Preservar importação, cálculos corretos, identificação de erros, gráfico, captação e distinção entre IA real/fallback/mock. Não substituir requisitos essenciais por dados fictícios apresentados como reais.

O repo está vazio nesta etapa, então scaffold e instalação são trabalho futuro. Iniciar o código somente após pedido posterior do usuário.

## 14. Etapa adicional — publicar Vercel + Supabase

Estimativa inicial adicional: 2–4 horas, a revisar após o P0 e disponibilidade de contas/credenciais. Não incluída nas quatro horas locais.

1. Criar schema/migração Postgres versionada e adapter Supabase com contratos equivalentes ao SQLite.
2. Implementar reserva de quotas e idempotência transacionais no Postgres; não substituir por consultas de contagem sujeitas a corrida.
3. Conferir RLS, grants e acesso server-only, inclusive funções usadas pelo adapter. Executar advisors e verificar ausência de acesso público aos dados.
4. Rodar os mesmos testes de contrato de persistência contra SQLite e Supabase; conferir concorrência e isolamento de sessões.
5. Configurar projeto Vercel, secrets e modelo real; impedir adapter SQLite em deploy.
6. Configurar limpeza/retenção, aviso de privacidade, contato responsável e URL do ERP.
7. Testar preview: importação, quotas compartilhadas, falha de IA, consentimentos, ausência de dados sensíveis em logs e persistência entre instâncias.
8. Publicar apenas quando houver instrução para essa etapa. Nenhum provisionamento ou deploy está autorizado pela solicitação atual de planejamento.

Não é necessário Supabase Auth, Storage, Realtime, Edge Functions, Redis ou servidor adicional para este escopo. Backend permanece nos Route Handlers da Vercel; dados persistidos no Supabase.

## 15. Critérios de aceite

| Caso | Resultado esperado |
|---|---|
| Código `0012345678905` | Preservado como texto, idêntico ao arquivo |
| CSV BR com `;`, BOM, aspas e `1.234,56` | Importação válida e valor 123.456 centavos |
| CSV US com `,` e `1234.56` | Importação válida após selecionar US |
| Campo com separador ou quebra de linha entre aspas | Sem deslocamento de colunas |
| Formato monetário incompatível/ambíguo | Erro visível, sem conversão silenciosa |
| Venda R$ 100 e custo R$ 60 | Margem bruta de R$ 40 e 40% |
| Mesmo produto, desconto 10% e taxa 10% | Preço R$ 90; taxa R$ 9; contribuição R$ 21 e 23,33% |
| Venda R$ 50 e custo R$ 60 | Linha válida e margem de −20% |
| Venda zero / custo ausente | Linha inválida com motivo explícito |
| Custo zero | Linha mantida, com alerta |
| Desconto arredonda preço para zero | Percentual não aplicável, sem divisão por zero |
| Uma linha inválida entre válidas | Análise parcial apenas após confirmação |
| Dois códigos iguais | Registros separados, alerta de duplicidade |
| Arquivo acima dos limites | Recusado antes de análise, sem travar a interface |
| Alterar desconto ou taxa | Cards, gráfico, ranking e tabela coerentes com o mesmo cenário |
| Recusar contato comercial | Diagnóstico permitido; autorização registrada como falsa |
| Recusar salvar resumo | Contato registrado; indicadores e resposta não persistidos |
| API/IA indisponível | Dashboard preservado; fallback claramente identificado |
| Inspecionar requisição IA | Sem nomes, códigos, preços individuais ou contato |
| Repetir pedido idempotente | Sem lead ou geração duplicados |
| Exceder quota | Resposta controlada sem nova chamada ao modelo |
| Configurar SQLite na Vercel | Falha explícita de configuração |

Verificação de implementação futura: testes unitários focados em parser/cálculos, testes de contrato de persistência e um fluxo integrado de importação até diagnóstico. Conferir manualmente celular, teclado e impressão. Não criar testes que apenas espelhem componentes sem validar comportamento.

## 16. Próximos recursos e decisões adiadas

P1: desconto máximo para uma margem escolhida, despesas por produto, simulação individual, comparação de cenários, XLSX, exportação enriquecida, histórico com autenticação, estoque/histórico de vendas e integrações. Priorizar pela observação do piloto.

Configurações comerciais ainda não informadas: nome final da ferramenta, marca, segmentos atendidos, URL do ERP e contato de privacidade. Usar placeholders no futuro desenvolvimento local; configurar antes de captar dados reais/publicar. Não bloquear a entrega deste plano por essas ausências.

## 17. Referências técnicas verificadas

- [Next.js — Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers): handlers server do App Router para as APIs.
- [Vercel — SQLite em ambiente serverless](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel): armazenamento local das Functions não oferece persistência compartilhada adequada ao banco SQLite deste produto.
- [Supabase — Securing your API](https://supabase.com/docs/guides/api/securing-your-api): grants e RLS são controles distintos; credenciais privilegiadas ficam no backend.
- [Vercel — AI Gateway](https://vercel.com/docs/ai-gateway): integração server com provedor de modelo configurável.
- [Supabase — Changelog](https://supabase.com/changelog): índice consultado em 14/10/2026; conferir novamente APIs e mudanças aplicáveis quando implementar.

As escolhas de produto, limites e estimativas são decisões deste planejamento, não garantias dos fornecedores. Nenhuma aplicação, banco ou infraestrutura foi criada nesta etapa.
