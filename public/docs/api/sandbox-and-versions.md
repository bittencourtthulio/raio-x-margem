# Sandbox, versões e operação

Versão 1.0.0

Desenvolvimento local: configure Postgres dedicado, aplique migrações e execute o worker. Crie loja e credencial sandbox pela área autenticada. Use dados fictícios; reset por exclusão autorizada da loja e recriação. Uma chave sandbox não funciona em instalação production. Use bancos diferentes para ambientes.

Release 1.0.0: contrato inicial dos nove endpoints, documentação e skill de prévia. Não há sandbox hospedado. Contato de suporte: bittencourtthulio@gmail.com. Durante desenvolvimento, reporte falhas ao responsável pela instalação com requestId e código, sem segredos ou payloads.

Mudanças aditivas de resposta são permitidas; consumidores devem tolerar novos campos. Remoções, mudança de unidade, obrigatoriedade ou semântica incompatível exigem /api/v2. Descontinuação pública: política proposta de aviso mínimo de 90 dias, a confirmar na liberação.

Retenção operacional proposta: análises, alterações e auditoria 90 dias; idempotência e jobs concluídos sete dias; snapshot 30 minutos. O catálogo permanece armazenado até exclusão solicitada pelo responsável, inclusive após desconexão. Desconexão revoga acesso e interrompe novas sincronizações; não apaga o catálogo automaticamente. Solicitação de exclusão bloqueia acesso e elimina os dados da instalação imediatamente (dentro da janela máxima de sete dias). Operação na Vercel e Supabase, com limpeza diária. Contato: bittencourtthulio@gmail.com.
