import { Download, Share2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { audioDownloadName } from '@/lib/audio/format';
import { copyText, shareFile } from '@/lib/browser-share';
import { downloadUrl, type MediaItem, type MediaKind } from '../api';

/**
 * "Baixar" (link assinado com nome legível) e "Compartilhar" (arquivo pelo menu do celular,
 * quando ele aceita; senão copia o link assinado, que vale por 1 hora).
 */
export function AudioFileActions({
  item,
  kind,
  position,
  prefix,
  title,
}: {
  item: MediaItem;
  kind: MediaKind;
  position: number;
  /** "Ensaio 26-11" ou o título da música. */
  prefix: string;
  /** Nome mostrado na lista (para os rótulos acessíveis). */
  title: string;
}) {
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const fileName = audioDownloadName({
    prefix,
    label: item.label,
    position,
    mimeType: item.mimeType,
    fallback: kind === 'rehearsal' ? 'Parte' : 'Áudio',
  });

  const download = async () => {
    setNotice('');
    try {
      const url = await downloadUrl(item.storagePath, fileName);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      setNotice('Não foi possível baixar. Tente de novo.');
    }
  };

  const share = async () => {
    setNotice('');
    setBusy(true);
    try {
      // 1) Arquivo pelo menu do celular, quando o aparelho aceita.
      if (item.url && typeof navigator !== 'undefined' && 'canShare' in navigator) {
        try {
          const blob = await (await fetch(item.url)).blob();
          const file = new File([blob], fileName, { type: item.mimeType });
          const shared = await shareFile(file, title);
          if (shared) return;
        } catch {
          // segue para o link
        }
      }
      // 2) Link assinado copiado (vale por 1 hora).
      const url = await downloadUrl(item.storagePath, fileName);
      setNotice(
        (await copyText(url))
          ? 'Link copiado. Ele vale por 1 hora.'
          : 'Não foi possível compartilhar neste aparelho.',
      );
    } catch {
      setNotice('Não foi possível compartilhar. Tente de novo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="flex flex-wrap gap-1">
        <Button type="button" variant="ghost" size="sm" onClick={() => void download()}>
          <Download aria-hidden="true" />
          Baixar
          <span className="sr-only">: {title}</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => void share()}
        >
          <Share2 aria-hidden="true" />
          Compartilhar
          <span className="sr-only">: {title}</span>
        </Button>
      </span>
      <p role="status" aria-live="polite" className="text-caption text-brand-text empty:hidden">
        {notice}
      </p>
    </div>
  );
}
