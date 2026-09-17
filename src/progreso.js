/* Progreso guardado en el navegador. localStorage puede lanzar
   excepcion (navegacion privada, cookies bloqueadas), asi que todo
   va envuelto: si falla, se juega igual sin guardar nada. */

const CLAVE = 'fractura:completados';

function leer() {
  try {
    const bruto = localStorage.getItem(CLAVE);
    const lista = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(lista) ? lista.filter(Number.isInteger) : [];
  } catch { return []; }
}

function escribir(lista) {
  try { localStorage.setItem(CLAVE, JSON.stringify(lista)); } catch { /* da igual */ }
}

export const progreso = {
  completados: leer(),

  completar(indice) {
    if (this.completados.includes(indice)) return;
    this.completados.push(indice);
    escribir(this.completados);
  },

  estaCompletado(indice) { return this.completados.includes(indice); },

  /** Un nivel se desbloquea si es el primero, si el anterior esta hecho,
   *  o si ya lo completaste: un nivel superado nunca debe quedar
   *  bloqueado, aunque el progreso llegue desordenado. */
  estaDesbloqueado(indice) {
    return indice === 0
      || this.completados.includes(indice - 1)
      || this.completados.includes(indice);
  },

  /** Primer nivel sin completar: donde continua la partida. */
  siguiente(total) {
    for (let i = 0; i < total; i++) if (!this.completados.includes(i)) return i;
    return 0;
  },
};
