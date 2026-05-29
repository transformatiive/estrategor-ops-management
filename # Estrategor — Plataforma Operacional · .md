# Estrategor — Plataforma Operacional · Spec da Semana 1

> Documento de referência para o Claude Code. Fonte: Transformatiive, maio 2026.
> PT-PT. "Sistema" = a plataforma; "consultor" = utilizador interno; "cliente" = empresa candidata.

## 1. Contexto e objetivo
Plataforma web à medida para a gestão de candidaturas a fundos (PT2030). A Semana 1
entrega a **base da aplicação** e o **mecanismo de recolha de documentos** da Fase A —
o ciclo completo de pedir, receber, identificar, arquivar e perseguir documentos —
demonstrável com um projeto real, mais o **diagnóstico de elegibilidade (A0)**.

Partimos de um protótipo estático e interativo já existente neste repositório. A Semana 1
é, em grande medida, ligar esse front-end a um back-end real e dar-lhe estas capacidades.

## 2. Stack e arquitetura-alvo
- **Alojamento + CI/CD:** Railway (deploy a partir do `main`).
- **Base de dados:** PostgreSQL (no Railway).
- **Fluxos/integrações:** n8n (receção do formulário de recolha, pipeline de
  classificação/divisão de documentos, agendador de lembretes).
- **IA:** API Claude (leitura, visão e classificação de documentos).
- **Armazenamento de ficheiros:** Zoho WorkDrive (pastas partilhadas por cliente).

## 3. Ordem de construção
1. **Fundação (esqueleto que anda):** protótipo no Railway + CI/CD + PostgreSQL ligado +
   health-check. → depois autenticação (Épico A).
2. **Base da aplicação** (Épico B) — projetos, estados, ecrã de Diagnóstico.
3. **Pastas WorkDrive** (Épico C) — estrutura padrão + criação automática.
4. **Recolha** (Épico D) — checklist + formulário ao cliente.
5. **Classificação/Divisão/Arquivo** (Épico E) — depende de C e D.
6. **Rastreio e seguimento** (Épico F) — depende de D e E.
7. **A0 Diagnóstico** (Épico G) — pode correr em paralelo após a Base (B).

Regra: **uma história por PR**, com os critérios de aceitação como definição de "feito".

## 4. Épicos e user stories

### Épico A — Acesso e Utilizadores
- **A-01** (Consultor) Iniciar sessão com e-mail e palavra-passe.
  - ✅ Login válido entra; inválido recusado com mensagem; sessão persiste; logout termina.
- **A-02** (Admin) Criar, editar e desativar utilizadores.
  - ✅ Cria com perfil; edita dados; desativar impede login sem apagar histórico.
- **A-03** (Admin) Atribuir perfis Admin ou Padrão.
  - ✅ Padrão não vê gestão de utilizadores; Admin vê tudo; perfil editável.
- **A-04** (Admin) Redefinir a palavra-passe de qualquer utilizador.
  - ✅ Admin redefine; utilizador entra com a nova; ação registada.

### Épico B — Base da Aplicação
- **B-01** (Consultor) Ver a lista de projetos com a fase atual.
  - ✅ Mostra empresa, programa, consultor, fase/estado, próxima ação; ordenável.
- **B-02** (Consultor) Criar um projeto manualmente (empresa, programa/medida).
  - ✅ Criar gera o espaço de projeto + estrutura de pastas; o programa seleciona a checklist.
- **B-03** (Consultor) Ver os estados possíveis (Candidatura → Execução).
  - ✅ Estados A0–A4, B0–B2 visíveis; atual destacado; transição manual.
- **B-04** (Consultor) Abrir o ecrã de Diagnóstico de um projeto.
  - ✅ Mostra a checklist do programa, estado por documento, acesso ao ficheiro.

### Épico C — Pastas no WorkDrive
- **C-01** (Transformatiive) Propor a estrutura de pastas padrão para validação.
  - ✅ Árvore (ELEMENTOS, INCENTIVOS › Candidatura/Submissão/Análise/TA/Execução, BF,
    FORMAÇÃO) baseada nos ~538 ficheiros reais; enviada para validação.
- **C-02** (Sistema) Criar a estrutura de pastas no WorkDrive ao criar o projeto.
  - ✅ Cria a árvore no WorkDrive do cliente; idempotente.
- **C-03** (Consultor) Abrir as pastas/ficheiros do WorkDrive a partir da plataforma.
  - ✅ Cada documento tem ligação direta ou vista integrada da pasta/ficheiro.

### Épico D — Recolha Documental e Formulário ao Cliente
- **D-01** (Sistema) Gerar a checklist de documentos a partir do programa.
  - ✅ Gerada da taxonomia oficial; itens aplicáveis ao programa; cada item com
    responsável e estado.
- **D-02** (Consultor) Enviar ao cliente um e-mail com ligação a um formulário.
  - ✅ Ligação de uso único (sem conta); validade limitada; rastreável.
- **D-03** (Cliente) Abrir um formulário com a imagem do portal e carregar documentos.
  - ✅ Com a imagem do portal; aceita vários ficheiros e formatos (PDF, imagem); confirma submissão.
- **D-04** (Sistema) Partindo de zero ou de documentos já existentes, saber o que falta.
  - ✅ A checklist reflete o que existe; o formulário pede apenas o que falta.

### Épico E — Classificação, Divisão e Arquivo (IA)
- **E-01** (Sistema) Ler cada ficheiro e identificar o documento (IES, certidão PME, etc.).
  - ✅ Cada ficheiro recebe um tipo da taxonomia; confiança baixa é assinalada para revisão.
- **E-02** (Sistema) Detetar ficheiros que contêm vários documentos.
  - ✅ Ficheiro multi-documento identificado; fronteiras detetadas por página.
