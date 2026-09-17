# FRACTURA — plataformas 2D con cambio de dimensión

Juego de plataformas en el que el mismo nivel existe en dos dimensiones
(**LUZ** y **VACÍO**). Cada una tiene sus propias plataformas: las de la otra
quedan como fantasma. Para avanzar hay que ir alternando — y en los tramos
finales, saltar y cambiar **en el aire**.

**[▶ Jugar](https://evaruser.github.io/FRACTURA/)**

```bash
npm install
npm run dev
```

## Las cuatro tecnologías y dónde está cada una

| # | Tecnología | Dónde | Qué hace exactamente |
|---|---|---|---|
| 1 | **Canvas + JavaScript** | [Minimap.js](src/ui/Minimap.js) | Un `<canvas>` propio, independiente del de Phaser, con contexto `2d`. Se repinta cada frame con `fillRect`, `arc`, `createRadialGradient` y `createLinearGradient`. Sin motor: API cruda. |
| 2 | **WebGL** | [GlitchPipeline.js](src/shaders/GlitchPipeline.js) | Shader GLSL de post-proceso sobre la cámara: bandas desplazadas, aberración cromática, scanlines y tinte por dimensión. |
| 3 | **CSS Animations** | [style.css](src/style.css) | Todo el interfaz es DOM: menú, título con glitch por `clip-path`, corazones que laten y se rompen, cartel de nivel, contador con "pop", flash de cambio, viñeta de daño. Más de 25 `@keyframes`. |
| 4 | **Phaser.js** | [GameScene.js](src/scenes/GameScene.js) | Motor: escenas, física Arcade, colisiones, cámara con deadzone, tweens, partículas y tilemap propio. |

Como extra, el sonido va con la **Web Audio API** ([Sonido.js](src/audio/Sonido.js)):
ni un solo archivo de audio, todo sintetizado con osciladores y filtros en
tiempo real.

> **Nota importante:** Phaser ya usa Canvas y WebGL por dentro
> (`type: Phaser.AUTO` intenta WebGL y cae a Canvas 2D si no hay soporte).
> Por eso las capas 1 y 2 están hechas *aparte* del motor: así cada
> tecnología tiene un uso propio y demostrable, no solapado.

## Los tres niveles

| # | Nombre | Qué introduce |
|---|---|---|
| 1 | **Primer contacto** | Tutorial. Antes de cada cambio de color hay un bloque sólido `#`, así que se puede cambiar con los pies en el suelo. Solo los dos últimos saltos obligan a cambiar en el aire. |
| 2 | **Sobre el abismo** | El suelo deja de ser continuo: hay pozos abiertos al vacío y se cruzan por puentes de A y B. Caer cuesta una vida. |
| 3 | **El vacío** | Casi no quedan bloques neutros: la mayoría de los cambios son en el aire, y debajo no hay suelo. |

Los niveles se desbloquean al completarse y el progreso se guarda en
`localStorage`. Desde el menú se puede saltar a cualquiera de los desbloqueados.

## Estructura

```
src/
├── main.js                  configuración de Phaser, menú y progresión de niveles
├── levels.js                los tres mapas ASCII (editables a mano)
├── progreso.js              niveles completados, guardados en localStorage
├── style.css                CAPA 3 — todas las animaciones CSS
├── audio/
│   └── Sonido.js            Web Audio: efectos y música sintetizados
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
| `M` | Silenciar |
| `R` | Reiniciar el nivel |

## Cómo editar los niveles

[`src/levels.js`](src/levels.js) es un array. Cada nivel tiene un `mapa` de
strings donde un carácter es un tile de 32px:

| Carácter | Significado |
|---|---|
| `#` | Bloque sólido en **ambas** dimensiones — sitio seguro para cambiar |
| `A` | Bloque sólo en dimensión LUZ |
| `B` | Bloque sólo en dimensión VACÍO |
| `P` | Spawn del jugador |
| `E` | Enemigo |
| `*` | Fragmento (hay que recogerlos todos para abrir la salida) |
| `X` | Salida |
| `.` | Aire. Si debajo no hay nada, caerse por ahí cuesta una vida |

Todas las filas de un nivel deben medir lo mismo.

## Detalles de diseño que merece la pena mirar

- **El sólido `#` es la red de seguridad.** Existe en las dos dimensiones, así
  que es el único sitio donde puedes cambiar sin caerte. La dificultad de los
  tres niveles se construye quitando bloques neutros.
- **Las plataformas inactivas no desaparecen**, se quedan al 13% de opacidad.
  Así puedes planear el salto *antes* de cambiar.
- **No puedes quedarte encajado**: si al cambiar fueras a aparecer dentro de un
  bloque, el cambio se rechaza con una sacudida (`quedariaAtrapado()`).
- **Salto con perdón**: *coyote time* (110ms para saltar después de salir de la
  plataforma) y *jump buffer* (130ms para registrar el salto antes de aterrizar).
- **Sin ningún archivo externo**: las texturas se generan con
  `Phaser.Graphics.generateTexture()` y los sonidos con osciladores de Web Audio.
  Por eso el juego entero cabe en un único HTML.
- **Si no hay WebGL** el juego funciona igual en Canvas 2D, sólo sin el shader.

## Entregar el juego

```bash
npm run entrega
```

Genera en `entrega/`:

- `FRACTURA.html` — el juego entero en un archivo. Doble clic y funciona, sin
  internet y sin instalar nada.
- `index.html` — idéntico, con el nombre que esperan GitHub Pages e itch.io.

Para actualizar la versión publicada:

```bash
npm run entrega && cp entrega/index.html docs/ && git add docs && git commit -m "actualizar build" && git push
```

## Ideas para ampliarlo

- Plataformas que se mueven, o que sólo aguantan unos segundos.
- Un tercer estado de dimensión.
- Contrarreloj y tabla de récords.
- Un editor de niveles que exporte directamente el formato de `levels.js`.
