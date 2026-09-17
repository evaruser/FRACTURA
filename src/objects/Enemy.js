import Phaser from 'phaser';

/* Enemigo patrullero.
   No usa pathfinding: camina recto y se da la vuelta cuando
   choca con una pared O cuando deja de haber suelo delante.
   Ese segundo caso es el que evita que se tiren al vacio. */

export default class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'enemigo');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setSize(22, 22).setOffset(1, 2);
    this.setDepth(9);
    this.velocidad = Phaser.Math.Between(55, 80);
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.setVelocityX(this.velocidad * this.dir);
  }

  /** @param {(x:number,y:number)=>boolean} haySuelo consulta al mundo */
  update(haySuelo, dt) {
    const body = this.body;

    // Choque contra pared
    if (body.blocked.left)  this.dir = 1;
    if (body.blocked.right) this.dir = -1;

    // Borde de plataforma: miramos un tile por delante y abajo
    if (body.blocked.down) {
      const delante = this.x + this.dir * 18;
      const abajo = this.y + 22;
      if (!haySuelo(delante, abajo)) this.dir *= -1;
    }

    this.setVelocityX(this.velocidad * this.dir);
    this.setFlipX(this.dir < 0);

    // Balanceo suave al caminar
    this.rotation = Math.sin(this.scene.time.now / 120) * 0.08;
  }
}
