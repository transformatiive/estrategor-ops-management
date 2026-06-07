-- Migração dos estados legados da checklist para o novo modelo (TRNSF-1050).
-- Modelo antigo: RECEBIDO = documento validado/arquivado; EM_REVISAO = na fila.
-- Modelo novo: VALIDADO = arquivado; RECEBIDO = na fila de validação.
-- O valor 'VALIDADO' foi adicionado na migração anterior, pelo que já pode ser
-- referenciado aqui.
UPDATE "checklist_items" SET "status" = 'VALIDADO' WHERE "status" = 'RECEBIDO';
UPDATE "checklist_items" SET "status" = 'RECEBIDO' WHERE "status" = 'EM_REVISAO';
