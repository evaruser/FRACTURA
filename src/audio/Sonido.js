/* ============================================================
   SONIDO — Web Audio API, todo sintetizado en tiempo real.
   Ni un solo archivo de audio: el juego tiene que seguir
   cabiendo en un unico HTML autocontenido. Cada efecto se
   construye con osciladores, filtros y envolventes de ganancia.
   ============================================================ */

const nota = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

// Escalas pentatonicas: una por dimension. La del VACIO va mas
// grave y usa el modo menor, para que suene mas turbia.
const ESCALAS = {
  LUZ:   [57, 60, 62, 64, 67, 69, 72, 74],
  VACIO: [53, 56, 58, 60, 63, 65, 68, 70],
};
const PATRON = [0, 2, 4, 2, 5, 4, 2, 1];

/* localStorage lanza excepcion en navegacion privada y en algunos
   contextos con las cookies bloqueadas. Nunca debe tumbar el juego. */
const guardar = (clave, valor) => { try { localStorage.setItem(clave, valor); } catch { /* da igual */ } };
const leer = (clave) => { try { return localStorage.getItem(clave); } catch { return null; } };

export default class Sonido {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.busSfx = null;
    this.busMusica = null;
    this.ruido = null;

    this.silencio = leer('fractura:silencio') === '1';
    this.dimension = 'LUZ';

