import Phaser from 'phaser';
import { TILE } from '../level.js';

/* Genera todas las texturas por codigo con Phaser.Graphics.
   Ventaja para un proyecto de clase: cero archivos de imagen,
   cero problemas de rutas, y cambiar el "arte" es cambiar numeros. */

export default class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    // El solido es claramente mas claro: es la senal de 'aqui puedes
    // cambiar de dimension sin caerte'.
    this.texBloque('tile-solido', 0x44507a, 0x7c8fc4, 0x232a45);
    this.texBloque('tile-luz',    0x1d6b85, 0x4fe6ff, 0x0d3040);
    this.texBloque('tile-vacio',  0x7a2f70, 0xff7ce8, 0x3d1038);

    this.texJugador();
    this.texEnemigo();
    this.texFragmento();
    this.texSalida();
    this.texParticula();
    this.texEstrellas();

    this.scene.start('Game');
  }

  /** Bloque con biselado: luz arriba/izquierda, sombra abajo/derecha. */
  texBloque(clave, base, luz, sombra) {
    const g = this.make.graphics({ add: false });
    g.fillStyle(base, 1).fillRect(0, 0, TILE, TILE);
    g.fillStyle(luz, 1).fillRect(0, 0, TILE, 3).fillRect(0, 0, 3, TILE);
    g.fillStyle(sombra, 1)
      .fillRect(0, TILE - 3, TILE, 3)
      .fillRect(TILE - 3, 0, 3, TILE);
    // Grano interior para que no se vea plano
    g.fillStyle(luz, 0.10);
    for (let i = 0; i < 6; i++) {
      g.fillRect(
        Phaser.Math.Between(4, TILE - 8),
        Phaser.Math.Between(4, TILE - 8),
        Phaser.Math.Between(2, 5),
        Phaser.Math.Between(2, 5)
      );
    }
    g.generateTexture(clave, TILE, TILE);
    g.destroy();
  }

  texJugador() {
    const g = this.make.graphics({ add: false });
    g.fillStyle(0xf2f7ff, 1).fillRoundedRect(2, 2, 20, 28, 5);   // cuerpo
    g.fillStyle(0x0a0e1c, 1).fillRoundedRect(5, 7, 14, 8, 3);    // visor
    g.fillStyle(0x35e0ff, 1).fillRect(6, 9, 12, 3);              // brillo del visor
    g.fillStyle(0xb9c9e6, 1).fillRect(4, 22, 16, 3);             // cinturon
    g.generateTexture('jugador', 24, 32);
    g.destroy();
  }

  texEnemigo() {
    const g = this.make.graphics({ add: false });
    g.fillStyle(0xff3b6b, 1);
    g.beginPath();
    g.moveTo(12, 0); g.lineTo(24, 12); g.lineTo(18, 24);
    g.lineTo(6, 24);  g.lineTo(0, 12);  g.closePath(); g.fillPath();
    g.fillStyle(0x2b0410, 1).fillRect(6, 9, 5, 5).fillRect(13, 9, 5, 5);
    g.fillStyle(0xffe9ef, 1).fillRect(7, 10, 2, 2).fillRect(14, 10, 2, 2);
    g.generateTexture('enemigo', 24, 26);
    g.destroy();
  }

  texFragmento() {
    const g = this.make.graphics({ add: false });
    g.fillStyle(0xffd75e, 1);
    g.beginPath();
    g.moveTo(8, 0); g.lineTo(16, 8); g.lineTo(8, 16); g.lineTo(0, 8);
    g.closePath(); g.fillPath();
    g.fillStyle(0xfff6d0, 1);
    g.beginPath();
    g.moveTo(8, 3); g.lineTo(12, 8); g.lineTo(8, 10); g.lineTo(4, 8);
    g.closePath(); g.fillPath();
    g.generateTexture('fragmento', 16, 16);
    g.destroy();
  }

  texSalida() {
    const g = this.make.graphics({ add: false });
    for (let i = 6; i >= 0; i--) {
      const a = 0.12 + i * 0.06;
      g.fillStyle(0x5dff9e, a);
      g.fillEllipse(24, 32, 10 + i * 5, 28 + i * 7);
    }
    g.fillStyle(0xeaffe9, 0.95).fillEllipse(24, 32, 10, 26);
    g.generateTexture('salida', 48, 64);
    g.destroy();
  }

  texParticula() {
    const g = this.make.graphics({ add: false });
    g.fillStyle(0xffffff, 1).fillCircle(4, 4, 4);
    g.generateTexture('particula', 8, 8);
    g.destroy();
  }

  /** Tile de estrellas para el fondo en parallax. */
  texEstrellas() {
    const W = 512, H = 512;
    const g = this.make.graphics({ add: false });
    g.fillStyle(0x000000, 0).fillRect(0, 0, W, H);
    for (let i = 0; i < 180; i++) {
      const a = Phaser.Math.FloatBetween(0.15, 0.85);
      const r = Phaser.Math.FloatBetween(0.6, 1.8);
      g.fillStyle(0xffffff, a);
      g.fillCircle(Phaser.Math.Between(0, W), Phaser.Math.Between(0, H), r);
    }
    g.generateTexture('estrellas', W, H);
    g.destroy();
  }
}
