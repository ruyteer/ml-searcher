-- Filtro por palavras: coluna materializada com a decisão "este produto está
-- escondido pelas palavras que o usuário configurou". As telas filtram por este
-- booleano indexado em vez de rodar expressão regular sobre o título a cada
-- consulta; ele é recalculado de uma vez quando a lista de palavras muda.
--
-- Nada é apagado por causa dela: tirar a palavra recalcula a coluna e os
-- produtos voltam a aparecer.
--
-- Escrita de forma idempotente porque a coluna já pode existir no banco.

-- AlterTable
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "hiddenByWords" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Product_hiddenByWords_idx" ON "Product"("hiddenByWords");
