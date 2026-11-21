import { afterEach, beforeAll } from 'vitest';

// Testes de tela (happy-dom): espera mais pelas consultas (máquina ocupada no CI ou rodando a
// mutação) e desmonta o que foi renderizado entre um teste e outro.
beforeAll(async () => {
  if (typeof document === 'undefined') return;
  const { configure } = await import('@testing-library/react');
  configure({ asyncUtilTimeout: 5000 });
});

afterEach(async () => {
  if (typeof document === 'undefined') return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
});
