import Phaser from 'phaser';
import { NIVELES, TILE } from '../levels.js';
import Player from '../objects/Player.js';
import Enemy from '../objects/Enemy.js';
import GlitchPipeline from '../shaders/GlitchPipeline.js';
import Minimap from '../ui/Minimap.js';
import { HUD } from '../ui/hud.js';
import { sonido } from '../audio/Sonido.js';
import { progreso } from '../progreso.js';

/** Las dos dimensiones y su identidad visual. */
export const DIMENSIONES = {
  LUZ:   { letra: 'A', tinte: [0.88, 1.00, 1.14], color: 0x35e0ff, fondo: 0x05060d },
  VACIO: { letra: 'B', tinte: [1.14, 0.84, 1.08], color: 0xff5ce1, fondo: 0x0d0510 },
};

const VIDAS_INICIALES = 3;
const ENFRIAMIENTO_CAMBIO = 260;   // ms entre cambios, evita el spam
const MARGEN_ABISMO = 90;          // px bajo el mapa antes de dar la caida por buena

export default class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  init(datos) {
    this.indiceNivel = Phaser.Math.Clamp(datos?.nivel ?? 0, 0, NIVELES.length - 1);
    this.nivel = NIVELES[this.indiceNivel];
    this.mapa = this.nivel.mapa;
  }

  create() {
    this.cols = this.mapa[0].length;
    this.rows = this.mapa.length;
    this.anchoMundo = this.cols * TILE;
    this.altoMundo = this.rows * TILE;

    this.dimension = 'LUZ';
    this.vidas = VIDAS_INICIALES;
    this.recogidos = 0;
    this.terminado = false;
    this.cayendo = false;
    this.ultimoCambio = -9999;

    // El mundo fisico se extiende por debajo del mapa: asi el jugador
    // puede caerse de verdad por un abismo en vez de quedarse pegado
    // al borde inferior. La camara si respeta el tamano del mapa.
    this.physics.world.setBounds(0, 0, this.anchoMundo, this.altoMundo + MARGEN_ABISMO + 120);

    this.crearFondo();
    this.construirNivel();
    this.crearJugador();
    this.crearColisiones();
    this.crearCamara();
    this.configurarWebGL();
    this.configurarInput();
    this.configurarHUD();

    this.aplicarDimension(true);
    sonido.setDimension(this.dimension);

    HUD.mostrarBanner(this.indiceNivel, this.nivel.nombre, this.nivel.pista);

    // Si el menu sigue abierto, la escena espera pausada.
    if (!window.__juegoIniciado) this.scene.pause();
  }

  /* ---------------- Fondo en parallax ---------------- */

  crearFondo() {
    this.cameras.main.setBackgroundColor(DIMENSIONES[this.dimension].fondo);

    this.capaLejos = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'estrellas')
      .setOrigin(0).setScrollFactor(0).setAlpha(0.35).setDepth(-20);

    this.capaCerca = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'estrellas')
      .setOrigin(0).setScrollFactor(0).setAlpha(0.6).setDepth(-19)
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
    this.enemigos = this.add.group();

    this.posFragmentos = [];
    this.salidaTile = null;

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const ch = this.mapa[r][c];
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
            this.plataformas[dim].create(x, y, tex);
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
    // El salto lo anuncia el propio jugador; aqui solo le ponemos sonido.
    this.events.on('jugador:salta', () => sonido.salto());
    this.events.on('jugador:aterriza', () => sonido.aterrizar());
  }

  crearColisiones() {
    this.physics.add.collider(this.jugador, this.solidos);
    this.colliderLuz   = this.physics.add.collider(this.jugador, this.plataformas.LUZ);
    this.colliderVacio = this.physics.add.collider(this.jugador, this.plataformas.VACIO);

    this.physics.add.collider(this.enemigos, this.solidos);
    this.colliderEnemLuz   = this.physics.add.collider(this.enemigos, this.plataformas.LUZ);
    this.colliderEnemVacio = this.physics.add.collider(this.enemigos, this.plataformas.VACIO);

    this.physics.add.overlap(this.jugador, this.fragmentos, this.recoger, null, this);
    this.physics.add.overlap(this.jugador, this.enemigos, this.tocarEnemigo, null, this);
    if (this.salida) {
      this.physics.add.overlap(this.jugador, this.salida, this.alcanzarSalida, null, this);
    }
  }

  crearCamara() {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.anchoMundo, this.altoMundo);
    cam.startFollow(this.jugador, true, 0.11, 0.11);
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
    this.teclas = this.input.keyboard.addKeys({
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
    HUD.setNivel(this.indiceNivel, NIVELES.length, this.nivel.nombre);
    this.minimapa = new Minimap(document.getElementById('minimap'), this.mapa);
  }

  /* ---------------- Cambio de dimension ---------------- */

  /** True si el jugador quedaria atrapado dentro de un bloque. */
  quedariaAtrapado(destino) {
    const b = this.jugador.body;
    const caja = new Phaser.Geom.Rectangle(b.x, b.y, b.width, b.height);
    let atrapado = false;
    this.plataformas[destino].children.iterate((bloque) => {
      if (!bloque || atrapado) return;
      if (Phaser.Geom.Intersects.RectangleToRectangle(caja, bloque.getBounds())) atrapado = true;
    });
    return atrapado;
  }

  cambiarDimension() {
    if (this.terminado) return;
    if (this.time.now - this.ultimoCambio < ENFRIAMIENTO_CAMBIO) return;

    const destino = this.dimension === 'LUZ' ? 'VACIO' : 'LUZ';

    if (this.quedariaAtrapado(destino)) {
      this.cameras.main.shake(140, 0.006);
      if (this.glitch) this.glitch.burst(0.25);
      sonido.bloqueado();
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

    this.colliderLuz.active       = activa === 'LUZ';
    this.colliderVacio.active     = activa === 'VACIO';
    this.colliderEnemLuz.active   = activa === 'LUZ';
    this.colliderEnemVacio.active = activa === 'VACIO';

    // Los bloques inactivos no desaparecen: quedan como fantasma para
    // que puedas planear el salto ANTES de cambiar.
    this.plataformas[activa].children.iterate((b) => {
      if (b) this.tweens.add({ targets: b, alpha: 1, duration: 220 });
    });
    this.plataformas[otra].children.iterate((b) => {
      if (b) this.tweens.add({ targets: b, alpha: 0.13, duration: 220 });
    });

    this.cameras.main.setBackgroundColor(conf.fondo);
    if (this.glitch) {
      this.glitch.setTint(...conf.tinte, 1);
      if (!inicial) this.glitch.burst(1);
    }
    if (!inicial) {
      this.cameras.main.shake(180, 0.009);
      this.explosion(this.jugador.x, this.jugador.y, conf.color);
      sonido.cambio(activa);
    }
    sonido.setDimension(activa);
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

  tileEn(px, py) {
    const c = Math.floor(px / TILE);
    const r = Math.floor(py / TILE);
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return '.';
    return this.mapa[r][c];
  }

  /** Hay suelo pisable aqui, en la dimension activa? */
  haySuelo(px, py) {
    const ch = this.tileEn(px, py);
    return ch === '#' || ch === DIMENSIONES[this.dimension].letra;
  }

  /* ---------------- Eventos de juego ---------------- */

  recoger(jugador, fragmento) {
    if (!fragmento.active) return;
    this.recogidos++;
    HUD.setFragmentos(this.recogidos);
    this.explosion(fragmento.x, fragmento.y, 0xffd75e);
    sonido.fragmento();
    this.posFragmentos = this.posFragmentos.filter((f) => f !== fragmento);
    fragmento.destroy();
  }

  tocarEnemigo(jugador, enemigo) {
    if (this.terminado || !enemigo.active) return;

    // Pisoton: si cae encima, lo elimina y rebota.
    const cayendo = jugador.body.velocity.y > 60;
    const porEncima = jugador.body.bottom < enemigo.body.top + 14;
    if (cayendo && porEncima) {
      this.explosion(enemigo.x, enemigo.y, 0xff3b6b);
      enemigo.destroy();
      jugador.setVelocityY(-380);
      this.cameras.main.shake(90, 0.004);
      sonido.pisoton();
      return;
    }

    if (jugador.golpear(enemigo.x)) this.perderVida();
  }

  /** Caida por un abismo: cuesta una vida y devuelve al inicio. */
  caerAlVacio() {
    if (this.terminado || this.cayendo) return;
    this.cayendo = true;                       // una caida, una vida
    this.time.delayedCall(400, () => { this.cayendo = false; });
    sonido.caer();
    this.perderVida();
    if (!this.terminado) this.jugador.reaparecer();
  }

  perderVida() {
    this.vidas--;
    HUD.perderVida(this.vidas);
    this.cameras.main.shake(260, 0.014);
    if (this.glitch) this.glitch.burst(0.7);
    sonido.dano();

    if (this.vidas <= 0) this.finalizar('derrota');
  }

  alcanzarSalida() {
    if (this.terminado) return;
    if (this.recogidos < this.totalFragmentos) {
      if (!this._avisoSalida || this.time.now - this._avisoSalida > 1400) {
        this._avisoSalida = this.time.now;
        this.cameras.main.flash(120, 255, 90, 90);
        sonido.bloqueado();
      }
      return;
    }
    const esUltimo = this.indiceNivel === NIVELES.length - 1;
    progreso.completar(this.indiceNivel);
    this.finalizar(esUltimo ? 'final' : 'nivel');
  }

  finalizar(tipo) {
    this.terminado = true;
    this.physics.pause();
    if (this.glitch) this.glitch.burst(1);

    if (tipo === 'derrota') sonido.derrota(); else sonido.victoria();

    const textos = {
      nivel:   `Fragmentos: ${this.recogidos}/${this.totalFragmentos} — Vidas restantes: ${this.vidas}`,
      final:   `Has cruzado los ${NIVELES.length} niveles. Fragmentos del último: ${this.recogidos}/${this.totalFragmentos}`,
      derrota: `Nivel ${this.indiceNivel + 1}: recogiste ${this.recogidos} de ${this.totalFragmentos} fragmentos`,
    };
    this.time.delayedCall(420, () => HUD.mostrarFin(tipo, textos[tipo]));
  }

  /* ---------------- Bucle ---------------- */

  update(time, delta) {
    if (!this.terminado) {
      if (this.teclas.r.isDown) { this.scene.restart({ nivel: this.indiceNivel }); return; }

      const cambiar = this.teclas.shift.isDown || this.teclas.e.isDown;
      if (cambiar && !this._cambioPrevio) this.cambiarDimension();
      this._cambioPrevio = cambiar;

      this.jugador.update(this.leerInput(), delta);
      this.enemigos.children.iterate((e) => {
        if (e && e.active) e.update((x, y) => this.haySuelo(x, y), delta);
      });

      // Abismo: en los niveles sin suelo continuo se puede caer fuera.
      if (this.jugador.y - 16 > this.altoMundo + MARGEN_ABISMO) this.caerAlVacio();
    }

    const cam = this.cameras.main;
    this.capaLejos.tilePositionX = cam.scrollX * 0.12;
    this.capaLejos.tilePositionY = cam.scrollY * 0.12;
    this.capaCerca.tilePositionX = cam.scrollX * 0.30;
    this.capaCerca.tilePositionY = cam.scrollY * 0.30;

    if (this.glitch) this.glitch.decay(delta);

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
