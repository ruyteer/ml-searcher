import "server-only";
import { Client } from "pg";

/// pg_try_advisory_lock/pg_advisory_unlock são locks DE SESSÃO, presos à
/// conexão física que os executou — não ao processo Node. O client do Prisma
/// (`src/lib/prisma.ts`) usa PrismaPg sobre um `pg.Pool`, e fora de uma
/// transação cada `$queryRaw` pode ser despachado numa conexão diferente do
/// pool. Se a aquisição e a liberação caírem em conexões distintas, o unlock
/// não libera nada (retorna `false` em silêncio) e o lock fica preso até o
/// pool reciclar aquela conexão — travando todo ciclo seguinte em
/// "already_running". Por isso este helper abre uma conexão dedicada, fora
/// do pool, e usa a MESMA conexão do connect() ao end().
///
/// Não usa `prisma.$transaction` para envolver `fn`: isso manteria uma
/// transação aberta durante chamadas HTTP externas e varreduras que podem
/// levar minutos, prendendo uma conexão do pool bem mais tempo do que o
/// necessário.
export async function withAdvisoryLock<T>(
  key: number,
  fallback: () => Promise<T>,
  fn: () => Promise<T>,
): Promise<T> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL não configurada");

  const client = new Client({ connectionString });
  await client.connect();
  try {
    const { rows } = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock($1) AS locked",
      [key],
    );
    if (!rows[0]?.locked) return await fallback();

    try {
      return await fn();
    } finally {
      // Mesmo cuidado do finally externo: se o unlock falhar (ex. rede caiu
      // durante o `fn`, que pode segurar esta conexão por minutos), não deixa
      // esse erro substituir uma exceção de `fn` que já esteja subindo.
      try {
        const { rows: unlockRows } = await client.query<{ unlocked: boolean }>(
          "SELECT pg_advisory_unlock($1) AS unlocked",
          [key],
        );
        if (!unlockRows[0]?.unlocked) {
          console.warn(`advisory-lock: pg_advisory_unlock(${key}) retornou false — lock pode ter ficado preso`);
        }
      } catch (err) {
        console.warn(`advisory-lock: erro ao rodar pg_advisory_unlock(${key})`, err);
      }
    }
  } finally {
    // Nunca deixa um erro ao encerrar a conexão mascarar a exceção original
    // do ciclo (de `fn` ou do próprio lock) que esteja subindo por este finally.
    try {
      await client.end();
    } catch (err) {
      console.warn("advisory-lock: erro ao encerrar conexão dedicada", err);
    }
  }
}
