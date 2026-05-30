import { mkdirSync, writeFileSync, renameSync, existsSync, copyFileSync, rmSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { env } from "../env.js";

/** Resultado da criação de uma pasta no WorkDrive. */
export interface CreatedFolder {
  workdriveId: string;
  workdriveUrl: string | null;
}

/** Resultado do upload de um ficheiro. */
export interface UploadedFile {
  workdriveId: string;
  workdriveUrl: string | null;
}

/** Item listado dentro de uma pasta do WorkDrive. */
export interface DriveItem {
  id: string;
  name: string;
  type: "folder" | "file";
  url: string | null;
}

/**
 * Adaptador do Zoho WorkDrive. Define a fronteira de integração para a criação
 * de pastas e listagem de conteúdo (TRNSF-936). Duas implementações:
 *  - `ZohoWorkDrive` — chamadas reais à API (quando há credenciais);
 *  - `StubWorkDrive` — IDs determinísticos, sem rede (dev/CI/demo).
 */
export interface WorkDriveAdapter {
  readonly mode: "real" | "stub";
  /** Cria uma pasta com `name` dentro de `parentId`; devolve o ID criado. */
  createFolder(parentId: string, name: string): Promise<CreatedFolder>;
  /** Lista o conteúdo de uma pasta. */
  listFolder(folderId: string): Promise<DriveItem[]>;
  /** Carrega um ficheiro para dentro de `parentId` com o nome `fileName`. */
  uploadFile(
    parentId: string,
    fileName: string,
    content: Buffer,
    mimeType: string,
  ): Promise<UploadedFile>;
  /** Move um ficheiro para outra pasta, renomeando (arquivo após validação — TRNSF-938). */
  moveFile(fileId: string, toParentId: string, newName: string): Promise<UploadedFile>;
  /** Descarrega o conteúdo de um ficheiro (para pré-visualização/validação). */
  downloadFile(fileId: string): Promise<Buffer>;
  /** ID da pasta-raiz onde as pastas de cliente/projecto são criadas. */
  rootFolderId(): string;
}

// ─── Stub determinístico ─────────────────────────────────────────────────
// Gera IDs estáveis a partir do par (parentId, name) para que reexecuções
// (idempotência) produzam o mesmo ID. Não há rede; o conteúdo "listado" vem
// da BD (folders), por isso listFolder devolve vazio aqui.
export class StubWorkDrive implements WorkDriveAdapter {
  readonly mode = "stub" as const;

  rootFolderId(): string {
    return env.WORKDRIVE_ROOT_FOLDER_ID ?? "stub-root";
  }

  async createFolder(parentId: string, name: string): Promise<CreatedFolder> {
    const slug = name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .toLowerCase();
    const id = `stub-${parentId}-${slug}`.slice(0, 120);
    return { workdriveId: id, workdriveUrl: null };
  }

  async listFolder(): Promise<DriveItem[]> {
    return [];
  }

  // Guarda o ficheiro no disco local do container (WORKDRIVE_STUB_DIR) para que
  // o ciclo upload→ver→descarregar funcione em dev/CI/demo sem Zoho.
  async uploadFile(
    parentId: string,
    fileName: string,
    content: Buffer,
  ): Promise<UploadedFile> {
    // id = caminho relativo (parentId/uniq-fileName) para que moveFile o localize.
    const uniq = `${randomBytes(4).toString("hex")}-${fileName}`;
    const relId = `${parentId}/${uniq}`;
    const dest = path.join(env.WORKDRIVE_STUB_DIR, relId);
    mkdirSync(path.dirname(dest), { recursive: true });
    writeFileSync(dest, content);
    return { workdriveId: relId, workdriveUrl: null };
  }

  async moveFile(fileId: string, toParentId: string, newName: string): Promise<UploadedFile> {
    const src = path.join(env.WORKDRIVE_STUB_DIR, fileId);
    const relId = `${toParentId}/${newName}`;
    const dest = path.join(env.WORKDRIVE_STUB_DIR, relId);
    mkdirSync(path.dirname(dest), { recursive: true });
    if (existsSync(src)) {
      try {
        renameSync(src, dest);
      } catch {
        copyFileSync(src, dest);
        rmSync(src, { force: true });
      }
    } else {
      // origem ausente (ex.: já movida) — cria um marcador vazio para idempotência
      writeFileSync(dest, Buffer.alloc(0));
    }
    return { workdriveId: relId, workdriveUrl: null };
  }

  async downloadFile(fileId: string): Promise<Buffer> {
    const p = path.join(env.WORKDRIVE_STUB_DIR, fileId);
    if (!existsSync(p)) throw new Error("FILE_NOT_FOUND");
    return readFileSync(p);
  }
}

// ─── Implementação real (Zoho WorkDrive) ─────────────────────────────────
// Cria pastas via POST /files (type=folder, parent_id) e lista via
// GET /files/{id}/files. Refresca o access token quando necessário.
export class ZohoWorkDrive implements WorkDriveAdapter {
  readonly mode = "real" as const;
  private accessToken: string | undefined;

  constructor() {
    this.accessToken = env.WORKDRIVE_ACCESS_TOKEN;
  }

  rootFolderId(): string {
    if (!env.WORKDRIVE_ROOT_FOLDER_ID) {
      throw new Error("WORKDRIVE_ROOT_FOLDER_ID não definido.");
    }
    return env.WORKDRIVE_ROOT_FOLDER_ID;
  }

  private async refreshAccessToken(): Promise<void> {
    if (!env.WORKDRIVE_REFRESH_TOKEN || !env.WORKDRIVE_CLIENT_ID || !env.WORKDRIVE_CLIENT_SECRET) {
      throw new Error("Credenciais Zoho insuficientes para refresh do token.");
    }
    const params = new URLSearchParams({
      refresh_token: env.WORKDRIVE_REFRESH_TOKEN,
      client_id: env.WORKDRIVE_CLIENT_ID,
      client_secret: env.WORKDRIVE_CLIENT_SECRET,
      grant_type: "refresh_token",
    });
    const res = await fetch(`${env.WORKDRIVE_OAUTH_BASE}/oauth/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    if (!res.ok) throw new Error(`Falha no refresh do token Zoho (${res.status}).`);
    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) throw new Error("Resposta de token Zoho sem access_token.");
    this.accessToken = data.access_token;
  }

  private async authedFetch(path: string, init: RequestInit, retry = true): Promise<Response> {
    if (!this.accessToken) await this.refreshAccessToken();
    const res = await fetch(`${env.WORKDRIVE_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Zoho-oauthtoken ${this.accessToken}`,
        Accept: "application/vnd.api+json",
        ...(init.headers ?? {}),
      },
    });
    // token expirado → refresca uma vez e repete
    if (res.status === 401 && retry) {
      await this.refreshAccessToken();
      return this.authedFetch(path, init, false);
    }
    return res;
  }

  async createFolder(parentId: string, name: string): Promise<CreatedFolder> {
    const body = {
      data: { attributes: { name, parent_id: parentId }, type: "files" },
    };
    const res = await this.authedFetch("/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`WorkDrive: criar pasta "${name}" falhou (${res.status}): ${text}`);
    }
    const json = (await res.json()) as {
      data?: { id?: string; attributes?: { permalink?: string } };
    };
    const id = json.data?.id;
    if (!id) throw new Error(`WorkDrive: resposta sem id ao criar "${name}".`);
    return { workdriveId: id, workdriveUrl: json.data?.attributes?.permalink ?? null };
  }

  async listFolder(folderId: string): Promise<DriveItem[]> {
    const res = await this.authedFetch(`/files/${folderId}/files`, { method: "GET" });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`WorkDrive: listar pasta ${folderId} falhou (${res.status}): ${text}`);
    }
    const json = (await res.json()) as {
      data?: { id: string; attributes?: { name?: string; is_folder?: boolean; permalink?: string } }[];
    };
    return (json.data ?? []).map((it) => ({
      id: it.id,
      name: it.attributes?.name ?? "(sem nome)",
      type: it.attributes?.is_folder ? "folder" : "file",
      url: it.attributes?.permalink ?? null,
    }));
  }

  async uploadFile(
    parentId: string,
    fileName: string,
    content: Buffer,
    mimeType: string,
  ): Promise<UploadedFile> {
    // Upload via multipart para POST /upload (parent_id + content).
    const form = new FormData();
    form.append("parent_id", parentId);
    form.append("filename", fileName);
    form.append(
      "content",
      new Blob([content], { type: mimeType || "application/octet-stream" }),
      fileName,
    );
    const res = await this.authedFetch("/upload", { method: "POST", body: form });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`WorkDrive: upload "${fileName}" falhou (${res.status}): ${text}`);
    }
    const json = (await res.json()) as {
      data?: { attributes?: { resource_id?: string; permalink?: string } }[];
    };
    const attr = json.data?.[0]?.attributes;
    const id = attr?.resource_id;
    if (!id) throw new Error(`WorkDrive: resposta sem resource_id ao carregar "${fileName}".`);
    return { workdriveId: id, workdriveUrl: attr?.permalink ?? null };
  }

  async moveFile(fileId: string, toParentId: string, newName: string): Promise<UploadedFile> {
    // renomeia
    const renameRes = await this.authedFetch(`/files/${fileId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: { attributes: { name: newName }, type: "files" } }),
    });
    if (!renameRes.ok) throw new Error(`WorkDrive: renomear ${fileId} falhou (${renameRes.status})`);
    // move para a pasta-alvo
    const moveRes = await this.authedFetch(`/files/${fileId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: { attributes: { parent_id: toParentId }, type: "files" } }),
    });
    if (!moveRes.ok) throw new Error(`WorkDrive: mover ${fileId} falhou (${moveRes.status})`);
    const json = (await moveRes.json()) as { data?: { attributes?: { permalink?: string } } };
    return { workdriveId: fileId, workdriveUrl: json.data?.attributes?.permalink ?? null };
  }

  async downloadFile(fileId: string): Promise<Buffer> {
    const res = await this.authedFetch(`/download/${fileId}`, { method: "GET" });
    if (!res.ok) throw new Error(`WorkDrive: download ${fileId} falhou (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }
}

/** Devolve o adaptador adequado ao ambiente (real se houver credenciais). */
export function getWorkDrive(): WorkDriveAdapter {
  const hasCreds =
    Boolean(env.WORKDRIVE_ACCESS_TOKEN) ||
    Boolean(env.WORKDRIVE_REFRESH_TOKEN && env.WORKDRIVE_CLIENT_ID && env.WORKDRIVE_CLIENT_SECRET);
  return hasCreds && env.WORKDRIVE_ROOT_FOLDER_ID ? new ZohoWorkDrive() : new StubWorkDrive();
}
