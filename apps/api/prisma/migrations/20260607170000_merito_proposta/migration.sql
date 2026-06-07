-- Proposta de pontuação de mérito assistida por IA (TRNSF-1039).
-- Separada da selecção do consultor (merit_inputs): a IA propõe (por_validar),
-- o consultor revê e guarda. Sem evidência → proposta vazia + nota.
ALTER TABLE "diagnostics" ADD COLUMN "merit_proposal" JSONB;
ALTER TABLE "diagnostics" ADD COLUMN "merit_proposal_estado" TEXT;
ALTER TABLE "diagnostics" ADD COLUMN "merit_proposal_nota" TEXT;
