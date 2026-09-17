import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import GameScene from './scenes/GameScene.js';
import GlitchPipeline from './shaders/GlitchPipeline.js';
import { HUD } from './ui/hud.js';

const ANCHO = 960;
const ALTO = 540;

const config = {
  type: Phaser.AUTO,          // intenta WebGL; si no hay, cae a Canvas 2D
  parent: 'game-container',
  width: ANCHO,
  height: ALTO,
  backgroundColor: '#05060d',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 1400 },
      debug: false,           // ponlo en true para ver las cajas de colision
    },
  },
  // Registro del shader de post-proceso (WebGL)
  pipeline: { GlitchFX: GlitchPipeline },
  scene: [BootScene, GameScene],
};

const game = new Phaser.Game(config);

/* --- Arranque desde el menu DOM --------------------------------- */

// GameScene se pausa sola en create() mientras esta bandera sea false.
window.__juegoIniciado = false;

function empezar() {
  if (window.__juegoIniciado) return;
  window.__juegoIniciado = true;
  HUD.cerrarMenu(() => {
    HUD.mostrar();
    game.scene.getScene('Game')?.scene.resume();
  });
}

document.getElementById('btn-jugar').addEventListener('click', empezar);

document.getElementById('btn-reiniciar').addEventListener('click', () => {
  HUD.ocultarFin();
  game.scene.getScene('Game').scene.restart();
});

// Enter o Espacio tambien arrancan desde el menu
window.addEventListener('keydown', (e) => {
  if (!window.__juegoIniciado && (e.code === 'Enter' || e.code === 'Space')) {
    e.preventDefault();
    empezar();
  }
});

// Util para depurar desde la consola del navegador
window.game = game;
