"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/*
  PÁGINA TEMPORÁRIA DE MEDIÇÃO DE TELA.

  Existe só para ler, no aparelho de verdade, os valores que decidem o
  encaixe do painel no iPhone: os recortes do aparelho, as três medidas de
  altura de tela e o modo em que o app foi aberto. Some assim que o ajuste
  estiver confirmado. Ela é liberada sem sessão em src/proxy.ts, e a linha de
  lá sai junto com esta pasta.
*/

interface Medida {
  rotulo: string;
  valor: string;
}

/// Lê uma medida de comprimento aplicando o valor num elemento de teste e
/// perguntando ao navegador quanto deu em pixels.
function medirAltura(elemento: HTMLElement | null): string {
  if (!elemento) return "sem leitura";
  return `${elemento.getBoundingClientRect().height.toFixed(1)} px`;
}

function modoDeExibicao(): string {
  if (typeof window === "undefined") return "sem leitura";
  const modos = ["standalone", "fullscreen", "minimal-ui", "browser"];
  const encontrados = modos.filter((modo) => window.matchMedia(`(display-mode: ${modo})`).matches);
  const legado = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  const extra = legado === true ? " (aberto pela tela de início)" : "";
  return encontrados.length > 0 ? `${encontrados.join(", ")}${extra}` : `nenhum${extra}`;
}

