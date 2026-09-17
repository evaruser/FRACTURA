import Phaser from 'phaser';
import { LEVEL, TILE } from '../level.js';
import Player from '../objects/Player.js';
import Enemy from '../objects/Enemy.js';
import GlitchPipeline from '../shaders/GlitchPipeline.js';
import Minimap from '../ui/Minimap.js';
import { HUD } from '../ui/hud.js';

/** Las dos dimensiones y su identidad visual. */
export const DIMENSIONES = {
  LUZ:   { letra: 'A', tinte: [0.88, 1.00, 1.14], color: 0x35e0ff, fondo: 0x05060d },
  VACIO: { letra: 'B', tinte: [1.14, 0.84, 1.08], color: 0xff5ce1, fondo: 0x0d0510 },
};

const VIDAS_INICIALES = 3;
const ENFRIAMIENTO_CAMBIO = 260;   // ms entre cambios, evita el spam

export default class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    this.cols = LEVEL[0].length;
    this.rows = LEVEL.length;
    this.anchoMundo = this.cols * TILE;
    this.altoMundo = this.rows * TILE;

    this.dimension = 'LUZ';
    this.vidas = VIDAS_INICIALES;
    this.recogidos = 0;
    this.terminado = false;
    this.ultimoCambio = -9999;

    this.physics.world.setBounds(0, 0, this.anchoMundo, this.altoMundo);

    this.crearFondo();
    this.construirNivel();
    this.crearJugador();
    this.crearColisiones();
    this.crearCamara();
    this.configurarWebGL();
    this.configurarInput();
    this.configurarHUD();

    this.aplicarDimension(true);

    // Si el menu sigue abierto, la escena espera pausada.
    if (!window.__juegoIniciado) this.scene.pause();
  }

  /* ---------------- Fondo en parallax ---------------- */

  crearFondo() {
    this.cameras.main.setBackgroundColor(DIMENSIONES[this.dimension].fondo);

    // Dos capas del mismo tile de estrellas a distinta velocidad:
    // el scrollFactor bajo hace que "queden lejos".
    this.capaLejos = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'estrellas')
      .setOrigin(0).setScrollFactor(0).setAlpha(0.35).setDepth(-20);

    this.capaCerca = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'estrellas')
      .setOrigin(0).setScrollFactor(0).setAlpha(0.6).setScale(1).setDepth(-19)
      .setTint(0x9fd8ff);
  }

  /* ---------------- Construccion del nivel ---------------- */

  construirNivel() {
    this.solidos = this.physics.add.staticGroup();
    this.plataformas = {
      LUZ:   this.physics.add.staticGroup(),
      VACIO: this.physics.add.staticGroup(),
    };
    this.fragmentos = this.physics.add.group({ allowGravity: false, immovable: true });
    this.enemigos = this.add.group({ runChildUpdate: false });

    this.posFragmentos = [];   // para el minimapa
    this.salidaTile = null;

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const ch = LEVEL[r][c];
        const x = c * TILE + TILE / 2;
        const y = r * TILE + TILE / 2;

        switch (ch) {
          case '#':
            this.solidos.create(x, y, 'tile-solido');
            break;

          case 'A':
          case 'B': {
            const dim = ch === 'A' ? 'LUZ' : 'VACIO';
            const tex = ch === 'A' ? 'tile-luz' : 'tile-vacio';
            const bloque = this.plataformas[dim].create(x, y, tex);
            bloque.setData('gridX', c).setData('gridY', r);
            break;
          }

          case 'P':
            this.spawn = { x, y };
            break;

          case 'E':
            this.enemigos.add(new Enemy(this, x, y));
            break;

          case '*': {
            const f = this.fragmentos.create(x, y, 'fragmento');
            f.setData('gridX', c).setData('gridY', r);
            f.body.setAllowGravity(false);
            // Flotan arriba y abajo, cada uno desfasado
            this.tweens.add({
              targets: f, y: y - 7, duration: 1100, yoyo: true, repeat: -1,
              ease: 'Sine.easeInOut', delay: (c * 37) % 900,
            });
            this.tweens.add({ targets: f, angle: 360, duration: 3200, repeat: -1 });
            this.posFragmentos.push(f);
            break;
          }

          case 'X':
            this.salidaTile = { x: c, y: r };
            this.salida = this.physics.add.sprite(x, y, 'salida');
            this.salida.body.setAllowGravity(false);
            this.salida.body.setSize(28, 44);
            this.salida.setDepth(5);
            this.tweens.add({
              targets: this.salida, scaleX: 1.15, scaleY: 0.92,
              duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            });
            break;
        }
      }
    }

    this.totalFragmentos = this.posFragmentos.length;
  }

  crearJugador() {
    this.jugador = new Player(this, this.spawn.x, this.spawn.y);
  }

  crearColisiones() {
    // El jugador choca con lo solido y con la dimension ACTIVA.
    this.physics.add.collider(this.jugador, this.solidos);
    this.colliderLuz   = this.physics.add.collider(this.jugador, this.plataformas.LUZ);
    this.colliderVacio = this.physics.add.collider(this.jugador, this.plataformas.VACIO);

    this.physics.add.collider(this.enemigos, this.solidos);
    this.colliderEnemLuz   = this.physics.add.collider(this.enemigos, this.plataformas.LUZ);
    this.colliderEnemVacio = this.physics.add.collider(this.enemigos, this.plataformas.VACIO);

    this.physics.add.overlap(this.jugador, this.fragmentos, this.recoger, null, this);
    this.physics.add.overlap(this.jugador, this.enemigos, this.tocarEnemigo, null, this);
    this.physics.add.overlap(this.jugador, this.salida, this.alcanzarSalida, null, this);
  }

  crearCamara() {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.anchoMundo, this.altoMundo);
    cam.startFollow(this.jugador, true, 0.11, 0.11);
    // Zona muerta: la camara no se mueve con cada pasito
    cam.setDeadzone(180, 110);
  }

  /* ---------------- WebGL ---------------- */

  configurarWebGL() {
    this.esWebGL = this.game.renderer.type === Phaser.WEBGL;
    if (!this.esWebGL) {
      console.warn('[FRACTURA] Sin WebGL: se juega en Canvas 2D, sin shader de glitch.');
      return;
    }
    this.cameras.main.setPostPipeline(GlitchPipeline);
    this.glitch = this.cameras.main.getPostPipeline(GlitchPipeline);
    if (Array.isArray(this.glitch)) this.glitch = this.glitch[0];
  }

  /* ---------------- Input ---------------- */

  configurarInput() {
    const t = this.input.keyboard.addKeys({
      izq: Phaser.Input.Keyboard.KeyCodes.LEFT,
      der: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      espacio: Phaser.Input.Keyboard.KeyCodes.SPACE,
      arriba: Phaser.Input.Keyboard.KeyCodes.UP,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      shift: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      e: Phaser.Input.Keyboard.KeyCodes.E,
      r: Phaser.Input.Keyboard.KeyCodes.R,
    });
    this.teclas = t;
    // La barra espaciadora hace scroll en el navegador si no la capturamos
    this.input.keyboard.addCapture([32, 37, 38, 39, 40, 16]);
  }

  leerInput() {
    const t = this.teclas;
    const saltoAhora = t.espacio.isDown || t.arriba.isDown || t.w.isDown;
    const pulsado = saltoAhora && !this._saltoPrevio;
    const soltado = !saltoAhora && this._saltoPrevio;
    this._saltoPrevio = saltoAhora;

    return {
      izquierda: t.izq.isDown || t.a.isDown,
      derecha:   t.der.isDown || t.d.isDown,
      saltoPulsado: pulsado,
      saltoSoltado: soltado,
    };
  }

  /* ---------------- HUD y minimapa ---------------- */

  configurarHUD() {
    HUD.initVidas(VIDAS_INICIALES);
    HUD.setTotalFragmentos(this.totalFragmentos);
    HUD.setFragmentos(0);
    this.minimapa = new Minimap(document.getElementById('minimap'), LEVEL);
  }

  /* ---------------- Cambio de dimension ---------------- */

  /** True si el jugador quedaria atrapado dentro de un bloque. */
  quedariaAtrapado(destino) {
    const b = this.jugador.body;
    let atrapado = false;
    this.plataformas[destino].children.iterate((bloque) => {
      if (!bloque || atrapado) return;
      if (Phaser.Geom.Intersects.RectangleToRectangle(
        new Phaser.Geom.Rectangle(b.x, b.y, b.width, b.height),
        bloque.getBounds()
      )) atrapado = true;
    });
    return atrapado;
  }

  cambiarDimension() {
    if (this.terminado) return;
    if (this.time.now - this.ultimoCambio < ENFRIAMIENTO_CAMBIO) return;

    const destino = this.dimension === 'LUZ' ? 'VACIO' : 'LUZ';

    if (this.quedariaAtrapado(destino)) {
      // Cambio bloqueado: sacudida corta y glitch minimo como aviso
      this.cameras.main.shake(140, 0.006);
      if (this.glitch) this.glitch.burst(0.25);
      return;
    }

    this.ultimoCambio = this.time.now;
    this.dimension = destino;
    this.aplicarDimension(false);
  }

  aplicarDimension(inicial) {
    const activa = this.dimension;
    const otra = activa === 'LUZ' ? 'VACIO' : 'LUZ';
    const conf = DIMENSIONES[activa];

    // Activar/desactivar los cuerpos fisicos de cada set
    this.colliderLuz.active     = activa === 'LUZ';
    this.colliderVacio.active   = activa === 'VACIO';
    this.colliderEnemLuz.active = activa === 'LUZ';
    this.colliderEnemVacio.active = activa === 'VACIO';

    // Los bloques inactivos no desaparecen: quedan como fantasma
    // para que puedas planear el salto ANTES de cambiar.
    this.plataformas[activa].children.iterate((b) => {
      if (b) this.tweens.add({ targets: b, alpha: 1, duration: 220 });
    });
    this.plataformas[otra].children.iterate((b) => {
      if (b) this.tweens.add({ targets: b, alpha: 0.13, duration: 220 });
    });

    // Fondo y shader
    this.cameras.main.setBackgroundColor(conf.fondo);
    if (this.glitch) {
      this.glitch.setTint(...conf.tinte, 1);
      if (!inicial) this.glitch.burst(1);
    }
    if (!inicial) {
      this.cameras.main.shake(180, 0.009);
      this.explosion(this.jugador.x, this.jugador.y, conf.color);
    }

    HUD.setDimension(activa, !inicial);
  }

  explosion(x, y, color) {
    const p = this.add.particles(x, y, 'particula', {
      speed: { min: 90, max: 280 },
      lifespan: 520,
      scale: { start: 1.1, end: 0 },
      quantity: 22,
      tint: color,
      blendMode: 'ADD',
      emitting: false,
    });
    p.explode(22);
    this.time.delayedCall(700, () => p.destroy());
  }

  /* ---------------- Consultas al mundo ---------------- */

  /** Devuelve el caracter del mapa en coordenadas de pixel. */
  tileEn(px, py) {
    const c = Math.floor(px / TILE);
    const r = Math.floor(py / TILE);
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return '#';
    return LEVEL[r][c];
  }

  /** Hay suelo pisable aqui, en la dimension activa? */
  haySuelo(px, py) {
    const ch = this.tileEn(px, py);
    if (ch === '#') return true;
    return ch === DIMENSIONES[this.dimension].letra;
  }

  /* ---------------- Eventos de juego ---------------- */

  recoger(jugador, fragmento) {
    if (!fragmento.active) return;
    this.recogidos++;
    HUD.setFragmentos(this.recogidos);
    this.explosion(fragmento.x, fragmento.y, 0xffd75e);
    this.posFragmentos = this.posFragmentos.filter((f) => f !== fragmento);
    fragmento.destroy();
  }

  tocarEnemigo(jugador, enemigo) {
    if (this.terminado || !enemigo.active) return;

    // Pisotón: si cae encima, lo elimina y rebota.
    const cayendo = jugador.body.velocity.y > 60;
    const porEncima = jugador.body.bottom < enemigo.body.top + 14;
    if (cayendo && porEncima) {
      this.explosion(enemigo.x, enemigo.y, 0xff3b6b);
      enemigo.destroy();
      jugador.setVelocityY(-380);
      this.cameras.main.shake(90, 0.004);
      return;
    }

    if (jugador.golpear(enemigo.x)) this.perderVida();
  }

  perderVida() {
    this.vidas--;
    HUD.perderVida(this.vidas);
    this.cameras.main.shake(260, 0.014);
    if (this.glitch) this.glitch.burst(0.7);

    if (this.vidas <= 0) this.finalizar(false);
  }

  alcanzarSalida() {
    if (this.terminado) return;
    if (this.recogidos < this.totalFragmentos) {
      // Aviso: falta recoger fragmentos
      if (!this._avisoSalida || this.time.now - this._avisoSalida > 1400) {
        this._avisoSalida = this.time.now;
        this.cameras.main.flash(120, 255, 90, 90);
      }
      return;
    }
    this.finalizar(true);
  }

  finalizar(victoria) {
    this.terminado = true;
    this.physics.pause();
    if (this.glitch) this.glitch.burst(1);

    const texto = victoria
      ? `Fragmentos: ${this.recogidos}/${this.totalFragmentos} — Vidas restantes: ${this.vidas}`
      : `Recogiste ${this.recogidos} de ${this.totalFragmentos} fragmentos`;

    this.time.delayedCall(420, () => HUD.mostrarFin(victoria, texto));
  }

  reiniciar() {
    HUD.ocultarFin();
    this.scene.restart();
  }

  /* ---------------- Bucle ---------------- */

  update(time, delta) {
    if (this.teclas.r.isDown && this.terminado) this.reiniciar();

    if (!this.terminado) {
      // Cambio de dimension (Shift o E), solo en el flanco de subida
      const cambiar = this.teclas.shift.isDown || this.teclas.e.isDown;
      if (cambiar && !this._cambioPrevio) this.cambiarDimension();
      this._cambioPrevio = cambiar;

      this.jugador.update(this.leerInput(), delta);
      this.enemigos.children.iterate((e) => {
        if (e && e.active) e.update((x, y) => this.haySuelo(x, y), delta);
      });
    }

    // Parallax: las capas se mueven a fraccion del scroll de camara
    const cam = this.cameras.main;
    this.capaLejos.tilePositionX = cam.scrollX * 0.12;
    this.capaLejos.tilePositionY = cam.scrollY * 0.12;
    this.capaCerca.tilePositionX = cam.scrollX * 0.30;
    this.capaCerca.tilePositionY = cam.scrollY * 0.30;

    // Decaimiento del glitch (WebGL)
    if (this.glitch) this.glitch.decay(delta);

    // Repintado del minimapa (Canvas 2D)
    this.minimapa.draw({
      dimension: this.dimension,
      jugador: { x: this.jugador.x / TILE, y: this.jugador.y / TILE },
      enemigos: this.enemigos.getChildren()
        .filter((e) => e.active)
        .map((e) => ({ x: e.x / TILE, y: e.y / TILE })),
      fragmentos: this.posFragmentos
        .filter((f) => f.active)
        .map((f) => ({ x: f.getData('gridX'), y: f.getData('gridY') })),
      salida: this.salidaTile,
    }, delta);
  }
}
