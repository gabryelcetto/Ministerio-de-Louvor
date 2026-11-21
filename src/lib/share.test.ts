import { describe, expect, it } from 'vitest';
import { mapsSearchUrl, whatsappChatUrl, whatsappPhone, whatsappShareUrl } from './share';

describe('links de mapa e WhatsApp', () => {
  it('"Como chegar" codifica o local', () => {
    expect(mapsSearchUrl(' Rua A, 10 & fundos ')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Rua%20A%2C%2010%20%26%20fundos',
    );
  });

  it('texto pronto para o WhatsApp', () => {
    expect(whatsappShareUrl('Culto\nDomingo 19h')).toBe(
      'https://wa.me/?text=Culto%0ADomingo%2019h',
    );
  });

  it('telefone: só dígitos e DDI 55 quando faltar', () => {
    expect(whatsappPhone('(11) 98765-4321')).toBe('5511987654321');
    expect(whatsappPhone('11 3456-7890')).toBe('551134567890');
    expect(whatsappPhone('+55 11 98765-4321')).toBe('5511987654321');
    // 12 ou mais dígitos: já tem DDI.
    expect(whatsappPhone('+351 912 345 678')).toBe('351912345678');
    expect(whatsappPhone('1234')).toBeNull();
    expect(whatsappChatUrl('(00) 90000-0001')).toBe('https://wa.me/5500900000001');
    expect(whatsappChatUrl('abc')).toBeNull();
  });
});
