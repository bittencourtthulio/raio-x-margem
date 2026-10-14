# Modelos e unidades

Versão 1.0.0

ProductInput exige externalId, sourceVersion, name, purchaseCostCents, salePriceCents e active. externalId é sensível a maiúsculas, tem 1–100 caracteres e não admite espaços externos. name tem 1–200 caracteres. sourceVersion é inteiro positivo seguro JSON. barcode opcional, até 100 caracteres, normaliza ausência para null. sourceUpdatedAt é informativo. Custos 0–100000000; preços 1–100000000.

Envio substitui todos os campos de entrada; não é PATCH. Campos desconhecidos são rejeitados. Custo zero e custo acima da venda geram alertas. Barcode duplicado alerta sem fundir produtos. Atividade false inativa; reativar requer versão nova. Ausência no lote não exclui.

Cenários aceitam discountBps, targetBps e feeBps entre 0 e 9900. Com feeEnabled=false, feeBps deve ser zero. IDs, revisão, origem, datas de servidor e alertas são definidos pelo servidor. Veja os schemas completos em openapi.json.
