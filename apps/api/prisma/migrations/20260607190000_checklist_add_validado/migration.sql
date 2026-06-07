-- Checklist documental em 3 estados com cores (TRNSF-1050):
-- EM_FALTA (vermelho) · RECEBIDO (amarelo, na fila de validação) · VALIDADO (verde).
-- O rótulo legado EM_REVISAO mantém-se (não usado), porque remover um valor de
-- enum em Postgres é inseguro.

-- AlterEnum
-- ALTER TYPE ... ADD VALUE não pode ser referenciado na MESMA transação em que é
-- adicionado. Por isso o valor é adicionado AQUI e só é usado na migração seguinte
-- (20260607190100_checklist_migrate_estados), num ficheiro/transacção separados.
ALTER TYPE "ChecklistStatus" ADD VALUE 'VALIDADO';
