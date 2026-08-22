-- Phrase.category (agrupador livre de tipo de copy) é substituído por um
-- vínculo opcional com Watch (categoria monitorada de produto). Não existe
-- correspondência automática entre os valores atuais de category
-- (abertura/urgência/cta/emoji/geral) e uma Watch real — são conceitos
-- diferentes (tipo de copy vs. categoria de produto) — então a coluna é
-- descartada e todas as frases existentes ficam com watchId NULL até serem
-- categorizadas manualmente no painel.
--
-- DESTRUTIVO: DROP COLUMN "category" em tabela com dados (26 linhas não
-- nulas no momento da geração desta migration). Não há caminho de rollback
-- que recupere esses valores — foi decidido deliberadamente pelo usuário
-- porque o campo antigo não tem correspondência semântica com o novo.

-- DropIndex
DROP INDEX "Phrase_category_active_idx";

-- AlterTable
ALTER TABLE "Phrase" DROP COLUMN "category",
ADD COLUMN     "watchId" TEXT;

-- CreateIndex
CREATE INDEX "Phrase_watchId_active_idx" ON "Phrase"("watchId", "active");

-- AddForeignKey
ALTER TABLE "Phrase" ADD CONSTRAINT "Phrase_watchId_fkey" FOREIGN KEY ("watchId") REFERENCES "Watch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
