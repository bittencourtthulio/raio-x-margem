# Exemplos — contrato 1.0.0

Exemplos educativos executados somente por ação explícita. Sem segredos incluídos. Pré-requisitos: cURL com --fail-with-body, Node.js >=22.13 e Python >=3.11. Fluxo real validado em sandbox local com Node.js 22.23.3 e Python 3.11.7 em 14/10/2026; contribuição obtida: 2100 centavos. Não constituem um conector completo.

## cURL

```sh
# Configure as variáveis no servidor; somente dados fictícios em sandbox.
curl --fail-with-body "$API_BASE_URL/me" \
  -H "Authorization: Bearer $API_KEY"

# Salve product-batch.json com o corpo abaixo antes de executar.
curl --fail-with-body "$API_BASE_URL/stores/$STORE_ID/product-batches" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Idempotency-Key: sandbox-catalog-0001" \
  -H "Content-Type: application/json" \
  --data-binary @product-batch.json
```

### product-batch.json

```json
{
  "products": [
    {
      "externalId": "SKU-001",
      "sourceVersion": 1,
      "name": "Camiseta",
      "barcode": "0012345678905",
      "purchaseCostCents": 6000,
      "salePriceCents": 10000,
      "active": true
    }
  ]
}
```

## TypeScript

```ts
// Node.js >=22.13; executar explicitamente com tsx.
// API_BASE_URL inclui /api/v1. Operações de escrita apenas em sandbox autorizado.
const base = process.env.API_BASE_URL!;
const key = process.env.API_KEY!;
const store = process.env.STORE_ID!;
async function call(path: string, body?: unknown, operationKey?: string) {
  const response = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer ' + key, ...(body ? {
      'Content-Type': 'application/json', 'Idempotency-Key': operationKey!
    } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.code + ' requestId=' + result.requestId);
  return result;
}
const me = await call('/me');
if (me.environment !== 'sandbox' || me.storeId !== store) throw new Error('Confirme ambiente e loja');
await call('/stores/' + store + '/product-batches', {
  "products": [
    {
      "externalId": "SKU-001",
      "sourceVersion": 1,
      "name": "Camiseta",
      "barcode": "0012345678905",
      "purchaseCostCents": 6000,
      "salePriceCents": 10000,
      "active": true
    }
  ]
}, 'sandbox-catalog-0001');
const analysis = await call('/stores/' + store + '/analyses', {"scenario":{"discountBps":1000,"targetBps":2000,"feeBps":1000,"feeEnabled":true}}, 'sandbox-analysis-0001');
const deadline = Date.now() + 60000;
let delay = 2000;
let completed = false;
while (Date.now() < deadline) {
  const result = await call('/stores/' + store + '/analyses/' + analysis.analysisId);
  if (result.status === 'failed') throw new Error('Análise falhou');
  if (result.status === 'completed') {
    const items = await call('/stores/' + store + '/analyses/' + analysis.analysisId + '/items');
    console.log(items.data.map((item: { contributionCents: number }) => item.contributionCents));
    completed = true;
    break;
  }
  await new Promise(resolve => setTimeout(resolve, delay));
  delay = Math.min(10000, delay * 1.5);
}
if (!completed) throw new Error('Timeout: retome consulta pelo analysisId persistido');
// Em produção: persistir chaves antes do envio, paginar e implementar retries limitados.
export {};
```

## Python

```python
# Python >=3.11, biblioteca padrão. Executar apenas em sandbox autorizado.
import json, os, time, urllib.request, urllib.error
base, key, store = [os.environ[name] for name in ('API_BASE_URL', 'API_KEY', 'STORE_ID')]
def call(path, body=None, operation_key=None):
    headers = {'Authorization': 'Bearer ' + key}
    if body is not None:
        headers.update({'Content-Type': 'application/json', 'Idempotency-Key': operation_key})
    request = urllib.request.Request(base + path, data=None if body is None else json.dumps(body).encode(), headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        problem = json.load(error)
        raise RuntimeError(str(problem.get('code')) + ' requestId=' + str(problem.get('requestId'))) from None
me = call('/me')
assert me['environment'] == 'sandbox' and me['storeId'] == store
call('/stores/' + store + '/product-batches', json.loads("{\"products\":[{\"externalId\":\"SKU-001\",\"sourceVersion\":1,\"name\":\"Camiseta\",\"barcode\":\"0012345678905\",\"purchaseCostCents\":6000,\"salePriceCents\":10000,\"active\":true}]}"), 'sandbox-catalog-0001')
analysis = call('/stores/' + store + '/analyses', json.loads("{\"scenario\":{\"discountBps\":1000,\"targetBps\":2000,\"feeBps\":1000,\"feeEnabled\":true}}"), 'sandbox-analysis-0001')
deadline, delay = time.monotonic() + 60, 2
while time.monotonic() < deadline:
    result = call('/stores/' + store + '/analyses/' + analysis['analysisId'])
    if result['status'] == 'failed':
        raise RuntimeError('Análise falhou')
    if result['status'] == 'completed':
        items = call('/stores/' + store + '/analyses/' + analysis['analysisId'] + '/items')
        print([item['contributionCents'] for item in items['data']])
        break
    time.sleep(delay)
    delay = min(10, delay * 1.5)
else:
    raise TimeoutError('Retome a consulta pelo analysisId persistido')
# Conector real: persistir chaves, paginar e implementar retries limitados.
```
