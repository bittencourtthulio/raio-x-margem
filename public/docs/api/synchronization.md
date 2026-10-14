# Sincronização e retomada

Versão 1.0.0

Lotes são atômicos com até 500 produtos e 1 MiB. Nenhum item é gravado se houver erro ou conflito. externalId repetido no mesmo lote é inválido. sourceVersion maior aplica; igual com conteúdo normalizado idêntico retorna unchanged; menor ou igual com conteúdo divergente retorna 409. Mantenha contador durável na origem; não substitua por relógios locais.

Bootstrap: GET /products retorna snapshotId, asOfRevision, changesCursor e nextCursor. Percorra nextCursor até null no mesmo snapshot, válido 30 minutos. O snapshot inclui inativos e não muda durante paginação.

Incremental: inicie /product-changes?cursor=<changesCursor> do bootstrap. Aplique cada estado product por revision crescente; operation é upsert ou deactivate. Salve changesCursor somente depois de persistir a página aplicada. nextCursor null indica ausência de outra página agora; mantenha changesCursor para a próxima consulta. Eventos reaplicados são deduplicados por revisão.

Feed dura 90 dias. 410 sync_cursor_expired ou snapshot expirado exige novo bootstrap. Cursor é opaco e vinculado à loja, ambiente e recurso. Nunca edite, compartilhe entre lojas nem use offset. Na troca de ERP, remapeie IDs explicitamente e faça novo bootstrap; barcode não é identidade.
