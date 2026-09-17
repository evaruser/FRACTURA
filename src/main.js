import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import GameScene from './scenes/GameScene.js';
import GlitchPipeline from './shaders/GlitchPipeline.js';
import { NIVELES } from './levels.js';
import { HUD } from './ui/hud.js';
import { sonido } from './audio/Sonido.js';
import { progreso } from './progreso.js';

const config = {
  type: Phaser.AUTO,          // intenta WebGL; si no hay, cae a Canvas 2D
  parent: 'game-container',
  width: 960,
  height: 540,
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
  pipeline: { GlitchFX: GlitchPipeline },   // shader de post-proceso (WebGL)
  scene: [BootScene, GameScene],
};

const game = new Phaser.Game(config);

/* --- Estado de la partida --------------------------------------- */

// GameScene se pausa sola en create() mientras esta bandera sea false.
window.__juegoIniciado = false;
let nivelActual = progreso.siguiente(NIVELES.length);

const escenaJuego = () => game.scene.getScene('Game');

function irANivel(indice) {
  nivelActual = indice;
  HUD.ocultarFin();
  const escena = escenaJuego();
  if (window.__juegoIniciado) {
    escena.scene.restart({ nivel: indice });
    return;
  }
  window.__juegoIniciado = true;
  // El audio solo puede arrancar desde un gesto del usuario.
  sonido.iniciar();
  HUD.setSilencio(sonido.silencio);
  HUD.cerrarMenu(() => {
    HUD.mostrar();
    escena.scene.restart({ nivel: indice });
  });
}

function volverAlMenu() {
  window.__juegoIniciado = false;
  escenaJuego().scene.pause();
  HUD.abrirMenu();
  pintarSelector();
}

/* --- Selector de niveles del menu -------------------------------- */

const contenedorSelector = document.getElementById('selector-niveles');

function pintarSelector() {
  contenedorSelector.innerHTML = '';
  NIVELES.forEach((nivel, i) => {
    const b = document.createElement('button');
    b.className = 'btn-nivel';
    b.textContent = i + 1;
    b.title = progreso.estaDesbloqueado(i)
      ? nivel.nombre
      : `Completa el nivel ${i} para desbloquearlo`;
    b.disabled = !progreso.estaDesbloqueado(i);
    b.classList.toggle('es-completado', progreso.estaCompletado(i));
    b.addEventListener('click', () => irANivel(i));
    contenedorSelector.appendChild(b);
  });

  const btnJugar = document.getElementById('btn-jugar');
  const siguiente = progreso.siguiente(NIVELES.length);
  btnJugar.textContent = progreso.completados.length > 0 && siguiente > 0 ? 'CONTINUAR' : 'JUGAR';
}
pintarSelector();

/* --- Botones ----------------------------------------------------- */

document.getElementById('btn-jugar').addEventListener('click', () => {
  irANivel(progreso.siguiente(NIVELES.length));
});

// Un solo boton para las tres situaciones: siguiente nivel, reintentar
// el actual, o empezar de cero tras terminar el juego.
document.getElementById('btn-fin').addEventListener('click', () => {
  const escena = escenaJuego();
  const gano = escena.vidas > 0;
  const esUltimo = nivelActual === NIVELES.length - 1;

  if (!gano) irANivel(nivelActual);              // reintentar
  else if (esUltimo) irANivel(0);                // volver a empezar
  else irANivel(nivelActual + 1);                // siguiente nivel
});

document.getElementById('btn-menu').addEventListener('click', volverAlMenu);

document.getElementById('btn-sonido').addEventListener('click', () => {
  sonido.iniciar();
  HUD.setSilencio(sonido.alternarSilencio());
});

/* --- Teclado global ---------------------------------------------- */

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') {
    sonido.iniciar();
    HUD.setSilencio(sonido.alternarSilencio());
    return;
  }
  if (!window.__juegoIniciado && (e.code === 'Enter' || e.code === 'Space')) {
    e.preventDefault();
    irANivel(progreso.siguiente(NIVELES.length));
  }
});

// Util para depurar desde la consola del navegador
window.game = game;
