/**
 * Links de compartilhar e de mapa (puros, sem navegador).
 * - "Como chegar": busca do Google Maps com o local (o mapa escolhe o endereço).
 * - WhatsApp: wa.me com o texto pronto; com número, abre a conversa da pessoa.
 */

export function mapsSearchUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.trim())}`;
}

export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/**
 * Só dígitos e com DDI 55 quando faltar (telefone brasileiro com DDD: 10 ou 11 dígitos).
 * null quando não dá para montar um número (menos de 10 dígitos).
 */
export function whatsappPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (digits.length <= 11) return `55${digits}`;
  return digits;
}

export function whatsappChatUrl(phone: string): string | null {
  const number = whatsappPhone(phone);
  return number ? `https://wa.me/${number}` : null;
}
