---
name: raio-x-margem-api
description: Construir, revisar e depurar conectores de ERP para a API Raio-X de Margem, com catálogo, sincronização e análises, na linguagem e projeto escolhidos pelo usuário.
---

# Integrar Raio-X de Margem

Contrato 1.0.0, versão publicada. Leia [contrato e configuração](references/api-contract.md) e confira info.version em [OpenAPI incluído](assets/openapi.json) contra a instalação de destino. Use operationId e schemas reais. Produção: https://raio-x-margem-five.vercel.app. Publicação pelo titular, sem licença adicional de reutilização.

Configure API_BASE_URL, API_KEY e STORE_ID no servidor por variáveis de ambiente ou cofre. Não peça segredos em texto público. GET /me deve confirmar loja, origem, ambiente e escopos. Construir um conector não autoriza escrever em produção. O pacote não executa nada ao instalar ou ler.

Preserve externalId estável e zeros de barcode; dinheiro inteiro em centavos BRL, percentuais de entrada em pontos-base. Valide conversões sem ponto flutuante impreciso. Campos desconhecidos são rejeitados e cada envio substitui os campos completos. Não invente endpoints, campos nem suporte a webhooks.

Para carga e retomada, leia [sincronização](references/synchronization.md): lotes atômicos, sourceVersion durável, bootstrap consistente e cursor salvo somente após aplicar a página. Persista Idempotency-Key por operação antes da chamada e reutilize em retry.

Para falhas e polling, leia [erros e retries](references/errors-and-retries.md). Não repita conflitos indiscriminadamente. No máximo cinco tentativas com jitter, respeitando Retry-After. Registre requestId, código e contagens sem token ou payload do catálogo.

Para validar, leia [exemplos](references/examples.md). Use sandbox autorizado e dados fictícios. A análise usa snapshot imutável, não altera preços e não significa lucro líquido. Entregue integração na stack do usuário, configuração documentada e evidência observada do fluxo sandbox. Se não houver ambiente executável, relate o impedimento sem alegar validação real.