export default function DiagnosticoTelaPage() {
  const refVh = useRef<HTMLDivElement>(null);
  const refSvh = useRef<HTMLDivElement>(null);
  const refDvh = useRef<HTMLDivElement>(null);
  const refLvh = useRef<HTMLDivElement>(null);
  const refCima = useRef<HTMLDivElement>(null);
  const refBaixo = useRef<HTMLDivElement>(null);
  const refEsq = useRef<HTMLDivElement>(null);
  const refDir = useRef<HTMLDivElement>(null);

  const [medidas, setMedidas] = useState<Medida[]>([]);
  const [copiado, setCopiado] = useState(false);

  const ler = useCallback(() => {
    const raiz = getComputedStyle(document.documentElement);
    const variavel = (nome: string) => {
      const bruto = raiz.getPropertyValue(nome).trim();
      return bruto === "" ? "vazio" : bruto;
    };

    const vv = window.visualViewport;

    setMedidas([
      { rotulo: "Modo em que abriu", valor: modoDeExibicao() },
      { rotulo: "Recorte de cima medido", valor: medirAltura(refCima.current) },
      { rotulo: "Recorte de baixo medido", valor: medirAltura(refBaixo.current) },
      { rotulo: "Recorte da esquerda medido", valor: medirAltura(refEsq.current) },
      { rotulo: "Recorte da direita medido", valor: medirAltura(refDir.current) },
      { rotulo: "Variável do recorte de cima", valor: variavel("--area-segura-cima") },
      { rotulo: "Variável do recorte de baixo", valor: variavel("--area-segura-baixo") },
      { rotulo: "Variável do recorte da esquerda", valor: variavel("--area-segura-esq") },
      { rotulo: "Variável do recorte da direita", valor: variavel("--area-segura-dir") },
      { rotulo: "Recuo da barra de baixo", valor: variavel("--recuo-barra-inferior") },
      { rotulo: "Altura da linha de ícones", valor: variavel("--altura-barra-inferior") },
      { rotulo: "Altura total da barra de baixo", valor: variavel("--altura-barra-inferior-total") },
      { rotulo: "Altura da janela", valor: `${window.innerHeight} px` },
      { rotulo: "Largura da janela", valor: `${window.innerWidth} px` },
      { rotulo: "Altura da área visível", valor: vv ? `${vv.height.toFixed(1)} px` : "sem leitura" },
      {
        rotulo: "Deslocamento da área visível",
        valor: vv ? `${vv.offsetTop.toFixed(1)} px` : "sem leitura",
      },
      { rotulo: "Altura de tela cheia (100vh)", valor: medirAltura(refVh.current) },
      { rotulo: "Altura menor garantida (100svh)", valor: medirAltura(refSvh.current) },
      { rotulo: "Altura maior possível (100lvh)", valor: medirAltura(refLvh.current) },
      { rotulo: "Altura do momento (100dvh)", valor: medirAltura(refDvh.current) },
      { rotulo: "Altura da tela do aparelho", valor: `${window.screen.height} px` },
      { rotulo: "Pontos por pixel", valor: String(window.devicePixelRatio) },
      { rotulo: "Aparelho", valor: navigator.userAgent },
    ]);
  }, []);

  useEffect(() => {
    ler();
    const aoMudar = () => ler();
    window.addEventListener("resize", aoMudar);
    window.addEventListener("orientationchange", aoMudar);
    window.addEventListener("scroll", aoMudar, { passive: true });
    window.visualViewport?.addEventListener("resize", aoMudar);
    window.visualViewport?.addEventListener("scroll", aoMudar);
    return () => {
      window.removeEventListener("resize", aoMudar);
      window.removeEventListener("orientationchange", aoMudar);
      window.removeEventListener("scroll", aoMudar);
      window.visualViewport?.removeEventListener("resize", aoMudar);
      window.visualViewport?.removeEventListener("scroll", aoMudar);
    };
  }, [ler]);

  const copiar = useCallback(async () => {
    const texto = medidas.map((m) => `${m.rotulo}: ${m.valor}`).join("\n");
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }, [medidas]);

  return (
    <div className="min-h-svh bg-background text-foreground">
      {/* Faixas de teste: a altura de cada uma é o valor do recorte. */}
      <div
        ref={refCima}
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-40 bg-primary/25"
        style={{ height: "env(safe-area-inset-top, 0px)" }}
      />
      <div
        ref={refBaixo}
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 bg-primary/25"
        style={{ height: "env(safe-area-inset-bottom, 0px)" }}
      />
      <div
        ref={refEsq}
        aria-hidden="true"
        className="pointer-events-none fixed top-0 bottom-0 left-0 z-40 bg-primary/15"
        style={{ width: "env(safe-area-inset-left, 0px)" }}
      />
      <div
        ref={refDir}
        aria-hidden="true"
        className="pointer-events-none fixed top-0 right-0 bottom-0 z-40 bg-primary/15"
        style={{ width: "env(safe-area-inset-right, 0px)" }}
      />

      {/* Réguas de altura, fora da vista, só para serem medidas. */}
      <div aria-hidden="true" className="pointer-events-none invisible absolute top-0 left-0 w-px">
        <div ref={refVh} style={{ height: "100vh" }} />
        <div ref={refSvh} style={{ height: "100svh" }} />
        <div ref={refLvh} style={{ height: "100lvh" }} />
        <div ref={refDvh} style={{ height: "100dvh" }} />
      </div>

      <div
        className="mx-auto flex max-w-xl flex-col gap-4 p-4"
        style={{
          paddingTop: "calc(1rem + var(--area-segura-cima))",
          paddingBottom: "calc(1rem + var(--area-segura-baixo))",
          paddingLeft: "max(1rem, var(--area-segura-esq))",
          paddingRight: "max(1rem, var(--area-segura-dir))",
        }}
      >
        <header className="flex flex-col gap-1">
          <h1 className="font-heading text-lg font-semibold">Medidas da tela</h1>
          <p className="text-sm text-muted-foreground">
            Esta tela é temporária. Tire um print ou toque em copiar e mande o resultado. As faixas
            amarelas mostram onde ficam os recortes do aparelho.
          </p>
        </header>

        <button
          type="button"
          onClick={copiar}
          className="min-h-11 rounded-lg bg-primary px-4 font-medium text-primary-foreground"
        >
          {copiado ? "Copiado" : "Copiar as medidas"}
        </button>

        <dl className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {medidas.map((m) => (
            <div key={m.rotulo} className="flex flex-col gap-0.5 px-3 py-2">
              <dt className="text-xs text-muted-foreground">{m.rotulo}</dt>
              <dd className="font-mono text-sm break-all text-foreground">{m.valor}</dd>
            </div>
          ))}
        </dl>

        <p className="text-xs text-muted-foreground">
          Se estiver vendo isto pelo navegador, e não pelo app instalado, os recortes de cima
          costumam sair zerados. O teste que vale é abrir pelo ícone da tela de início.
        </p>
      </div>
    </div>
  );
}
