# Plataforma Estrategor — Especificação da Semana 1 (Fase A)

> Fonte única das **regras transversais** da plataforma. O "o quê + onde + comportamento" de cada bloco vive nos tickets Jira (TRNSF‑934…941); as **grelhas de mérito** (dados) vivem no TRNSF‑941. Este documento não duplica esses conteúdos — define o que é partilhado entre blocos.
>
> Versão: 2026‑05‑30 · Língua: PT‑PT · Autor: Transformatiive

---

## 1. Visão e objetivo da Semana 1

Transformar o protótipo estático (`estrategor_platform_prototype.html`) numa aplicação real e entregar, de ponta a ponta, o início da **Fase A** (preparação de candidatura): acesso, base da aplicação com dados reais, pastas no WorkDrive, recolha de documentos ao cliente, classificação/arquivo com IA, rastreio/seguimento automático e o diagnóstico A0.

Princípio orientador: a plataforma é a **camada operacional**; o CRM mantém‑se como fonte de verdade comercial. A IA propõe, o humano decide — nenhuma ação irreversível (arquivo definitivo, pontuação de mérito, submissão) acontece sem validação humana explícita.

---

## 2. Arquitetura e tecnologia

| Camada | Tecnologia |
| --- | --- |
| Alojamento + CI/CD | Railway (deploy automático a cada push na branch principal) |
| Base de dados | PostgreSQL |
| Automação / fluxos | n8n (infraestrutura Transformatiive) |
| Processamento de documentos (IA) | Claude API |
| Documentos | Zoho WorkDrive |
| Email | Notificações a consultor e cliente |

Integrações que entram nesta fase: WorkDrive (pastas + upload), email (notificações/seguimento), Claude API (classificação/divisão de documentos). O webhook LOBA (§10) é preparado mas só é exercido na Semana 3.

---

## 3. Âmbito da Semana 1 e relação com o protótipo

O protótipo é um cockpit do consultor com: sidebar (**Geral**: Dashboard, Projectos, Prazos, Tarefas · **Programas**: PT2030, Formação, Fiscal · **Configuração**: Clientes, Definições), as vistas Dashboard, Projectos (tabela), Prazos, PT2030 (kanban por fase), Formação, Fiscal e Tarefas, e um **drawer de detalhe** (`#detailOverlay`) com Resumo, Milestones e Acções rápidas.

A Semana 1 acrescenta, por cima desta base:

| Bloco | Ticket | O que acrescenta ao protótipo |
| --- | --- | --- |
| A — Acesso e Utilizadores | TRNSF‑934 | Login antes do cockpit; gestão de utilizadores em *Configuração* |
| B — Base da Aplicação | TRNSF‑935 | Dados reais (Railway+Postgres) a substituir o `const PROJECTS`; **página de projecto** com separadores |
| C — Pastas no WorkDrive | TRNSF‑936 | Árvore de pastas por projecto; separador *Documentos* ligado ao WorkDrive |
| D — Recolha ao Cliente | TRNSF‑937 | Separador *Recolha* + formulário público ao cliente |
| E — Classificação/Arquivo (IA) | TRNSF‑938 | Fila de validação no separador *Documentos* |
| F — Rastreio/Seguimento | TRNSF‑939 | Checklist verde/vermelho + lembretes; alimenta *Prazos* e *🔴 Prazos urgentes* |
| G — A0 Diagnóstico | TRNSF‑940 | Separador *Diagnóstico* (acesso + mérito por grelha configurável) |
| G.1 — Seeding das grelhas | TRNSF‑941 | Dados das grelhas de mérito (configuração) |

A **página de projecto** (aberta pelo botão "→ Abrir projecto" do drawer) é o contentor onde os separadores Diagnóstico / Recolha / Documentos / Checklist & Seguimento encaixam.

---

## 4. Modelo de dados

Entidades nucleares (atributos indicativos; o schema final é proposto pelo Claude Code em TRNSF‑935):

- **Utilizador** — id, nome, email, papel (`gestor` | `consultor` | `admin`), estado, hashed_password, created_at.
- **Cliente** — id, nome, NIF, contactos, notas.
- **Projeto** — id, cliente_id, programa (PT2030 | RFAI | SIFIDE | Formação | …), medida/aviso, fase (estado — ver §8), responsável (utilizador_id), progresso, prazo, investimento, incentivo, workdrive_folder_id.
- **ItemChecklist** — id, projeto_id, tipo_documento, estado (em falta | entregue | validado), documento_id?.
- **Documento** — id, projeto_id, tipo, ficheiro_workdrive_id, origem (cliente | manual), estado, tipo_proposto?, confianca?, validado_por?, validado_em?.
- **PedidoRecolha** — id, projeto_id, itens[], token, estado, prazo.
- **Lembrete** — id, item_id, agendado_para, enviado_em, ronda (1|2|3).
- **DiagnosticoA0** — id, projeto_id, condicoes[], elegivel, mp, grelha_versao, resultado.
- **GrelhaMerito** — ver §7.2 (configuração; dados em TRNSF‑941).

