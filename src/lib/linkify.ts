/**
 * Texto com links clicáveis SEM HTML vindo do banco: o texto é quebrado em pedaços ("texto" e
 * "link") e a tela monta os elementos. Só http(s):// e www. viram link; pontuação no fim fica
 * fora do endereço ("veja https://x.com." → link "https://x.com").
 */
export type TextPart =
  { kind: 'text'; text: string } | { kind: 'link'; text: string; href: string };

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const TRAILING = /[.,;:!?)\]}'"»]+$/;

export function linkify(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index;
    let url = match[0];
    const trailing = TRAILING.exec(url)?.[0] ?? '';
    // Parêntese que abriu dentro do link (ex.: wikipedia) fica no link.
    const keep = trailing.startsWith(')') && url.includes('(') ? ')' : '';
    url = url.slice(0, url.length - trailing.length) + keep;
    if (start > last) parts.push({ kind: 'text', text: text.slice(last, start) });
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    parts.push({ kind: 'link', text: url, href });
    last = start + url.length;
  }
  if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) });
  return parts;
}
