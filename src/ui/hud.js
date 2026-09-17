/* Puente entre Phaser y el DOM.
   Phaser nunca toca el DOM directamente: emite eventos y este
   modulo se encarga de anadir/quitar clases CSS. Las animaciones
   son 100% CSS (src/style.css). */

const $ = (sel) => document.querySelector(sel);

const el = {
  hud:      $('#hud'),
  vidas:    $('#vidas'),
  badge:    $('#dim-badge'),
  badgeVal: $('#dim-badge .dim-badge__value'),
  count:    $('#shards .shards__count'),
  total:    $('#shards .shards__total'),
  shards:   $('#shards'),
  flash:    $('#flash'),
  vignette: $('#vignette'),
  menu:     $('#menu'),
  fin:      $('#fin'),
  finTitulo:$('#fin-titulo'),
  finTexto: $('#fin-texto'),
};

/** Reinicia una animacion CSS: hay que forzar un reflow o,
 *  si la clase ya estaba puesta, el navegador no la re-dispara. */
function reanimar(nodo, clase, ms) {
  nodo.classList.remove(clase);
  void nodo.offsetWidth;           // reflow forzado
  nodo.classList.add(clase);
  setTimeout(() => nodo.classList.remove(clase), ms);
}

export const HUD = {
  mostrar() { el.hud.classList.add('is-visible'); },
  ocultar() { el.hud.classList.remove('is-visible'); },

  initVidas(n) {
    el.vidas.innerHTML = '';
    for (let i = 0; i < n; i++) {
      const v = document.createElement('div');
      v.className = 'vida';
      el.vidas.appendChild(v);
    }
  },

  perderVida(restantes) {
    const hijos = [...el.vidas.children];
    const objetivo = hijos[restantes];
    if (objetivo) objetivo.classList.add('is-perdida');
    reanimar(el.vignette, 'is-activo', 520);
  },

  setTotalFragmentos(n) { el.total.textContent = `/ ${n}`; },

  setFragmentos(n) {
    el.count.textContent = n;
    reanimar(el.shards, 'is-pop', 380);
  },

  /**
   * @param {'LUZ'|'VACIO'} dim
   * @param {boolean} conEfecto  false al montar el nivel: sin el, la
   *   pantalla daba un fogonazo nada mas empezar la partida.
   */
  setDimension(dim, conEfecto = true) {
    el.badgeVal.textContent = dim;
    document.body.classList.toggle('dim-vacio', dim === 'VACIO');
    document.body.classList.toggle('dim-luz', dim === 'LUZ');
    if (!conEfecto) return;
    reanimar(el.badge, 'is-cambiando', 460);
    reanimar(el.flash, 'is-activo', 420);
  },

  /** Cierra el menu con la animacion de salida y avisa al terminar. */
  cerrarMenu(alTerminar) {
    el.menu.classList.add('is-saliendo');
    setTimeout(() => {
      el.menu.classList.remove('is-visible', 'is-saliendo');
      alTerminar?.();
    }, 460);
  },

  mostrarFin(victoria, texto) {
    el.finTitulo.textContent = victoria ? 'NIVEL COMPLETADO' : 'FRACTURA TOTAL';
    el.finTitulo.classList.toggle('es-derrota', !victoria);
    el.finTexto.textContent = texto;
    el.fin.classList.add('is-visible');
    // Reinicia la animacion de entrada del contenido
    const inner = el.fin.querySelector('.overlay__inner');
    inner.style.animation = 'none';
    void inner.offsetWidth;
    inner.style.animation = '';
  },

  ocultarFin() { el.fin.classList.remove('is-visible'); },
};
