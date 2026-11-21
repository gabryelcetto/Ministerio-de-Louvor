// Áudio FICTÍCIO para os testes: um tom senoidal gerado aqui mesmo (nada de música real).
// WAV PCM 16 bits mono. 8 kHz deixa o arquivo pequeno; dá para pedir um tamanho mínimo para
// testar o limite de 45 MB.

/** @param {{ seconds?: number, hz?: number, sampleRate?: number, minBytes?: number }} options */
export function makeWav({ seconds = 3, hz = 440, sampleRate = 8000, minBytes = 0 } = {}) {
  let samples = Math.round(seconds * sampleRate);
  const neededForMin = Math.ceil(Math.max(0, minBytes - 44) / 2);
  samples = Math.max(samples, neededForMin);
  const dataBytes = samples * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16); // tamanho do bloco fmt
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // bytes por segundo
  buf.writeUInt16LE(2, 32); // bytes por amostra
  buf.writeUInt16LE(16, 34); // bits
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < samples; i++) {
    const v = Math.round(Math.sin((2 * Math.PI * hz * i) / sampleRate) * 0.3 * 32767);
    buf.writeInt16LE(v, 44 + i * 2);
  }
  return buf;
}
