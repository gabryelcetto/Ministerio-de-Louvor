/** Tela provisória: as telas de leitura chegam na fase E. */
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-muted-foreground">Esta tela será construída na próxima fase.</p>
    </section>
  );
}
