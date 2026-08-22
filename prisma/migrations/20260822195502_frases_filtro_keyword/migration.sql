-- Coluna nova aditiva, com default "" — não afeta nenhuma linha existente
-- (as frases atuais ganham keywords = "", o mesmo comportamento de hoje:
-- elegíveis pra qualquer produto da categoria, sem filtro extra). Formato
-- de texto cru, mesma convenção de Setting.filterExcludeWords
-- (parseWordList/formatWordList). Não é destrutiva.

-- AlterTable
ALTER TABLE "Phrase" ADD COLUMN     "keywords" TEXT NOT NULL DEFAULT '';
