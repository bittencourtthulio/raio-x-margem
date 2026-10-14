# Erros, limites e retries

Versão 1.0.0

Erros seguem application/problem+json: type, title, status, detail, instance, code, requestId e errors (campo, motivo e índice quando aplicável). Não registre token nem corpo do catálogo. Guarde requestId, status, code, contagens e duração.

400: JSON/cursor; 401: chave; 403: escopo; 404: inexistente/inacessível; 409: conflito de versão ou idempotência; 410: bootstrap expirado; 413: dividir lote; 415: usar JSON UTF-8; 422: corrigir valores; 429: aguardar Retry-After; 503: indisponibilidade temporária.

Ambos os POSTs exigem Idempotency-Key. Persista antes de enviar. A chave é vinculada à loja, origem, método e caminho, retida sete dias. Mesma chave e pedido normalizado: resposta original; corpo diferente: 409. idempotency_in_progress: repetir depois com mesma chave. Rotacionar credencial da mesma origem mantém idempotência. Após sete dias uma repetição pode criar outra análise.

Limites por loja: 120 leituras/minuto, 20 lotes/minuto, 5 análises/hora, 20/dia e 5000 produtos ativos. Replay idempotente não consome outra análise. Falha de rede, 429 e 503: backoff exponencial com jitter, no máximo cinco tentativas, respeitando Retry-After. Depois, grave falha recuperável. Não repita 409 genericamente nem gere nova chave a cada retry.
