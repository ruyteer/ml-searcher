// Gera os ícones do app (PWA + iOS) a partir de um único desenho vetorial.
//
// Rode com `npm run icones` sempre que a marca mudar. Os PNG ficam
// versionados em public/icons, então o build normal não depende do sharp.
//
// O desenho: fundo escuro (mesmo tom do tema) com o raio da marca em
// amarelo, no espírito do IconMarca usado na sidebar.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DESTINO = path.join(RAIZ, "public", "icons");

// Tema escuro do painel: --background e --primary de src/app/globals.css,
// convertidos para hexadecimal (o renderizador de SVG não entende oklch).
const FUNDO = "#131317";
const AMARELO = "#f6c400";

// Raio desenhado numa caixa 24x24, para poder escalar sem redesenhar.
const RAIO = "M14.5 2 L5 13.5 H10.5 L9.5 22 L19 10.5 H13.5 Z";
const RAIO_CAIXA = 24;

/**
 * Monta o SVG do ícone.
 *
 * @param {object} opcoes
 * @param {number} opcoes.lado        Lado do quadrado, em pixels.
 * @param {number} opcoes.ocupacao    Fração do lado ocupada pela altura do raio.
 * @param {number} opcoes.arredondado Raio do canto, como fração do lado. 0 = quadrado cheio.
 */
function montarSvg({ lado, ocupacao, arredondado }) {
  const escala = (lado * ocupacao) / RAIO_CAIXA;
  const deslocamento = (lado - RAIO_CAIXA * escala) / 2;
  const canto = lado * arredondado;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 ${lado} ${lado}">
  <rect width="${lado}" height="${lado}" rx="${canto}" ry="${canto}" fill="${FUNDO}"/>
  <g transform="translate(${deslocamento} ${deslocamento}) scale(${escala})">
    <path d="${RAIO}" fill="${AMARELO}"/>
  </g>
</svg>`;
}

// O ícone "any" pode ter canto arredondado: o sistema mostra ele como está.
const QUALQUER = { ocupacao: 0.58, arredondado: 0.2 };
// O "maskable" é recortado pelo sistema, então o fundo vai até a borda e o
// símbolo fica dentro da zona segura (círculo central de 80% do lado).
const MASCARAVEL = { ocupacao: 0.42, arredondado: 0 };
// O iOS aplica a própria máscara de canto, então entregamos quadrado cheio.
const APPLE = { ocupacao: 0.52, arredondado: 0 };

const ARQUIVOS = [
  { nome: "icons/icone-192.png", lado: 192, ...QUALQUER },
  { nome: "icons/icone-512.png", lado: 512, ...QUALQUER },
  { nome: "icons/icone-maskable-192.png", lado: 192, ...MASCARAVEL },
  { nome: "icons/icone-maskable-512.png", lado: 512, ...MASCARAVEL },
  { nome: "apple-touch-icon.png", lado: 180, ...APPLE },
];

await mkdir(DESTINO, { recursive: true });

// Versão vetorial, servida no manifesto como ícone escalável.
await writeFile(
  path.join(DESTINO, "icone.svg"),
  `${montarSvg({ lado: 512, ...QUALQUER })}\n`,
  "utf8"
);

for (const { nome, lado, ocupacao, arredondado } of ARQUIVOS) {
  const svg = montarSvg({ lado, ocupacao, arredondado });
  const saida = path.join(RAIZ, "public", nome);
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(saida);
  console.log(`ok ${nome} (${lado}x${lado})`);
}

console.log("ok icons/icone.svg");
