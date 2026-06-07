-- Encerrar um diagnóstico A0 que não passa: estado terminal reversível
-- "Não prosseguiu" (TRNSF-1044). O gestor/admin pode reabrir → A0.

-- AlterEnum
-- ALTER TYPE ... ADD VALUE não pode ser usado na MESMA transação em que o novo
-- valor é referenciado. Aqui o valor 'ENCERRADO' não é usado por nenhuma das
-- instruções seguintes (a coluna é TEXT), pelo que é seguro no mesmo ficheiro.
ALTER TYPE "ProjectState" ADD VALUE 'ENCERRADO';

-- AlterTable
ALTER TABLE "diagnostics" ADD COLUMN "encerrado_motivo" TEXT;
