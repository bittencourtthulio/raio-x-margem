# Referência de operações — 1.0.0

Schemas completos no [contrato](v1/openapi.json).

## getIntegrationIdentity

GET /api/v1/me

Identificar credencial. Retorna loja, origem, ambiente, escopos e limites efetivos.

Escopo: qualquer chave válida. Resposta: Me.

## upsertProductBatch

POST /api/v1/stores/{storeId}/product-batches

Enviar lote de produtos. Lote atômico: 1–500 itens, até 1 MiB. Repetir externalId invalida o lote. sourceVersion crescente; versão igual só aceita conteúdo normalizado idêntico. Barcode omitido vira null. Não substitui catálogo completo.

Escopo: products:write. Resposta: BatchResult.

## listProducts

GET /api/v1/stores/{storeId}/products

Consultar snapshot do catálogo. Abre snapshot consistente de 30 minutos. Ordenação por externalId (bytes UTF-8) e id. Salve changesCursor para recuperar alterações ocorridas durante a paginação. Inclui inativos.

Escopo: products:read. Resposta: ProductPage.

## getProduct

GET /api/v1/stores/{storeId}/products/{productId}

Consultar produto. Produto atual, inclusive inativo. Recurso de outra loja retorna 404.

Escopo: products:read. Resposta: Product.

## listProductChanges

GET /api/v1/stores/{storeId}/product-changes

Ler alterações incrementais. Revisão crescente por loja. Use cursor obtido no bootstrap; persista changesCursor após aplicar a página. nextCursor=null indica fim da página disponível, não fim da sincronização. Retenção de 90 dias; 410 exige novo bootstrap.

Escopo: products:read. Resposta: ChangePage.

## createAnalysis

POST /api/v1/stores/{storeId}/analyses

Solicitar análise. Captura produtos ativos e cenário num snapshot imutável; retorna 202 e Location. Catálogo vazio retorna 422. feeEnabled=false exige feeBps=0. Análises não alteram preços nem geram diagnóstico com IA.

Escopo: analyses:write. Resposta: AnalysisAccepted.

## listAnalyses

GET /api/v1/stores/{storeId}/analyses

Listar análises. Metadados ordenados de forma estável por criação e ID, do mais recente ao mais antigo.

Escopo: analyses:read. Resposta: AnalysisPage.

## getAnalysis

GET /api/v1/stores/{storeId}/analyses/{analysisId}

Consultar análise. Estados queued, running, completed ou failed. summary fica null até conclusão. catalogRevision informa o catálogo capturado, não o atual.

Escopo: analyses:read. Resposta: Analysis.

## listAnalysisItems

GET /api/v1/stores/{storeId}/analyses/{analysisId}/items

Consultar resultados por produto. Resultados do snapshot imutável. Valores monetários inteiros em centavos; percentuais sem arredondamento de apresentação ou null. Ordenação crescente por activePercent (null no fim), externalId (bytes UTF-8) e id.

Escopo: analyses:read. Resposta: AnalysisItemsPage.