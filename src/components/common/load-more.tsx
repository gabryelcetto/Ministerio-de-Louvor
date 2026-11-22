import { Button } from '@/components/ui/button';

/** Botão "Carregar mais" das listas longas (some quando acabou). */
export function LoadMore({
  hasMore,
  loading,
  onLoad,
  error,
}: {
  hasMore: boolean;
  loading: boolean;
  onLoad: () => void;
  error?: boolean;
}) {
  if (!hasMore) return null;
  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <Button type="button" variant="outline" disabled={loading} onClick={onLoad}>
        {loading ? 'Carregando…' : 'Carregar mais'}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar mais. Tente de novo.
        </p>
      )}
    </div>
  );
}
