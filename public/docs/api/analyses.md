# Análises imutáveis

Versão 1.0.0

POST /analyses captura todos os produtos ativos confirmados e o cenário numa transação. Estados queued → running → completed ou failed. Catálogo vazio: 422. catalogRevision e calculationVersion identificam a base do resultado. Alterações posteriores no catálogo não modificam a análise.

GET /analyses lista metadados; GET /analyses/{analysisId} fornece status, cenário e resumo; /items retorna resultados paginados e o produto do snapshot. summary pode ser null antes de conclusão. invalidCount é zero porque entradas inválidas são rejeitadas no lote.

A API calcula margem bruta estimada e contribuição estimada; não representa lucro líquido nem impacto total da loja. Não altera preços no ERP, não considera vendas ou estoque e não consome geração de IA. Meta de 5000 itens em 30 segundos depende de medição, não é SLA.