- **E-03** (Sistema) Dividir esse ficheiro em documentos separados.
  - ✅ PDF dividido nos limites corretos; cada parte fica como ficheiro autónomo.
- **E-04** (Sistema) Renomear com convenção {Cliente}_{Programa}_{TipoDocumento}_{Data}.
  - ✅ Nome segue o padrão; sem colisões.
- **E-05** (Sistema) Arquivar cada documento na pasta correta do WorkDrive.
  - ✅ Colocado na pasta mapeada ao tipo; visível no ecrã de Diagnóstico.
- **E-06** (Consultor) Rever e corrigir uma classificação errada.
  - ✅ Reclassifica; o ficheiro move-se para a pasta certa; correção registada.

### Épico F — Rastreio e Seguimento Automático
- **F-01** (Sistema) Cruzar o recebido com a checklist.
  - ✅ Por documento: recebido/em falta; contagem de pendências por projeto e por cliente.
- **F-02** (Sistema) Enviar lembrete automático quando faltam documentos.
  - ✅ E-mail "faltam estes" com a lista e a ligação de recarregamento.
- **F-03** (Sistema) Insistir em intervalos crescentes (1 dia, depois 2–3).
  - ✅ Sem resposta, novos lembretes; cada envio registado.
- **F-04** (Sistema) Escalar para o consultor quando não há resposta.
  - ✅ Após N tentativas, alerta ao consultor ("ligar ao cliente").
- **F-05** (Sistema) Fechar o ciclo quando tudo é recebido, ou marcar para apoio manual.
  - ✅ "Tudo recebido ✓" quando completo; ou "apoio manual" assinalado.
- **F-06** (Consultor) Ver, por documento, o estado e abrir/descarregar o ficheiro.
  - ✅ Área de documentos com estado e vista integrada do WorkDrive ou ligação direta.

### Épico G — A0 Diagnóstico (inclui motor de pontuação)
- **G-01** (Consultor) Abrir um projeto e escolher o programa/medida.
  - ✅ Programa escolhido; checklist e regras associadas ao projeto.
- **G-02** (Sistema) Validar condições de acesso (licenciamentos, empresa recém-criada,
  exportação, NUEI).
  - ✅ Regras por medida correm; condições não cumpridas assinaladas como pontos de risco.
- **G-03** (Sistema) Cruzar a empresa com o Plano Anual de Avisos.
  - ✅ Avisos elegíveis listados (datas, dotação); empresa associada a uma medida.
- **G-04** (Sistema) Correr uma pontuação de elegibilidade (0–100%).
  - ✅ Calculada pela fórmula MP=0,2A+0,3B+0,1C+0,4D (com sub-critérios); pontos de risco
    listados; resultado em segundos.
- **G-05** (Consultor) Rever a pontuação e os pontos de risco e decidir avançar.
  - ✅ Pontuação indicativa; o consultor confirma/ajusta; decisão registada.
- **G-06** (Sistema) Gerar um relatório de elegibilidade como resultado formal.
  - ✅ Relatório com perfil, programa, pontuação, pontos de risco e recomendação; exportável.

> **Validação humana obrigatória:** a pontuação (G-04) é estimativa indicativa; o consultor
> valida sempre. A confiança da IA é exposta; o sistema nunca decide sozinho.

## 5. Taxonomia de documentos (recolha — Épico D)
Da Checklist oficial de Candidatura a Sistemas de Incentivos. Alguns itens só se aplicam a
programas específicos.
- Certidão Permanente — identificação e situação jurídica
- Certificado PME (IAPMEI) — validade limitada (alerta)
- Certidão de não dívida AT e Segurança Social — regularidade fiscal/contributiva
- RCBE — registo de beneficiário efetivo
- IES (3 anos) — demonstrações financeiras
- Modelo 22 + balancetes — suporte fiscal/contabilístico
- Mapa de depreciações / Anexo A e B Relatório Único — investimento e emprego
- Mapas da Segurança Social / listagem de pessoal — quadro de pessoal e ETI
- Mapa de vendas — vendas por mercado
- Intenções de investimento + orçamentos — base do PGI (designação, montante, fornecedor, calendário)
- Licenciamentos / financiamento — condições de acesso (específico por setor)
- Setor Turismo: memória, peças desenhadas, ofícios — apenas setores específicos

## 6. Dados/regras a ingerir (A0)
- Manual interno (aba Candidaturas) — condições de acesso por medida
- Plano Anual de Avisos (xlsx) + URL oficial — avisos abertos/previstos
- 6 grelhas de mérito PT2030 — critérios/pesos A/B/C/D + variantes regionais
- Checklist oficial — documentos por programa (também usada no Épico D)
- Candidaturas anonimizadas — calibração da pontuação

## 7. Integração CRM → plataforma (webhook · construído pela LOBA)
- **Disparo:** workflow no CRM quando o negócio muda para "Adjudicado".
- **Ação:** função Zoho faz POST ao endpoint da plataforma com token no cabeçalho.
- **Payload:** `crm_deal_id` (chave de idempotência), `empresa_nome`, `empresa_nif`,
  `programa`, `consultor`, `valor`, `datas`.
- **Idempotência:** reenvios do mesmo `crm_deal_id` não duplicam o projeto.
- **Fallback (Semana 1):** criação manual do projeto (B-02) — não bloqueia.

## 8. Convenções
- Nomes de ficheiros: `{Cliente}_{Programa}_{TipoDocumento}_{Data}`.
- Estados de projeto: A0, A1, A2, A3, A4, B0, B1, B2.
- Sem `localStorage`/`sessionStorage` no front-end — estado em base de dados.
- Tudo em PT-PT (comprovativo, não comprovante).