---

## 5. Épicos e user stories (A–G)

O detalhe de cada user story — ecrãs, navegação, comportamento, estados visuais e critérios de aceitação — está nos tickets TRNSF‑934…940. Este documento fornece-lhes as regras partilhadas (§4, §6, §7, §8, §9, §11). Regra de ouro de execução: **um ticket = um PR**; o Claude Code pergunta os casos‑limite antes de codificar cada bloco.

---

## 6. Taxonomia de documentos e árvore de pastas (WorkDrive)

Árvore criada por projecto; a subárvore depende do `programa`.

```
{Cliente}/
  0-ELEMENTOS/
  1-INCENTIVOS/
    {SI <medida> nº xxxx}/
      Candidatura/
      Submissão/
      Análise + Pedido de Elementos + Decisão/
      Termo de Aceitação/
      Execução/
  2-BF/
    RFAI/
    SIFIDE/
  3-FORMAÇÃO/
```

Tipos de documento (excerto — a lista completa por programa é a base da checklist do §F):

| Tipo de documento | Programa | Pasta destino | Obrigatório |
| --- | --- | --- | --- |
| IES | PT2030 / BF | 0-ELEMENTOS | Sim |
| Certidão PME (IAPMEI) | PT2030 | 1-INCENTIVOS/.../Candidatura | Sim |
| Balancete / contas | PT2030 / BF | 0-ELEMENTOS | Sim |
| Certidão AT/SS regularizada | Todos | 0-ELEMENTOS | Sim |
| Memória descritiva | PT2030 | 1-INCENTIVOS/.../Candidatura | Sim |
| Comprovativo de submissão | PT2030 | 1-INCENTIVOS/.../Submissão | Sim |
| Termo de aceitação | PT2030 | 1-INCENTIVOS/.../Termo de Aceitação | Sim |

> Nota: a lista é configurável por programa/aviso. A checklist (§F) é gerada a partir desta taxonomia.

---

## 7. A0 — Diagnóstico (condições de acesso + mérito)

O A0 é a fase anterior a Candidatura (§8). Tem duas secções: **condições de acesso** (passa/não passa) e **mérito** (pontuação MP). Ambas são **configuráveis por aviso** — variam de medida para medida e são revistas.

### 7.1 Condições de acesso (por aviso)

A verificação de acesso é uma lista de condições por aviso. Cada condição indica claramente se passa e, se falhar, porquê. Dois exemplos reais e citáveis:

**SI Inovação Produtiva — Aviso MPr‑2025‑9 (REITD, Portaria 103‑A/2023):**
- PME com contabilidade organizada (art. 14.º DL 20‑A/2023; art. 6.º e 22.º REITD).
- Autonomia financeira (Anexo III REITD, ano 2024).
- Realizar ≥ 25% dos capitais próprios até ao 1.º pagamento.
- Indicador de Impacto do Investimento: II = Despesa Elegível / Ativo Fixo Líquido pré‑projeto ≥ 10% (PITD/Norte/Centro).
- Princípio DNSH (não prejudicar significativamente).
- Tipologia de ação válida: novo estabelecimento / aumento de capacidade (mín. 20%) / diversificação (despesa ≥ 200% do valor dos ativos reutilizados) / alteração fundamental de processo.
- Localização: estabelecimento do investimento (não a sede); território de baixa densidade.
- Duração da operação: 24 meses. Situação regularizada AT e Segurança Social; sem duplo financiamento.

**SICE Qualificação das PME — Aviso MPr‑2025‑2:**
- PME (ou entidade beneficiária elegível) nos termos do art. 14.º DL 20‑A/2023 e REITD.
- Situação financeira equilibrada / autonomia financeira no ano de referência.
- Custo total da operação ≥ 200.000 € (limite máximo 5 M€ nas operações em conjunto).
- Intervenção em pelo menos 2 domínios imateriais de competitividade.
- Duração da operação: 24 meses.

> As condições de acesso são dados por aviso (à semelhança da grelha de mérito). Não devem ser escritas no código.

### 7.2 Mérito — motor `GrelhaMerito` (configurável)

A pontuação de mérito (MP) é calculada a partir de uma **grelha carregada como dados**, identificada por `programa · medida · codigo_aviso · regiao · versao`. Trocar ou actualizar uma grelha **não** exige alterar código. Se não existir grelha para o aviso, o ecrã indica‑o explicitamente em vez de inventar uma pontuação.

Esquema:

```
GrelhaMerito {
  programa, medida, codigo_aviso, regiao|null, versao, fonte_url,
  escala: { min, max, descritores{1..5} },
  mp_minimo, minimo_por_criterio,
  formula_mp,                  // ex.: "0.30*A + 0.30*B + 0.15*C + 0.25*D"
  desempate: [..],
  criterios: [ { codigo, nome, peso, formula?, subcriterios: [ { codigo, nome, regras|matriz } ] } ]
}
```

