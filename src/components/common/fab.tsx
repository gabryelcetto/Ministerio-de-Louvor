import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';

/** Botão flutuante (ação principal da tela), acima da barra de baixo no celular. */
export function Fab({ to, label, icon: Icon }: { to: string; label: string; icon: LucideIcon }) {
  return (
    <Button
      asChild
      size="lg"
      className="fixed right-4 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-30 rounded-full px-5 shadow-lg md:right-8 md:bottom-8"
    >
      <Link to={to}>
        <Icon aria-hidden="true" />
        {label}
      </Link>
    </Button>
  );
}
