"use client";

import { useQueryState } from "nuqs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface FrasesTabsProps {
  frasesSlot: React.ReactNode;
  templatesSlot: React.ReactNode;
}

/// Duas abas com estado sincronizado na URL (?aba=frases|templates), pra dar
/// pra compartilhar/voltar direto numa aba específica.
export function FrasesTabs({ frasesSlot, templatesSlot }: FrasesTabsProps) {
  const [aba, setAba] = useQueryState("aba", { defaultValue: "frases" });

  return (
    <Tabs value={aba} onValueChange={(value) => setAba(String(value))}>
      <TabsList>
        <TabsTrigger value="frases">Frases</TabsTrigger>
        <TabsTrigger value="templates">Templates de mensagem</TabsTrigger>
      </TabsList>
      <TabsContent value="frases" className="mt-4">
        {frasesSlot}
      </TabsContent>
      <TabsContent value="templates" className="mt-4">
        {templatesSlot}
      </TabsContent>
    </Tabs>
  );
}
