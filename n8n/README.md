# Workflows n8n

Exports JSON dos workflows n8n da Estrategor, versionados aqui. São construídos na
instância n8n existente (via SDK/MCP) e exportados para este diretório para revisão e
reposição.

Workflows previstos na Semana 1 (ver plano, secção 2.4):

1. **`recolha-form.json`** — Receção do formulário do cliente (D-03). Webhook → valida
   token → guarda ficheiros no WorkDrive (staging) → cria `documents` via callback da API →
   dispara a classificação.
2. **`classificacao-documentos.json`** — Pipeline de IA (Épico E). Claude API classifica,
   deteta multi-documento, divide PDFs, renomeia (`{Cliente}_{Programa}_{TipoDoc}_{Data}`),
   arquiva no WorkDrive e atualiza a checklist por callback.
3. **`lembretes-scheduler.json`** — Agendador de lembretes (Épico F). Cron → consulta a API
   pelos itens `EM_FALTA` → email (Gmail) com cadência crescente → escala ao consultor.
4. **`crm-webhook.json`** — (Fallback) Receção do webhook do CRM, idempotente por
   `crm_deal_id`.

> Os callbacks para a API usam o cabeçalho `Authorization: Bearer $N8N_CALLBACK_TOKEN`.