    this._temporizador = null;
    this._siguienteNota = 0;
    this._paso = 0;
  }

  /** Debe llamarse DESDE un gesto del usuario (click en JUGAR):
   *  los navegadores bloquean el audio hasta que lo hay. */
  iniciar() {
    if (this.ctx) { this.ctx.resume(); return; }

    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;                       // navegador sin Web Audio: el juego sigue
    this.ctx = new AC();

    this.master = this.ctx.createGain();
    this.master.gain.value = this.silencio ? 0 : 0.9;
    this.master.connect(this.ctx.destination);

    this.busSfx = this.ctx.createGain();
    this.busSfx.gain.value = 0.42;
    this.busSfx.connect(this.master);

    this.busMusica = this.ctx.createGain();
    this.busMusica.gain.value = 0.10;      // la musica va MUY por debajo de los efectos
    this.busMusica.connect(this.master);

    this.ruido = this._crearRuido();
    this._arrancarMusica();
  }

  alternarSilencio() {
    this.silencio = !this.silencio;
    guardar('fractura:silencio', this.silencio ? '1' : '0');
    if (this.master) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(this.silencio ? 0 : 0.9, t, 0.05);
    }
    return this.silencio;
  }

  /* ---------- utilidades de sintesis ---------- */

  /** Buffer de ruido blanco de 1s, reutilizado por todos los efectos. */
  _crearRuido() {
    const n = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, n, n);
    const datos = buf.getChannelData(0);
    for (let i = 0; i < n; i++) datos[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** Un oscilador con envolvente ADSR simplificada (ataque + caida). */
  _tono({ tipo = 'sine', f0, f1, dur = 0.2, vol = 0.5, ataque = 0.005, destino, curva = 'exp' }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    osc.type = tipo;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== undefined && f1 !== f0) {
      if (curva === 'exp') osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
      else osc.frequency.linearRampToValueAtTime(f1, t + dur);
    }

    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(g).connect(destino || this.busSfx);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** Golpe de ruido filtrado: para impactos y texturas. */
  _golpeRuido({ dur = 0.15, vol = 0.4, f0 = 2000, f1 = 300, q = 1, tipo = 'lowpass' }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.ruido;

    const filtro = this.ctx.createBiquadFilter();
    filtro.type = tipo;
    filtro.Q.value = q;
    filtro.frequency.setValueAtTime(f0, t);
    filtro.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    src.connect(filtro).connect(g).connect(this.busSfx);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  /* ---------- efectos del juego ---------- */

  salto() {
    this._tono({ tipo: 'triangle', f0: 320, f1: 680, dur: 0.13, vol: 0.32, ataque: 0.004 });
    this._golpeRuido({ dur: 0.06, vol: 0.10, f0: 1800, f1: 600 });
  }

  aterrizar() {
    this._tono({ tipo: 'sine', f0: 160, f1: 55, dur: 0.11, vol: 0.30 });
    this._golpeRuido({ dur: 0.07, vol: 0.14, f0: 900, f1: 150 });
  }

  fragmento() {
    // Dos blips: el segundo una quinta arriba, con 60ms de retraso.
    this._tono({ tipo: 'sine', f0: 990, f1: 990, dur: 0.09, vol: 0.26 });
    setTimeout(() => this._tono({ tipo: 'sine', f0: 1480, f1: 1480, dur: 0.14, vol: 0.22 }), 62);
  }

  /** @param {'LUZ'|'VACIO'} destino */
  cambio(destino) {
    const subiendo = destino === 'LUZ';
    this._golpeRuido({
      dur: 0.32, vol: 0.30, q: 6, tipo: 'bandpass',
      f0: subiendo ? 300 : 2600, f1: subiendo ? 3200 : 260,
    });
    this._tono({
      tipo: 'sawtooth', dur: 0.26, vol: 0.14,
      f0: subiendo ? 180 : 520, f1: subiendo ? 520 : 150,
    });
  }

  bloqueado() {
    this._tono({ tipo: 'square', f0: 108, f1: 84, dur: 0.16, vol: 0.20 });
  }

  dano() {
    this._tono({ tipo: 'sawtooth', f0: 420, f1: 90, dur: 0.34, vol: 0.30 });
    this._golpeRuido({ dur: 0.20, vol: 0.20, f0: 1400, f1: 200 });
  }

  pisoton() {
    this._tono({ tipo: 'square', f0: 520, f1: 130, dur: 0.14, vol: 0.24 });
    this._golpeRuido({ dur: 0.10, vol: 0.18, f0: 2200, f1: 400 });
  }

  caer() {
    this._tono({ tipo: 'sine', f0: 520, f1: 48, dur: 0.75, vol: 0.30 });
  }

  /** Arpegio ascendente al completar nivel. */
  victoria() {
    [0, 4, 7, 12, 16].forEach((semis, i) => {
      setTimeout(() => this._tono({
        tipo: 'triangle', f0: nota(64 + semis), f1: nota(64 + semis),
        dur: 0.42, vol: 0.26, ataque: 0.008,
      }), i * 105);
    });
  }

  /** Arpegio descendente y desafinado al perder. */
  derrota() {
    [0, -3, -7, -12].forEach((semis, i) => {
      setTimeout(() => this._tono({
        tipo: 'sawtooth', f0: nota(60 + semis), f1: nota(60 + semis - 1),
        dur: 0.55, vol: 0.20,
      }), i * 155);
    });
  }

  /* ---------- musica de fondo ---------- */

  /** Programador con ventana de anticipacion: setInterval no es
   *  preciso, asi que solo decide QUE nota suena y se la encarga al
   *  reloj de Web Audio, que si lo es. */
  _arrancarMusica() {
    if (this._temporizador) return;
    this._siguienteNota = this.ctx.currentTime + 0.1;
    this._temporizador = setInterval(() => this._programar(), 40);
  }

  _programar() {
    if (!this.ctx) return;
    const ahora = this.ctx.currentTime;
    const duracionPaso = 0.30;               // ~100 BPM en corcheas

    // Si la pestana estuvo oculta, setInterval se frena y nos
    // quedamos atras: resincronizamos en vez de soltar 200 notas.
    if (this._siguienteNota < ahora - 0.5) this._siguienteNota = ahora + 0.05;

    while (this._siguienteNota < ahora + 0.15) {
      this._notaMusica(this._siguienteNota, this._paso);
      this._siguienteNota += duracionPaso;
      this._paso++;
    }
  }

  _notaMusica(cuando, paso) {
    const escala = ESCALAS[this.dimension];
    const grado = PATRON[paso % PATRON.length];
    const octava = Math.floor(paso / PATRON.length) % 2 === 1 ? 12 : 0;

    // Arpegio
    this._notaProgramada({
      freq: nota(escala[grado] + octava), cuando,
      dur: 0.28, vol: 0.16, tipo: 'triangle',
    });

    // Bajo en el primer tiempo de cada compas
    if (paso % 8 === 0) {
      this._notaProgramada({
        freq: nota(escala[0] - 12), cuando,
        dur: 0.9, vol: 0.26, tipo: 'sine',
      });
    }
  }

  _notaProgramada({ freq, cuando, dur, vol, tipo }) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(freq, cuando);
    g.gain.setValueAtTime(0.0001, cuando);
    g.gain.linearRampToValueAtTime(vol, cuando + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, cuando + dur);
    osc.connect(g).connect(this.busMusica);
    osc.start(cuando);
    osc.stop(cuando + dur + 0.02);
  }

  /** La musica cambia de escala con la dimension. */
  setDimension(dim) { this.dimension = dim; }
}

export const sonido = new Sonido();
