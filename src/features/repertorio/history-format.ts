import type { ChangeType, VersionField } from '@/types/app.types';

export const FIELD_LABEL: Record<VersionField, string> = {
  lyrics: 'Letra',
  chords: 'Cifra',
  official_key: 'Tom oficial',
  metadata: 'Dados da música',
};

export const CHANGE_LABEL: Record<ChangeType, string> = {
  create: 'Cadastro',
  update: 'Alteração',
  restore: 'Restauração',
};

const METADATA_LABEL: Record<string, string> = {
  title: 'Título',
  artist: 'Autor',
  category: 'Categoria',
  original_key: 'Tom original',
  media_url: 'Link de mídia',
  notes: 'Observações',
};

/**
 * "Dados da música" ficam gravados como JSON. Devolve [rótulo, valor] na ordem dos campos,
 * ou null se o texto não for o JSON esperado (aí a tela mostra o texto cru).
 */
export function parseMetadata(value: string | null): [string, string][] | null {
  if (!value) return null;
  try {
    const data: unknown = JSON.parse(value);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const record = data as Record<string, unknown>;
    return Object.keys(METADATA_LABEL)
      .filter((key) => key in record)
      .map((key) => {
        const v = record[key];
        return [METADATA_LABEL[key] as string, v === null || v === '' ? '—' : String(v)];
      });
  } catch {
    return null;
  }
}

/** Só os campos de "Dados da música" que mudaram entre o valor anterior e o novo. */
export function changedMetadata(
  oldValue: string | null,
  newValue: string | null,
): { label: string; before: string; after: string }[] {
  const before = new Map(parseMetadata(oldValue) ?? []);
  const after = parseMetadata(newValue) ?? [];
  return after
    .filter(([label, value]) => before.get(label) !== value)
    .map(([label, value]) => ({ label, before: before.get(label) ?? '—', after: value }));
}

/** Resumo de uma linha: "D → E", "sem tom → G", "3 linhas → 4 linhas". */
export function summarizeChange(
  field: VersionField,
  oldValue: string | null,
  newValue: string | null,
): string {
  if (field === 'official_key') return `${oldValue || 'sem tom'} → ${newValue || 'sem tom'}`;
  if (field === 'metadata') {
    const changed = changedMetadata(oldValue, newValue).map((c) => c.label);
    if (oldValue === null) return 'Música cadastrada';
    return changed.length > 0 ? `Mudou: ${changed.join(', ')}` : 'Sem mudança visível';
  }
  const lines = (v: string | null) => (v?.trim() ? v.trim().split('\n').length : 0);
  const describe = (n: number) => (n === 0 ? 'vazia' : n === 1 ? '1 linha' : `${n} linhas`);
  if (oldValue === null) return `Criada com ${describe(lines(newValue))}`;
  return `${describe(lines(oldValue))} → ${describe(lines(newValue))}`;
}
