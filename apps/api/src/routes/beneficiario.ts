import type { FastifyInstance } from "fastify";
import type { BeneficiarioImportDTO } from "@estrategor/shared";
import { prisma } from "../db.js";
import { requireAuth } from "../auth/guards.js";
import { consultarVies } from "../prediagnostico/vies.js";
import { consultarEmpresas } from "../prediagnostico/empresas.js";

/**
 * Importação da identificação do beneficiário a partir do NIF da empresa
 * (TRNSF-1061). A secção "Identificação do beneficiário" (`beneficiario`) fica
 * vazia enquanto não há documento extraído; este endpoint preenche-a com os
 * dados das mesmas faixas oficiais/comerciais que o pré-diagnóstico já usa
 * (VIES + nif.pt). Tudo entra como `api_empresas` / `por_validar` — o consultor
 * valida campo a campo; nunca se inventam dados (só se escreve o que as fontes
 * devolveram, mais o próprio NIF, que é conhecido).
 */
export async function beneficiarioRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.post<{ Params: { id: string } }>(
    "/api/projects/:id/candidatura/beneficiario/importar",
    async (req, reply) => {
      const project = await prisma.project.findUnique({
        where: { id: req.params.id },
        include: { client: true },
      });
      if (!project) return reply.code(404).send({ error: "Projeto não encontrado." });

      const cand = await prisma.candidatura.findUnique({ where: { projectId: project.id } });
      if (!cand) return reply.code(409).send({ error: "Candidatura não iniciada." });

      const nif = project.client.nif?.trim() ?? "";
      if (!nif) return reply.code(409).send({ error: "O cliente não tem NIF definido." });
      const clean = nif.replace(/[^0-9]/g, "");

      // Faixas oficiais/comerciais (as mesmas do pré-diagnóstico).
      const vies = await consultarVies(nif);
      const emp = await consultarEmpresas(nif);

      // Conjunto de campos a escrever na secção `beneficiario`. Só entram campos
      // com valor; cada um regista a fonte (VIES / nif.pt).
      type Campo = { key: string; value: string | number; sourceRef: string };
      const campos: Campo[] = [];

      // NIF (sempre) — valor limpo. Fonte da validação: VIES.
      campos.push({ key: "nif", value: clean, sourceRef: "VIES" });

      // Denominação social — do VIES (oficial), quando disponível.
      if (vies.nome) campos.push({ key: "nome", value: vies.nome, sourceRef: "VIES" });

      // CAE principal — normalizado contra o catálogo (como no pré-diagnóstico).
      if (emp.estado === "ok" && emp.cae) {
        const cat = await prisma.catalogoCae.findUnique({
          where: { codigo: emp.cae.replace(/[^0-9]/g, "") },
        });
        const desc = cat?.designacao ?? emp.caeDescricao;
        campos.push({
          key: "cae_principal",
          value: `${emp.cae}${desc ? ` — ${desc}` : ""}`,
          sourceRef: "nif.pt",
        });
      }
      if (emp.estado === "ok" && emp.naturezaJuridica) {
        campos.push({ key: "natureza_juridica", value: emp.naturezaJuridica, sourceRef: "nif.pt" });
      }
      if (emp.estado === "ok" && emp.capitalSocial != null) {
        campos.push({ key: "capital_social", value: emp.capitalSocial, sourceRef: "nif.pt" });
      }

      // Degradação graciosa: API de empresas sem chave e o VIES não deu nome →
      // só se escreveria o NIF. Nesse caso reportamos sem_chave (não 500),
      // mas mesmo assim gravamos o NIF (é um facto conhecido e útil).
      const semChaveSemNome = emp.estado === "sem_chave" && !vies.nome;

      // Persistência: upsert de cada campo + log de atividade, em transação.
      await prisma.$transaction(async (tx) => {
        for (const c of campos) {
          await tx.candField.upsert({
            where: {
              candidaturaId_section_key: {
                candidaturaId: cand.id,
                section: "beneficiario",
                key: c.key,
              },
            },
            update: {
              value: c.value as unknown as object,
              origin: "api_empresas",
              state: "por_validar",
              sourceRef: c.sourceRef,
              updatedById: req.user!.id,
            },
            create: {
              candidaturaId: cand.id,
              section: "beneficiario",
              key: c.key,
              value: c.value as unknown as object,
              origin: "api_empresas",
              state: "por_validar",
              sourceRef: c.sourceRef,
              updatedById: req.user!.id,
            },
          });
        }
        await tx.activityLog.create({
          data: {
            projectId: project.id,
            userId: req.user!.id,
            type: "beneficiario_importado",
            description: `Importou identificação do beneficiário (NIF ${clean}).`,
          },
        });
      });

      // Estado de resposta: distingue ok / parcial / sem_chave / falhou. O NIF
      // conta sempre como preenchido; "parcial" sinaliza que houve uma falha
      // relevante (ex.: VIES deu nome mas a API de empresas falhou, ou vice-versa).
      const preenchidos = campos.length;
      let dto: BeneficiarioImportDTO;
      if (semChaveSemNome) {
        dto = {
          estado: "sem_chave",
          preenchidos,
          mensagem: "API de empresas sem chave configurada (NIF_PT_API_KEY).",
        };
      } else {
        const empOk = emp.estado === "ok";
        const empIndisponivel = emp.estado === "falhou" || emp.estado === "sem_chave";
        const temNome = Boolean(vies.nome);
        if (empOk && temNome) {
          dto = { estado: "ok", preenchidos, mensagem: `Importados ${preenchidos} campo(s) da empresa (por validar).` };
        } else if (preenchidos > 1) {
          // Escreveu-se NIF + algo, mas alguma faixa não correu como devia.
          const motivo = empIndisponivel
            ? "dados da empresa indisponíveis (nif.pt)"
            : "denominação social indisponível (VIES)";
          dto = { estado: "parcial", preenchidos, mensagem: `Importação parcial — ${motivo}. ${preenchidos} campo(s) por validar.` };
        } else {
          // Só o NIF foi escrito e nenhuma faixa devolveu dados úteis.
          dto = { estado: "falhou", preenchidos, mensagem: "Não foi possível obter dados das fontes (VIES/nif.pt)." };
        }
      }
      return dto;
    },
  );
}
