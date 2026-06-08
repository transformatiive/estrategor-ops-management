-- TRNSF-1067 · 2b — Reestruturação das fases do pipeline.
-- A cauda da Candidatura passa a ter Análise (A5) e Alegações contrárias (A6).
-- A "Decisão" deixou de ser uma fase; a Execução arranca no Termo de aceitação
-- (B0, remapeado de "Arranque"). Acréscimo de valores de enum — aditivo, sem
-- migração de dados (nenhum projeto está em estados B hoje).
ALTER TYPE "ProjectState" ADD VALUE IF NOT EXISTS 'A5' AFTER 'A4';
ALTER TYPE "ProjectState" ADD VALUE IF NOT EXISTS 'A6' AFTER 'A5';
