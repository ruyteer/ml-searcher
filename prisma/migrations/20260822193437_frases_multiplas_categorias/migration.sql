-- Phrase.watchId (FK escalar, uma frase pertence a NO MÁXIMO uma Watch) vira
-- uma tabela de junção N:N (PhraseWatch): agora uma frase pode pertencer a
-- VÁRIAS categorias monitoradas ao mesmo tempo. Os vínculos já existentes
-- (Phrase.watchId não nulo) são preservados via INSERT...SELECT para
-- "PhraseWatch" ANTES do DROP COLUMN — nenhum vínculo cadastrado hoje se
-- perde nessa migração.
--
-- DESTRUTIVO (parcialmente): DROP COLUMN "watchId" em tabela com dados (2
-- linhas não nulas no momento da geração desta migration, de 27 frases no
-- total). Diferente da migration anterior (20260822152316), aqui o dado NÃO
-- se perde — ele é migrado 1:1 para a nova tabela "PhraseWatch" no mesmo
-- passo, e o rollback é reconstruir a coluna e copiar de volta
-- (`UPDATE "Phrase" SET "watchId" = pw."watchId" FROM "PhraseWatch" pw
-- WHERE pw."phraseId" = "Phrase"."id"`, válido só enquanto nenhuma frase
-- tiver mais de um vínculo, que é a premissa de watchId ser escalar). Mesmo
-- assim o DROP COLUMN em si é irreversível sem esse passo manual, por isso
-- o aviso.

-- CreateTable
CREATE TABLE "PhraseWatch" (
    "phraseId" TEXT NOT NULL,
    "watchId" TEXT NOT NULL,

    CONSTRAINT "PhraseWatch_pkey" PRIMARY KEY ("phraseId","watchId")
);

-- CreateIndex
CREATE INDEX "PhraseWatch_watchId_idx" ON "PhraseWatch"("watchId");

-- AddForeignKey
ALTER TABLE "PhraseWatch" ADD CONSTRAINT "PhraseWatch_phraseId_fkey" FOREIGN KEY ("phraseId") REFERENCES "Phrase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhraseWatch" ADD CONSTRAINT "PhraseWatch_watchId_fkey" FOREIGN KEY ("watchId") REFERENCES "Watch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: preserva todo vínculo watchId -> Watch que já existia antes de
-- apagar a coluna.
INSERT INTO "PhraseWatch" ("phraseId", "watchId")
  SELECT "id", "watchId" FROM "Phrase" WHERE "watchId" IS NOT NULL;

-- DropIndex
DROP INDEX "Phrase_watchId_active_idx";

-- DropForeignKey
ALTER TABLE "Phrase" DROP CONSTRAINT "Phrase_watchId_fkey";

-- AlterTable
ALTER TABLE "Phrase" DROP COLUMN "watchId";

-- CreateIndex
CREATE INDEX "Phrase_active_idx" ON "Phrase"("active");
