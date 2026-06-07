-- Passo de elegibilidade do aviso no pré-diagnóstico (TRNSF-1034)
ALTER TABLE "pre_diagnosticos" ADD COLUMN "estado_elegibilidade" TEXT NOT NULL DEFAULT 'pendente';
ALTER TABLE "pre_diagnosticos" ADD COLUMN "elegibilidade_detalhe" TEXT;
