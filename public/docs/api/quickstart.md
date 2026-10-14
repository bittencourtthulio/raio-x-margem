# Início rápido

Versão 1.0.0

Use apenas uma instalação configurada para sandbox com dados fictícios. O responsável verificado cria a loja, autoriza armazenamento e emite uma credencial em /app/integracoes. Configure API_BASE_URL (terminando em /api/v1), API_KEY e STORE_ID no servidor do conector; nunca em código cliente ou arquivos versionados.

1. Consulte GET /me e confira storeId, sourceId, environment e scopes.
2. Envie o produto fictício SKU-001: custo 6000, venda 10000, active=true e sourceVersion=1, com Idempotency-Key persistente.
3. Conclua todos os lotes antes da primeira análise. Solicite scenario com discountBps=1000, targetBps=2000, feeBps=1000 e feeEnabled=true.
4. Consulte a URL em Location até completed ou failed. Inicie polling em 2s e aumente até 10s com timeout local.
5. Consulte /items: preço simulado 9000, taxa 900 e contribuição 2100; contributionPercent aproximadamente 23,3333.

O worker durável precisa estar ativo na instalação. Um 202 confirma a captura e enfileiramento, não a conclusão. Ver os exemplos completos em examples.md.
