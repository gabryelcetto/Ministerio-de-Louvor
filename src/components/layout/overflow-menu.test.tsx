// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pencil, Trash2 } from 'lucide-react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { OverflowMenu } from './overflow-menu';

function setup() {
  const edit = vi.fn();
  const remove = vi.fn();
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <p>fora</p>
      <OverflowMenu
        items={[
          { label: 'Editar', icon: Pencil, onSelect: edit },
          { label: 'Histórico', to: '/historico' },
          { label: 'Excluir', icon: Trash2, onSelect: remove, destructive: true },
        ]}
      />
    </MemoryRouter>,
  );
  return { edit, remove, user, button: screen.getByRole('button', { name: 'Mais opções' }) };
}

describe('menu ⋯', () => {
  it('abre, foca o primeiro item e executa a ação', async () => {
    const { edit, user, button } = setup();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    await user.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const items = screen.getAllByRole('menuitem');
    expect(items.map((i) => i.textContent)).toEqual(['Editar', 'Histórico', 'Excluir']);
    expect(document.activeElement).toBe(items[0]);
    await user.click(items[0]!);
    expect(edit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('teclado: setas (com volta), Home/End e Esc devolve o foco ao botão', async () => {
    const { user, button } = setup();
    await user.click(button);
    const items = screen.getAllByRole('menuitem');
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(items[1]);
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(document.activeElement).toBe(items[2]);
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(items[0]);
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(items[2]);
    await user.keyboard('{Enter}');
    await user.click(button);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(button);
    await user.click(button);
    await user.keyboard('{Tab}');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('clicar fora fecha; clicar no botão alterna; link fecha ao navegar', async () => {
    const { user, button } = setup();
    await user.click(button);
    fireEvent.pointerDown(screen.getByText('fora'));
    expect(screen.queryByRole('menu')).toBeNull();
    await user.click(button);
    await user.click(button);
    expect(screen.queryByRole('menu')).toBeNull();
    await user.click(button);
    fireEvent.pointerDown(screen.getByRole('menu'));
    expect(screen.getByRole('menu')).toBeTruthy();
    await user.click(screen.getByRole('menuitem', { name: 'Histórico' }));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('sem itens não mostra nada', () => {
    render(<OverflowMenu items={[]} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
