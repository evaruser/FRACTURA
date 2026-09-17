/* Puente entre Phaser y el DOM.
   Phaser nunca toca estilos directamente: emite eventos y este
   modulo anade o quita clases CSS. Las animaciones son 100% CSS. */

const $ = (sel) => document.querySelector(sel);

const el = {
  hud:      $('#hud'),
  vidas:    $('#vidas'),
  badge:    $('#dim-badge'),
  badgeVal: $('#dim-badge .dim-badge__value'),
  nivelNum: $('#nivel-hud .nivel-hud__num'),
  nivelNom: $('#nivel-hud .nivel-hud__nombre'),
  count:    $('#shards .shards__count'),
  total:    $('#shards .shards__total'),
  shards:   $('#shards'),
  flash:    $('#flash'),
  vignette: $('#vignette'),
  banner:   $('#nivel-banner'),
  bannerNum:$('#nivel-banner .nivel-banner__num'),
  bannerNom:$('#nivel-banner .nivel-banner__nombre'),
  bannerPis:$('#nivel-banner .nivel-banner__pista'),
  menu:     $('#menu'),
  fin:      $('#fin'),
  finTitulo:$('#fin-titulo'),
  finTexto: $('#fin-texto'),
  btnFin:   $('#btn-fin'),
  btnSonido:$('#btn-sonido'),
};

/** Reinicia una animacion CSS: hay que forzar un reflow o, si la
 *  clase ya estaba puesta, el navegador no la vuelve a disparar. */
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
    const objetivo = [...el.vidas.children][restantes];
    if (objetivo) objetivo.classList.add('is-perdida');
    reanimar(el.vignette, 'is-activo', 520);
  },

  setNivel(indice, total, nombre) {
    el.nivelNum.textContent = `${indice + 1}/${total}`;
    el.nivelNom.textContent = nombre;
  },

  /** Cartel que presenta el nivel y su pista durante ~3s. */
  mostrarBanner(indice, nombre, pista) {
    el.bannerNum.textContent = `NIVEL ${indice + 1}`;
    el.bannerNom.textContent = nombre;
    el.bannerPis.textContent = pista;
    reanimar(el.banner, 'is-visible', 3400);
  },

  setTotalFragmentos(n) { el.total.textContent = `/ ${n}`; },

  setFragmentos(n) {
    el.count.textContent = n;
    reanimar(el.shards, 'is-pop', 380);
  },

  /**
   * @param {'LUZ'|'VACIO'} dim
   * @param {boolean} conEfecto  false al montar el nivel: sin esto la
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

  setSilencio(mudo) { el.btnSonido.classList.toggle('is-mudo', mudo); },

  /** Cierra el menu con su animacion de salida y avisa al terminar. */
  cerrarMenu(alTerminar) {
    el.menu.classList.add('is-saliendo');
    setTimeout(() => {
      el.menu.classList.remove('is-visible', 'is-saliendo');
      alTerminar?.();
    }, 460);
  },

  abrirMenu() {
    el.fin.classList.remove('is-visible');
    el.hud.classList.remove('is-visible');
    el.menu.classList.add('is-visible');
  },

  /**
   * @param {'nivel'|'final'|'derrota'} tipo
   */
  mostrarFin(tipo, texto) {
    const titulos = {
      nivel:   ['NIVEL COMPLETADO', 'SIGUIENTE NIVEL'],
      final:   ['JUEGO COMPLETADO', 'JUGAR DE NUEVO'],
      derrota: ['FRACTURA TOTAL',   'REINTENTAR'],
    };
    const [titulo, boton] = titulos[tipo];
    el.finTitulo.textContent = titulo;
    el.finTitulo.classList.toggle('es-derrota', tipo === 'derrota');
    el.btnFin.textContent = boton;
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
