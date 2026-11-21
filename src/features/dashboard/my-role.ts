/**
 * "Você toca bateria", "Você canta (backing vocal)" — a frase do card "Sua próxima escala",
 * montada a partir das funções da pessoa no evento e do grupo de cada função
 * (ministry_functions.section: vocal = canta, instrumental = toca).
 */
export interface RoleFunction {
  name: string;
  /** Grupo da função; desconhecido quando não deu para descobrir. */
  section: 'vocal' | 'instrumental' | null;
}

/** Funções que não são instrumento nem voz (técnica): "Você fica no som". */
const NOT_AN_INSTRUMENT = /\b(som|mesa|proje[çc][ãa]o|m[íi]dia|t[ée]cnic|transmiss[ãa]o|luz)/i;

function joinPt(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} e ${parts.at(-1)}`;
}

export function describeMyRole(functions: readonly RoleFunction[]): string {
  if (functions.length === 0) return 'Você está na escala';
  const sing = functions.filter((f) => f.section === 'vocal').map((f) => f.name.toLowerCase());
  const play = functions
    .filter((f) => f.section === 'instrumental' && !NOT_AN_INSTRUMENT.test(f.name))
    .map((f) => f.name.toLowerCase());
  const other = functions
    .filter(
      (f) => f.section === null || (f.section === 'instrumental' && NOT_AN_INSTRUMENT.test(f.name)),
    )
    .map((f) => f.name.toLowerCase());

  const pieces: string[] = [];
  if (sing.length) pieces.push(`canta (${joinPt(sing)})`);
  if (play.length) pieces.push(`toca ${joinPt(play)}`);
  if (other.length) pieces.push(`fica em ${joinPt(other)}`);
  return `Você ${joinPt(pieces)}`;
}
