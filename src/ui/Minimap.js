/* ============================================================
   CAPA 1 — Canvas 2D "a mano"
   Un <canvas> aparte del de Phaser, con su propio contexto 2D.
   Aqui NO hay motor: se limpia y se repinta cada frame con
   fillRect, arc, gradientes... el API crudo de Canvas.
   ============================================================ */

const COLOR = {
  solido:  '#44507a',
  activo:  { LUZ: '#35e0ff', VACIO: '#ff5ce1' },
  inactivo:'#1a1f33',
  jugador: '#ffffff',
  enemigo: '#ff3b6b',
  fragmento: '#ffd75e',
  salida:  '#5dff9e',
};

export default class Minimap {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {string[]} level  filas del mapa ASCII
   */
  constructor(canvas, level) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.level = level;
    this.cols = level[0].length;
    this.rows = level.length;

    // Cuantos pixeles del minimapa ocupa un tile del nivel
    this.sx = canvas.width / this.cols;
    this.sy = canvas.height / this.rows;

    this.t = 0;

    // El fondo estatico (bloques solidos) no cambia nunca:
    // lo pintamos una vez en un canvas oculto y lo copiamos.
    this.fondo = this._prerenderFondo();
  }

  _prerenderFondo() {
    const c = document.createElement('canvas');
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const g = c.getContext('2d');

    g.fillStyle = COLOR.solido;
    for (let r = 0; r < this.rows; r++) {
      for (let col = 0; col < this.cols; col++) {
        if (this.level[r][col] === '#') {
          g.fillRect(col * this.sx, r * this.sy, Math.ceil(this.sx), Math.ceil(this.sy));
        }
      }
    }
    return c;
  }

  /**
   * @param {object} estado
   * @param {'LUZ'|'VACIO'} estado.dimension
   * @param {{x:number,y:number}} estado.jugador   en tiles
   * @param {Array<{x:number,y:number}>} estado.enemigos
   * @param {Array<{x:number,y:number}>} estado.fragmentos  los que quedan
   * @param {{x:number,y:number}} estado.salida
   * @param {number} dt  delta en ms
   */
  draw(estado, dt) {
    const { ctx, sx, sy } = this;
    // El delta puede venir raro tras un cambio de pestana o un frame
    // perdido; si no es finito, usamos un paso de 60fps. Sin esta
    // guarda un solo NaN se propaga a this.t y rompe los gradientes.
    this.t += (Number.isFinite(dt) ? Math.min(dt, 100) : 16) / 1000;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.fondo, 0, 0);

    // --- Plataformas dimensionales ---------------------------
    // Las de la dimension activa brillan; las otras quedan como
    // fantasma para que puedas planear el salto antes de cambiar.
    const activaEs = estado.dimension === 'LUZ' ? 'A' : 'B';
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const ch = this.level[r][c];
        if (ch !== 'A' && ch !== 'B') continue;

        const esActiva = ch === activaEs;
        ctx.fillStyle = esActiva ? COLOR.activo[estado.dimension] : COLOR.inactivo;
        ctx.globalAlpha = esActiva ? 1 : 0.55;
        ctx.fillRect(c * sx, r * sy, Math.ceil(sx), Math.ceil(sy));
      }
    }
    ctx.globalAlpha = 1;

    // --- Fragmentos: parpadeo con seno ------------------------
    const pulso = 0.55 + 0.45 * Math.sin(this.t * 4);
    ctx.fillStyle = COLOR.fragmento;
    ctx.globalAlpha = pulso;
    for (const f of estado.fragmentos) {
      ctx.fillRect(f.x * sx - 1, f.y * sy - 1, sx + 2, sy + 2);
    }
    ctx.globalAlpha = 1;

    // --- Salida: rombo verde ---------------------------------
    if (estado.salida) {
      const ex = estado.salida.x * sx + sx / 2;
      const ey = estado.salida.y * sy + sy / 2;
      ctx.fillStyle = COLOR.salida;
      ctx.beginPath();
      ctx.moveTo(ex, ey - 4);
      ctx.lineTo(ex + 4, ey);
      ctx.lineTo(ex, ey + 4);
      ctx.lineTo(ex - 4, ey);
      ctx.closePath();
      ctx.fill();
    }

    // --- Enemigos --------------------------------------------
    ctx.fillStyle = COLOR.enemigo;
    for (const e of estado.enemigos) {
      ctx.fillRect(e.x * sx - 1, e.y * sy - 1, 3, 3);
    }

    // --- Jugador: punto con halo ------------------------------
    const px = estado.jugador.x * sx;
    const py = estado.jugador.y * sy;

    const halo = ctx.createRadialGradient(px, py, 0, px, py, 12);
    halo.addColorStop(0, 'rgba(255,255,255,.55)');
    halo.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(px, py, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLOR.jugador;
    ctx.beginPath();
    ctx.arc(px, py, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // --- Barrido tipo CRT bajando por el minimapa -------------
    const sweepY = (this.t * 34) % (this.canvas.height + 30) - 15;
    const g = ctx.createLinearGradient(0, sweepY - 10, 0, sweepY + 10);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,.07)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, sweepY - 10, this.canvas.width, 20);
  }
}
