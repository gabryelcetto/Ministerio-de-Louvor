import { useId } from 'react';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { allKeys } from '@/lib/chords';
import type { SongDataValues } from '../song-data';

export const selectClass =
  'h-11 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Opções de tom (maiores e menores) para um <select>. */
export function KeyOptions() {
  return (
    <>
      <optgroup label="Maiores">
        {allKeys(false).map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </optgroup>
      <optgroup label="Menores">
        {allKeys(true).map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </optgroup>
    </>
  );
}

/** Campos de dados da música (cadastrar e "Editar dados"). */
export function SongDataFields({
  register,
  errors,
  categories,
  keyHint,
}: {
  register: UseFormRegister<SongDataValues>;
  errors: FieldErrors<SongDataValues>;
  categories: string[];
  /** Texto abaixo do tom original (ex.: tom detectado na cifra). */
  keyHint?: React.ReactNode;
}) {
  const id = useId();
  const field = (name: keyof SongDataValues) => ({
    id: `${id}-${name}`,
    'aria-invalid': Boolean(errors[name]),
    'aria-describedby': errors[name] ? `${id}-${name}-erro` : undefined,
  });
  const error = (name: keyof SongDataValues) =>
    errors[name]?.message ? (
      <p id={`${id}-${name}-erro`} className="text-sm text-destructive">
        {errors[name]?.message}
      </p>
    ) : null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor={`${id}-title`}>Título</Label>
        <Input {...field('title')} className="h-11 text-base" {...register('title')} />
        {error('title')}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-artist`}>Artista / autor (opcional)</Label>
        <Input {...field('artist')} className="h-11 text-base" {...register('artist')} />
        {error('artist')}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-category`}>Categoria (opcional)</Label>
        <Input
          {...field('category')}
          list={`${id}-categorias`}
          placeholder="Ex.: Louvor, Adoração, Hino"
          className="h-11 text-base"
          {...register('category')}
        />
        <datalist id={`${id}-categorias`}>
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        {error('category')}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-originalKey`}>Tom original (opcional)</Label>
        <select {...field('originalKey')} className={selectClass} {...register('originalKey')}>
          <option value="">Não sei</option>
          <KeyOptions />
        </select>
        {keyHint}
        {error('originalKey')}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-mediaUrl`}>Link de áudio/vídeo (opcional)</Label>
        <Input
          {...field('mediaUrl')}
          type="url"
          inputMode="url"
          placeholder="https://…"
          className="h-11 text-base"
          {...register('mediaUrl')}
        />
        {error('mediaUrl')}
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor={`${id}-notes`}>Observações (opcional)</Label>
        <Textarea {...field('notes')} rows={3} className="text-base" {...register('notes')} />
        {error('notes')}
      </div>
    </div>
  );
}
