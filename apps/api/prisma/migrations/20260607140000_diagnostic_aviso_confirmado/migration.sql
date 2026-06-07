-- Escolha explícita do aviso por projeto (TRNSF-1031)
ALTER TABLE "diagnostics" ADD COLUMN "aviso_confirmado" BOOLEAN NOT NULL DEFAULT false;
