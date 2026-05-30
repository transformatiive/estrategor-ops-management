import { hash, verify } from "@node-rs/argon2";

// Parâmetros Argon2id (defaults robustos do @node-rs/argon2).
const OPTS = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

/** Gera o hash de uma palavra-passe (Argon2id). Nunca guardar texto simples. */
export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTS);
}

/** Compara uma palavra-passe com o hash guardado. */
export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  try {
    return await verify(hashed, plain);
  } catch {
    return false;
  }
}
