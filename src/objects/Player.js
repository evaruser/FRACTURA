import Phaser from 'phaser';

export const FISICA = {
  VELOCIDAD:      230,
  ACELERACION:    2600,   // px/s^2 en suelo
  ACEL_AIRE:      1500,
  FRICCION:       2200,
  FUERZA_SALTO:   560,
  CORTE_SALTO:    0.42,   // al soltar espacio, recorta el impulso
  COYOTE_MS:      110,    // margen para saltar tras salir de la plataforma
  BUFFER_MS:      130,    // margen para registrar el salto antes de aterrizar
};

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'jugador');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setOrigin(0.5, 0.5);
    this.body.setSize(18, 26).setOffset(3, 3);
    this.setCollideWorldBounds(true);
    this.setMaxVelocity(FISICA.VELOCIDAD, 1200);
    this.setDepth(10);

    this.coyote = 0;         // ms restantes de coyote time
    this.buffer = 0;         // ms restantes del salto "bufferizado"
    this.invulnerable = 0;   // ms restantes de invulnerabilidad
    this.spawn = { x, y };
  }

  update(input, dt) {
    const body = this.body;
    const enSuelo = body.blocked.down || body.touching.down;

    // --- Temporizadores -------------------------------------
    this.coyote = enSuelo ? FISICA.COYOTE_MS : Math.max(0, this.coyote - dt);
    this.buffer = Math.max(0, this.buffer - dt);
    if (input.saltoPulsado) this.buffer = FISICA.BUFFER_MS;

    if (this.invulnerable > 0) {
      this.invulnerable -= dt;
      // Parpadeo mientras dura
      this.setAlpha(Math.floor(this.invulnerable / 60) % 2 ? 0.3 : 1);
      if (this.invulnerable <= 0) this.setAlpha(1);
    }

    // --- Movimiento horizontal ------------------------------
    const acel = enSuelo ? FISICA.ACELERACION : FISICA.ACEL_AIRE;
    if (input.izquierda) {
      this.setAccelerationX(-acel);
      this.setFlipX(true);
    } else if (input.derecha) {
      this.setAccelerationX(acel);
      this.setFlipX(false);
    } else {
      this.setAccelerationX(0);
      this.setDragX(enSuelo ? FISICA.FRICCION : FISICA.FRICCION * 0.35);
    }

    // --- Salto ----------------------------------------------
    // Salta si hay intencion (buffer) Y permiso (coyote):
    // asi el salto "perdona" pulsaciones un poco pronto o tarde.
    if (this.buffer > 0 && this.coyote > 0) {
      this.setVelocityY(-FISICA.FUERZA_SALTO);
      this.buffer = 0;
      this.coyote = 0;
      this.scene.events.emit('jugador:salta');
    }

    // Salto de altura variable: al soltar, recorta la subida.
    if (input.saltoSoltado && body.velocity.y < 0) {
      this.setVelocityY(body.velocity.y * FISICA.CORTE_SALTO);
    }

    // Estirar/aplastar segun la velocidad vertical (juice barato)
    const vy = Phaser.Math.Clamp(body.velocity.y / 700, -1, 1);
    this.setScale(1 - vy * 0.12, 1 + vy * 0.14);
  }

  golpear(desdeX) {
    if (this.invulnerable > 0) return false;
    this.invulnerable = 1200;
    const dir = this.x < desdeX ? -1 : 1;
    this.setVelocity(dir * 280, -300);
    return true;
  }

  reaparecer() {
    this.setPosition(this.spawn.x, this.spawn.y);
    this.setVelocity(0, 0);
    this.setAlpha(1);
    this.invulnerable = 900;
  }
}
