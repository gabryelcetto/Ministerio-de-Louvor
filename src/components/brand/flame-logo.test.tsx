import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FlameLogo } from './flame-logo';

describe('FlameLogo', () => {
  it('decorativa por padrão, só a chama, com as cores dos tokens', () => {
    const html = renderToStaticMarkup(<FlameLogo />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('<rect');
    expect(html).toContain('fill="var(--ds-flame)"');
    expect(html).toContain('fill="var(--ds-flame-core)"');
  });

  it('com quadrado do ícone e nome acessível', () => {
    const html = renderToStaticMarkup(<FlameLogo tile label="Louvor ADVOP" className="size-14" />);
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Louvor ADVOP"');
    expect(html).toContain('fill="var(--ds-flame-tile)"');
    expect(html).toContain('translate(12 12) scale(0.8)');
    expect(html).toContain('size-14');
  });
});