O campo `regiao` fica nulo quando o referencial não varia por região; preenche‑se quando há matriz regional (ex.: subcritério A.1 / RIS3, com matrizes por NUTS II).

**Dados das grelhas:** vivem no ticket **TRNSF‑941** (não neste documento). A primeira grelha real semeada é a **SICE Qualificação das PME — MPr‑2025‑2** (`MP = 0,3 A + 0,3 B + 0,15 C + 0,25 D`, escala 1–5, MP mínimo 3,00, mínimo de 3,00 por critério). As restantes medidas (Qualificação Individuais, Internacionalização, Inovação Produtiva BD e RCI, SIID I&D) estão listadas com as fontes oficiais no mesmo ticket.

**Fora de âmbito do motor de mérito:** RFAI e SIFIDE são benefícios fiscais — a lógica é de elegibilidade/limites fiscais, não de pontuação concursal. Modelar à parte.

---

## 8. Máquina de estados

**Fase A — Preparação da candidatura:**
`A0 Diagnóstico → A1 Recolha → A2 Preparação → A3 Revisão → A4 Submissão`

**Fase B — Pós‑aprovação:**
`B0 Arranque → B1 Execução → B2 Encerramento`

Transições‑chave:
- `A0 → A1` só com diagnóstico concluído (acesso verificado; MP calculado quando há grelha).
- `A4 → B0` após aprovação comunicada (entrada na execução).
- Cada transição regista data e autor.

**Mapeamento para o kanban PT2030 do protótipo** (vista mais grosseira):

| Coluna do kanban | Estados internos |
| --- | --- |
| Candidatura | A0, A1 |
| Em preparação | A2, A3 |
| Aprovado | A4 → B0 |
| Execução | B1 |
| Encerramento | B2 |

---

## 9. Motor de seguimento

Quando um item de checklist está em falta, são agendados lembretes automáticos por email ao cliente; o motor pára quando o item é entregue. Os atrasos alimentam a vista *Prazos* e o bloco *🔴 Prazos urgentes* do dashboard.

| Ronda | Quando | Destinatário |
| --- | --- | --- |
| 1 | T+1 dia útil | Cliente |
| 2 | T+3 dias úteis | Cliente |
| 3 | T+5 dias úteis | Cliente (com cópia ao consultor) |

Texto‑base dos emails (ajustável):
- **T+1:** lembrete cordial — "Faltam alguns documentos no seu projecto {Projecto}. Pode entregá‑los em {ligação}."
- **T+3:** reforço — lista do que falta + prazo.
- **T+5:** escalamento — aviso de impacto no prazo da candidatura; cópia ao consultor responsável.

Entregar um documento (via §D ou §E) passa o item a verde e cancela os lembretes pendentes.

---

## 10. Integração LOBA (webhook) — preparar nesta fase, exercer na Semana 3

Preparar o ponto de entrada para o webhook que liga o CRM/parceiro LOBA à plataforma (criação/atualização de projecto a partir de evento comercial). Definir `endpoint`, autenticação e `payload` mínimo (cliente, programa, consultor, valor estimado). Não é exercido em produção nesta semana.

---

## 11. Convenções

- **Nomes de ficheiro:** `{Cliente}_{Programa}_{TipoDocumento}_{Data}` (data em `AAAA‑MM‑DD`).
- **Sessão:** cookie httpOnly. **Não usar** localStorage/sessionStorage para estado sensível.
- **Língua:** PT‑PT em todo o produto. Usar **comprovativo** (nunca "comprovante"). Evitar anglicismos quando há termo PT‑PT corrente.
- **Validação humana:** qualquer ação irreversível (arquivo definitivo de documento, atribuição de pontuação, submissão) exige confirmação humana.
- **Branches/PR:** `TRNSF-XXX-descricao`; título do PR começa por `TRNSF-XXX` (liga ao Jira).

---

## 12. Mapeamento Jira

| Bloco | Ticket | Depende de |
| --- | --- | --- |
| A — Acesso e Utilizadores | TRNSF‑934 | — |
| B — Base da Aplicação | TRNSF‑935 | 934 |
| C — Pastas no WorkDrive | TRNSF‑936 | 935 |
| D — Recolha ao Cliente | TRNSF‑937 | 935 |
| E — Classificação/Arquivo (IA) | TRNSF‑938 | 936, 937 |
| F — Rastreio/Seguimento | TRNSF‑939 | 938 |
| G — A0 Diagnóstico | TRNSF‑940 | 935 |
| G.1 — Seeding das grelhas | TRNSF‑941 | 940 |

**Ordem de implementação:** 934 → 935 → (936, 937, 940) → 938 → 939, com 941 a alimentar 940.

> O Jira tem um agente de triagem que adiciona comentários automáticos. A **descrição** de cada ticket é a fonte de verdade; comentários automáticos de triagem devem ser ignorados pelo Claude Code.
