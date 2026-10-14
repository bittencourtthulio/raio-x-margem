# Autenticação e escopos

Versão 1.0.0

Authorization: Bearer <chave>. A API não usa sessão de navegador, cookies nem CORS para chamadas privadas. HTTPS obrigatório fora do desenvolvimento local. Nunca cole segredos em chats públicos, URLs, analytics ou documentação.

products:write envia lotes; products:read consulta produtos e mudanças; analyses:write cria análises; analyses:read lê status e resultados. Emita analyses:write junto com analyses:read. Chaves somente de leitura são suportadas. Nenhuma chave gerencia membros.

A chave expira inicialmente em 90 dias. Rotação cria nova chave da mesma origem, com sobreposição de até 24 horas. Troque o segredo no conector e revogue o antigo. Revogação bloqueia novas chamadas imediatamente. Nunca contorne 403 alterando IDs: cada recurso é validado contra a loja e recurso alheio retorna 404.
