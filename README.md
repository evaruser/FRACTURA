# FRACTURA — plataformas 2D con cambio de dimensión

Juego de plataformas en el que el mismo nivel existe en dos dimensiones
(**LUZ** y **VACÍO**). Cada una tiene sus propias plataformas: las de la otra
quedan como fantasma. Para subir hay que ir alternando — y en el tramo final,
saltar y cambiar **en el aire**.

```bash
npm install
npm run dev
```

## Las cuatro tecnologías y dónde está cada una

| # | Tecnología | Dónde | Qué hace exactamente |
|---|---|---|---|
| 1 | **Canvas + JavaScript** | [Minimap.js](src/ui/Minimap.js) | Un `<canvas>` propio, independiente del de Phaser, con contexto `2d`. Se repinta cada frame con `fillRect`, `arc`, `createRadialGradient` y `createLinearGradient`. Sin motor: API cruda. |
| 2 | **WebGL** | [GlitchPipeline.js](src/shaders/GlitchPipeline.js) | Shader GLSL de post-proceso sobre la cámara: bandas desplazadas, aberración cromática, scanlines y tinte por dimensión. |
| 3 | **CSS Animations** | [style.css](src/style.css) + [hud.js](src/ui/hud.js) | Todo el interfaz es DOM: menú, título con glitch por `clip-path`, corazones que laten y se rompen, contador con "pop", flash de cambio, viñeta de daño. 20+ `@keyframes`. |
| 4 | **Phaser.js** | [GameScene.js](src/scenes/GameScene.js) | Motor: escenas, física Arcade, colisiones, cámara con deadzone, tweens, partículas y tilemap propio. |

> **Nota importante:** Phaser ya usa Canvas y WebGL por dentro
> (`type: Phaser.AUTO` intenta WebGL y cae a Canvas 2D si no hay soporte).
> Por eso las capas 1 y 2 están hechas *aparte* del motor: así cada
> tecnología tiene un uso propio y demostrable, no solapado.

## Estructura

```
src/
├── main.js                  configuración de Phaser y arranque desde el menú DOM
├── level.js                 mapa ASCII del nivel (editable a mano)
├── style.css                CAPA 3 — todas las animaciones CSS
├── scenes/
│   ├── BootScene.js         genera las texturas por código (cero imágenes)
│   └── GameScene.js         CAPA 4 — lógica del juego
├── objects/
│   ├── Player.js            coyote time, jump buffer, salto de altura variable
│   └── Enemy.js             patrulla con detección de borde
├── shaders/
│   └── GlitchPipeline.js    CAPA 2 — shader WebGL
└── ui/
    ├── Minimap.js           CAPA 1 — Canvas 2D a mano
    └── hud.js               puente Phaser → DOM (no toca estilos, sólo clases)
```

## Controles

| Tecla | Acción |
|---|---|
| `←` `→` / `A` `D` | Mover |
| `Espacio` / `↑` / `W` | Saltar (mantener = salto más alto) |
| `Shift` / `E` | Cambiar de dimensión |
| `R` | Reiniciar (en la pantalla de fin) |

## Cómo editar el nivel

[`src/level.js`](src/level.js) es un array de strings. Un carácter = un tile de 32px:

| Carácter | Significado |
|---|---|
| `#` | Bloque sólido en **ambas** dimensiones — sitio seguro para cambiar |
| `A` | Bloque sólo en dimensión LUZ |
| `B` | Bloque sólo en dimensión VACÍO |
| `P` | Spawn del jugador |
| `E` | Enemigo |
| `*` | Fragmento (hay que recogerlos todos para abrir la salida) |
| `X` | Salida |

Todas las filas deben medir lo mismo.

## Detalles de diseño que merece la pena mirar

- **El sólido `#` es la red de seguridad.** Existe en las dos dimensiones, así
  que es el único sitio donde puedes cambiar sin caerte. El primer tramo del
  nivel pone uno antes de cada cambio de color (tutorial); el último tramo los
  quita y obliga a cambiar en el aire.
- **Las plataformas inactivas no desaparecen**, se quedan al 13% de opacidad.
  Así puedes planear el salto *antes* de cambiar.
- **No puedes quedarte encajado**: si al cambiar fueras a aparecer dentro de un
  bloque, el cambio se rechaza con una sacudida (`quedariaAtrapado()`).
- **Salto con perdón**: *coyote time* (110ms para saltar después de salir de la
  plataforma) y *jump buffer* (130ms para registrar el salto antes de aterrizar).
- **Sin archivos de imagen**: todas las texturas se generan en `BootScene` con
  `Phaser.Graphics.generateTexture()`.
- **Si no hay WebGL** el juego funciona igual en Canvas 2D, sólo sin el shader.

## Ideas para ampliarlo

- Más niveles: `level.js` ya devuelve un array, basta con exportar varios.
- Plataformas que se mueven, o que sólo aguantan unos segundos.
- Un tercer estado de dimensión.
- Contrarreloj y tabla de récords en `localStorage`.
- Sonido con `Phaser.Sound` (un salto, un fragmento, el cambio de dimensión).
