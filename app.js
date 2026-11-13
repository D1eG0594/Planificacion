/* =========================================
   Simulador Planificación CPU - app.js
   Motor discreto tick a tick para FCFS, SJF, SRTF, Round Robin
   ========================================= */

const STATE = {
  tema: 'light',
  procesos: [], // {id, arrival, burst, blocks: [{trigger, dur}]}
  nextProcessId: 'A',
  velocidadPlay: 150, // ms por tick
  algoritmos: ['fcfs', 'sjf', 'srtf', 'rr'],
  simulaciones: {}, // por algoritmo: {gantt, stats, tickActual, finished, timeline}
  panelActivo: 'fcfs'
};

// Procesos por defecto (según especificación)
const PROCESOS_DEFAULT = [
  { id: 'A', arrival: 6, burst: 15, blocks: [{trigger: 3, dur: 3}, {trigger: 10, dur: 2}] },
  { id: 'B', arrival: 7, burst: 5, blocks: [{trigger: 1, dur: 6}, {trigger: 3, dur: 1}] },
  { id: 'C', arrival: 4, burst: 17, blocks: [{trigger: 1, dur: 5}, {trigger: 10, dur: 10}, {trigger: 15, dur: 3}] },
  { id: 'D', arrival: 5, burst: 8, blocks: [{trigger: 3, dur: 7}, {trigger: 5, dur: 4}] },
  { id: 'E', arrival: 2, burst: 11, blocks: [{trigger: 4, dur: 5}, {trigger: 10, dur: 1}] },
  { id: 'F', arrival: 1, burst: 20, blocks: [{trigger: 5, dur: 10}, {trigger: 10, dur: 7}, {trigger: 15, dur: 3}] },
  { id: 'G', arrival: 3, burst: 9, blocks: [{trigger: 5, dur: 15}] }
];

// ========== UTILIDADES DOM ==========
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// ========== TEMA ==========
function initTema() {
  const btn = $('#btnTheme');
  const temaGuardado = localStorage.getItem('so-tema') || 'light';
  STATE.tema = temaGuardado;
  document.documentElement.setAttribute('data-theme', STATE.tema);
  btn.textContent = STATE.tema === 'dark' ? '☀️' : '🌙';
  btn.addEventListener('click', () => {
    STATE.tema = STATE.tema === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', STATE.tema);
    localStorage.setItem('so-tema', STATE.tema);
    btn.textContent = STATE.tema === 'dark' ? '☀️' : '🌙';
  });
}

// ========== PESTAÑAS ==========
function initPestanas() {
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.tab-btn').forEach(b => {
        b.classList.remove('active');
        const panel = document.getElementById('panel-' + b.dataset.tab);
        if (panel) panel.style.display = 'none';
      });
      btn.classList.add('active');
      const panel = document.getElementById('panel-' + btn.dataset.tab);
      if (panel) panel.style.display = '';
      STATE.panelActivo = btn.dataset.tab;
      renderTodoAlgoritmo(btn.dataset.tab);
    });
  });
}

// ========== TABLA DE PROCESOS (Panel Superior) ==========
function initTablaProcesos() {
  $('#btnAddProcess').addEventListener('click', agregarProceso);
  $('#btnRestoreDefaults').addEventListener('click', restaurarProcesosDefault);
  // Delegación de eventos para inputs y botones de bloqueos
  $('#tbodyProcesos').addEventListener('input', (e) => {
    if (e.target.matches('input[data-field]')) {
      actualizarProcesoDesdeInput(e.target);
    }
  });
  $('#tbodyProcesos').addEventListener('click', (e) => {
    if (e.target.matches('.btn-del-bloqueo')) {
      eliminarBloqueo(e.target);
    }
    if (e.target.matches('.btn-add-bloqueo')) {
      agregarBloqueo(e.target);
    }
    if (e.target.matches('.btn-del-proceso')) {
      eliminarProceso(parseInt(e.target.dataset.idx));
    }
  });
}

function renderTablaProcesos() {
  const tbody = $('#tbodyProcesos');
  tbody.innerHTML = '';

  STATE.procesos.forEach((p, idx) => {
    const tr = document.createElement('tr');
    let bloquesHtml = '';
    p.blocks.forEach((b, bi) => {
      bloquesHtml += `
        <span class="bloqueo-item">
          <input type="number" class="small" data-field="b${bi}t" data-idx="${idx}" data-bidx="${bi}" value="${b.trigger}" min="1" max="${p.burst - 1}" />
          <span class="sep">,</span>
          <input type="number" class="small" data-field="b${bi}d" data-idx="${idx}" data-bidx="${bi}" value="${b.dur}" min="1" />
          <button type="button" class="btn-del-bloqueo" data-idx="${idx}" data-bidx="${bi}" title="Eliminar bloqueo">×</button>
        </span>
      `;
    });
    bloquesHtml += `<button type="button" class="btn-add-bloqueo" data-idx="${idx}">+ Bloqueo</button>`;

    tr.innerHTML = `
      <td><strong>${p.id}</strong></td>
      <td><input type="number" data-field="arrival" data-idx="${idx}" value="${p.arrival}" min="0" /></td>
      <td><input type="number" data-field="burst" data-idx="${idx}" value="${p.burst}" min="1" /></td>
      <td class="bloqueos-cell">${bloquesHtml}</td>
      <td><button type="button" class="btn-del-proceso secondary" data-idx="${idx}" title="Eliminar proceso">Eliminar</button></td>
    `;
    tbody.appendChild(tr);
  });
  actualizarNextProcessId();
}

function actualizarNextProcessId() {
  if (STATE.procesos.length === 0) {
    STATE.nextProcessId = 'A';
  } else {
    const last = STATE.procesos[STATE.procesos.length - 1].id;
    STATE.nextProcessId = String.fromCharCode(last.charCodeAt(0) + 1);
  }
}

function agregarProceso() {
  const nuevo = {
    id: STATE.nextProcessId,
    arrival: 0,
    burst: 5,
    blocks: []
  };
  STATE.procesos.push(nuevo);
  renderTablaProcesos();
  recalcularTodos();
}

function eliminarProceso(idx) {
  if (STATE.procesos.length <= 1) return;
  STATE.procesos.splice(idx, 1);
  // Reasignar IDs secuenciales
  STATE.procesos.forEach((p, i) => p.id = String.fromCharCode(65 + i));
  renderTablaProcesos();
  recalcularTodos();
}

function actualizarProcesoDesdeInput(input) {
  const idx = parseInt(input.dataset.idx);
  const field = input.dataset.field;
  const val = parseInt(input.value) || 0;
  const p = STATE.procesos[idx];
  if (!p) return;

  if (field === 'arrival') p.arrival = Math.max(0, val);
  if (field === 'burst') p.burst = Math.max(1, val);
  if (field.startsWith('b')) {
    const bidx = parseInt(input.dataset.bidx);
    if (!p.blocks[bidx]) p.blocks[bidx] = {trigger: 1, dur: 1};
    if (field.endsWith('t')) p.blocks[bidx].trigger = Math.max(1, Math.min(val, p.burst - 1));
    if (field.endsWith('d')) p.blocks[bidx].dur = Math.max(1, val);
  }
  // Validar triggers vs burst
  p.blocks.forEach(b => { if (b.trigger >= p.burst) b.trigger = p.burst - 1; });
  recalcularTodos();
}

function agregarBloqueo(btn) {
  const idx = parseInt(btn.dataset.idx);
  const p = STATE.procesos[idx];
  if (!p) return;
  p.blocks.push({trigger: 1, dur: 1});
  renderTablaProcesos();
  recalcularTodos();
}

function eliminarBloqueo(btn) {
  const idx = parseInt(btn.dataset.idx);
  const bidx = parseInt(btn.dataset.bidx);
  const p = STATE.procesos[idx];
  if (!p) return;
  p.blocks.splice(bidx, 1);
  renderTablaProcesos();
  recalcularTodos();
}

function restaurarProcesosDefault() {
  STATE.procesos = JSON.parse(JSON.stringify(PROCESOS_DEFAULT));
  STATE.nextProcessId = 'H';
  renderTablaProcesos();
  recalcularTodos();
}

// ========== MOTOR DE SIMULACIÓN ==========

function crearSimulacion(algoritmo) {
  // Clonar procesos
  const procs = STATE.procesos.map(p => ({
    id: p.id,
    arrival: p.arrival,
    burst: p.burst,
    blocks: p.blocks.map(b => ({trigger: b.trigger, dur: b.dur})),
    executed: 0,
    remaining: p.burst,
    finished: false,
    firstExecStart: null,
    nextBlockIdx: 0,
    blocked: false,
    blockRemaining: 0
  }));

  return {
    algoritmo,
    procs,
    gantt: [],
    tickActual: 0,
    finished: false,
    timeline: [],
    quantumRestante: 0,
    quantum: 3,
    usarPL: true
  };
}

function inicializarSimulaciones() {
  STATE.algoritmos.forEach(alg => {
    STATE.simulaciones[alg] = crearSimulacion(alg);
  });
  // Leer quantum y PL de RR
  const rrSim = STATE.simulaciones.rr;
  rrSim.quantum = parseInt($('#quantumRR')?.value) || 3;
  rrSim.usarPL = $('#usarPLRR')?.checked !== false;
}

function recalcularTodos() {
  // Reiniciar todas las simulaciones
  STATE.algoritmos.forEach(alg => {
    STATE.simulaciones[alg] = crearSimulacion(alg);
  });
  const rrSim = STATE.simulaciones.rr;
  rrSim.quantum = parseInt($('#quantumRR')?.value) || 3;
  rrSim.usarPL = $('#usarPLRR')?.checked !== false;
  // Renderizar pestaña activa
  renderTodoAlgoritmo(STATE.panelActivo);
}

// Avanzar un tick en la simulación
function pasoTick(sim) {
  const t = sim.tickActual;
  const procs = sim.procs;

  // 1. Llegadas: procesos que llegan en este tick entran a cola
  procs.filter(p => p.arrival === t && !p.finished && !p.blocked)
    .forEach(p => { if (!sim.colaListos?.includes(p)) (sim.colaListos = sim.colaListos || []).push(p); });

  // 2. Liberados de bloqueo
  if (sim.bloqueados) {
    const liberados = sim.bloqueados.filter(b => {
      b.remaining--;
      return b.remaining > 0;
    });
    const recienLiberados = sim.bloqueados.filter(b => b.remaining <= 0);
    recienLiberados.forEach(b => {
      const p = procs.find(x => x.id === b.id);
      if (p) { p.blocked = false; p.blockRemaining = 0; }
      if (!sim.colaListos?.includes(p)) (sim.colaListos = sim.colaListos || []).push(p);
    });
    sim.bloqueados = liberados;
  } else {
    sim.bloqueados = [];
  }

  // 3. Verificar bloqueo del proceso en CPU
  if (sim.enCPU && !sim.enCPU.finished) {
    const nextBlock = sim.enCPU.blocks[sim.enCPU.nextBlockIdx];
    if (nextBlock && sim.enCPU.executed >= nextBlock.trigger) {
      sim.enCPU.blocked = true;
      sim.enCPU.blockRemaining = nextBlock.dur;
      sim.enCPU.nextBlockIdx++;
      sim.bloqueados.push({id: sim.enCPU.id, remaining: nextBlock.dur});
      sim.enCPU = null;
    }
  }

  // 4. Lógica específica por algoritmo
  switch (sim.algoritmo) {
    case 'fcfs': pasoFCFS(sim, t); break;
    case 'sjf': pasoSJF(sim, t); break;
    case 'srtf': pasoSRTF(sim, t); break;
    case 'rr': pasoRR(sim, t); break;
  }

  // 5. Registrar gantt y timeline
  sim.gantt[t] = {
    enCPU: sim.enCPU ? sim.enCPU.id : null,
    cola: (sim.colaListos || []).map(p => p.id),
    bloqueados: (sim.bloqueados || []).map(b => b.id),
    esPL: sim.esPL || false
  };
  sim.timeline.push({
    tick: t,
    enCPU: sim.enCPU ? sim.enCPU.id : (sim.esPL ? 'PL' : null),
    cola: (sim.colaListos || []).map(p => p.id),
    bloqueados: (sim.bloqueados || []).map(b => ({id: b.id, rem: b.remaining}))
  });

  sim.tickActual++;

  // Verificar fin
  const allFinished = procs.every(p => p.finished) && (!sim.bloqueados || sim.bloqueados.length === 0) && (!sim.colaListos || sim.colaListos.length === 0);
  if (allFinished) sim.finished = true;

  return !sim.finished;
}

function pasoFCFS(sim, t) {
  if (!sim.colaListos) sim.colaListos = [];
  // Si CPU libre y hay listos, tomar el primero
  if (!sim.enCPU && sim.colaListos.length > 0) {
    sim.enCPU = sim.colaListos.shift();
    if (sim.enCPU.firstExecStart === null) sim.enCPU.firstExecStart = t;
  }
  // Ejecutar
  if (sim.enCPU) {
    sim.enCPU.executed++;
    sim.enCPU.remaining--;
    if (sim.enCPU.remaining <= 0) {
      sim.enCPU.finished = true;
      sim.enCPU = null;
    }
  }
}

function pasoSJF(sim, t) {
  if (!sim.colaListos) sim.colaListos = [];
  // Si CPU libre, elegir menor burst total
  if (!sim.enCPU && sim.colaListos.length > 0) {
    sim.colaListos.sort((a, b) => a.burst - b.burst || a.id.localeCompare(b.id));
    sim.enCPU = sim.colaListos.shift();
    if (sim.enCPU.firstExecStart === null) sim.enCPU.firstExecStart = t;
  }
  // Ejecutar
  if (sim.enCPU) {
    sim.enCPU.executed++;
    sim.enCPU.remaining--;
    if (sim.enCPU.remaining <= 0) {
      sim.enCPU.finished = true;
      sim.enCPU = null;
    }
  }
}

function pasoSRTF(sim, t) {
  if (!sim.colaListos) sim.colaListos = [];
  // Candidatos: los listos + el que está en CPU
  const candidatos = [...(sim.colaListos || [])];
  if (sim.enCPU && !sim.enCPU.finished) candidatos.push(sim.enCPU);
  if (candidatos.length > 0) {
    candidatos.sort((a, b) => a.remaining - b.remaining || a.id.localeCompare(b.id));
    const elegido = candidatos[0];
    // Expropiar si es diferente
    if (sim.enCPU && sim.enCPU.id !== elegido.id) {
      if (!sim.enCPU.finished && !sim.enCPU.blocked) {
        if (!sim.colaListos.includes(sim.enCPU)) sim.colaListos.push(sim.enCPU);
      }
      sim.enCPU = null;
    }
    if (!sim.enCPU) {
      sim.enCPU = elegido;
      sim.colaListos = sim.colaListos.filter(p => p.id !== elegido.id);
      if (sim.enCPU.firstExecStart === null) sim.enCPU.firstExecStart = t;
    }
  }
  // Ejecutar
  if (sim.enCPU) {
    sim.enCPU.executed++;
    sim.enCPU.remaining--;
    if (sim.enCPU.remaining <= 0) {
      sim.enCPU.finished = true;
      sim.enCPU = null;
    }
  }
}

function pasoRR(sim, t) {
  if (!sim.colaListos) sim.colaListos = [];
  const Q = sim.quantum;
  const usarPL = sim.usarPL;

  // Inicializar quantumRestante si es 0 (primera vez)
  if (sim.quantumRestante <= 0) sim.quantumRestante = Q;

  // 1. Si no hay proceso en CPU y hay listos, verificar si necesita PL
  if (!sim.enCPU && sim.colaListos.length > 0) {
    if (usarPL) {
      // Tick de PL
      sim.esPL = true;
      return;
    }
    // Sin PL, asignar directamente
    sim.enCPU = sim.colaListos.shift();
    if (sim.enCPU.firstExecStart === null) sim.enCPU.firstExecStart = t;
    sim.quantumRestante = Q;
  }

  // 2. Si venimos de un tick PL, ahora asignar CPU
  if (sim.esPL) {
    sim.esPL = false;
    if (sim.colaListos.length > 0) {
      sim.enCPU = sim.colaListos.shift();
      if (sim.enCPU.firstExecStart === null) sim.enCPU.firstExecStart = t;
      sim.quantumRestante = Q;
    }
    return;
  }

  // 3. Ejecutar proceso en CPU
  if (sim.enCPU) {
    sim.enCPU.executed++;
    sim.enCPU.remaining--;
    sim.quantumRestante--;

    if (sim.enCPU.remaining <= 0) {
      sim.enCPU.finished = true;
      sim.enCPU = null;
      sim.quantumRestante = Q;
    } else if (sim.quantumRestante <= 0 && sim.colaListos.length > 0) {
      // Quantum agotado, hay otros esperando
      if (!sim.enCPU.finished && !sim.enCPU.blocked) {
        sim.colaListos.push(sim.enCPU);
      }
      sim.enCPU = null;
      sim.quantumRestante = Q;
    }
  }
}

// ========== ESTADÍSTICAS ==========

function calcularEstadisticas(sim) {
  const procs = sim.procs;
  const gantt = sim.gantt;

  const porProceso = {};
  let totalEjecucion = 0, totalRetorno = 0, totalEspera = 0, totalPerdido = 0, totalPenalidad = 0, totalRespuesta = 0;

  procs.forEach(p => {
    const ejecucion = p.burst;
    let bloqueo = 0;
    p.blocks.forEach(b => bloqueo += b.dur);

    // Instante fin (If): último tick con verde -> fin = tick + 1
    let fin = p.arrival;
    for (let t = 0; t < gantt.length; t++) {
      if (gantt[t] && gantt[t].enCPU === p.id) fin = t + 1;
    }

    const retorno = fin - p.arrival;
    const espera = retorno - ejecucion - bloqueo;
    const perdido = retorno - ejecucion;
    const penalidad = ejecucion > 0 ? (retorno / ejecucion) : 0;
    const respuesta = p.firstExecStart !== null ? p.firstExecStart - p.arrival : 0;

    porProceso[p.id] = { ejecucion, espera, bloqueo, fin, retorno, perdido, penalidad, respuesta };
    totalEjecucion += ejecucion;
    totalRetorno += retorno;
    totalEspera += espera;
    totalPerdido += perdido;
    totalPenalidad += penalidad;
    totalRespuesta += respuesta;
  });

  // Ticks PL en RR
  let ticksPL = 0;
  if (sim.algoritmo === 'rr') {
    ticksPL = gantt.filter(g => g && g.esPL).length;
  }

  const n = procs.length;
  const usoTotal = totalEjecucion + ticksPL;
  // Tiempo encendido = máximo If entre todos los procesos
  const tiempoEncendido = Math.max(...Object.values(porProceso).map(s => s.fin));
  const cpuDesocupada = tiempoEncendido - usoTotal;
  const pctUsoCPU = tiempoEncendido > 0 ? ((usoTotal / tiempoEncendido) * 100) : 0;

  sim.stats = {
    porProceso,
    globales: {
      tiempoEncendido,
      usoTotal,
      ticksPL,
      cpuDesocupada,
      promRetorno: totalRetorno / n,
      promEjecucion: totalEjecucion / n,
      promEspera: totalEspera / n,
      promPerdido: totalPerdido / n,
      promPenalidad: totalPenalidad / n,
      promRespuesta: totalRespuesta / n,
      pctUsoCPU
    }
  };
}

// ========== RENDERIZADO ==========

function renderTodoAlgoritmo(algoritmo) {
  const sim = STATE.simulaciones[algoritmo];
  if (!sim) return;
  renderControles(algoritmo);
  renderGantt(algoritmo);
  renderStats(algoritmo);
  actualizarRelojIndicador(algoritmo);
}

function renderControles(algoritmo) {
  const cont = $(`#controls-${algoritmo}`);
  const sim = STATE.simulaciones[algoritmo];
  const isRR = algoritmo === 'rr';

  let html = `
    <div class="control-group">
      <button class="btn secondary" id="btnReset-${algoritmo}" title="Reiniciar (t=0)">⏮ Reiniciar</button>
      <button class="btn secondary" id="btnPrev-${algoritmo}" title="Paso anterior (-1 Tick)" ${sim.tickActual <= 0 ? 'disabled' : ''}>⏪ -1 Tick</button>
      <button class="btn secondary" id="btnNext-${algoritmo}" title="Siguiente paso (+1 Tick)" ${sim.finished ? 'disabled' : ''}>+1 Tick ⏩</button>
      <button class="btn primary" id="btnPlay-${algoritmo}" title="Ejecutar/Pausar">${sim.playing ? '⏸ Pausa' : '▶ Ejecutar'}</button>
      <button class="btn secondary" id="btnFinish-${algoritmo}" title="Completar todo (Ir al final)" ${sim.finished ? 'disabled' : ''}>⏭ Ir al final</button>
    </div>
  `;

  if (isRR) {
    html += `
      <div class="control-group">
        <label>Quantum Q:</label>
        <input type="number" id="quantumRR" value="${sim.quantum}" min="1" max="20" style="width:60px;" />
      </div>
      <div class="control-group">
        <label><input type="checkbox" id="usarPLRR" ${sim.usarPL ? 'checked' : ''} /> Incluir Dispatcher (PL = 1 tick)</label>
      </div>
    `;
  }

  html += `
    <div class="control-group">
      <label>Velocidad:</label>
      <select id="speedSelect-${algoritmo}">
        <option value="150" ${STATE.velocidadPlay === 150 ? 'selected' : ''}>Normal (150 ms)</option>
        <option value="70" ${STATE.velocidadPlay === 70 ? 'selected' : ''}>Rápido (70 ms)</option>
        <option value="25" ${STATE.velocidadPlay === 25 ? 'selected' : ''}>Muy rápido (25 ms)</option>
      </select>
    </div>
    <div class="clock-indicator" id="clock-${algoritmo}">Tiempo actual: 0 / 0</div>
  `;

  cont.innerHTML = html;

  // Eventos
  $(`#btnReset-${algoritmo}`).onclick = () => { resetSimulacion(algoritmo); };
  $(`#btnPrev-${algoritmo}`).onclick = () => { pasoAnterior(algoritmo); };
  $(`#btnNext-${algoritmo}`).onclick = () => { pasoSiguiente(algoritmo); };
  $(`#btnPlay-${algoritmo}`).onclick = () => { togglePlay(algoritmo); };
  $(`#btnFinish-${algoritmo}`).onclick = () => { ejecutarHastaElFinal(algoritmo); };

  if (isRR) {
    $('#quantumRR').onchange = () => { resetSimulacion(algoritmo); };
    $('#usarPLRR').onchange = () => { resetSimulacion(algoritmo); };
  }
  $(`#speedSelect-${algoritmo}`).onchange = (e) => {
    STATE.velocidadPlay = parseInt(e.target.value);
    // Actualizar todos los selects
    STATE.algoritmos.forEach(a => {
      const sel = $(`#speedSelect-${a}`);
      if (sel) sel.value = STATE.velocidadPlay;
    });
  };
}

function resetSimulacion(algoritmo) {
  const sim = STATE.simulaciones[algoritmo];
  if (sim.playing) { sim.playing = false; clearInterval(sim.timerPlay); }
  STATE.simulaciones[algoritmo] = crearSimulacion(algoritmo);
  if (algoritmo === 'rr') {
    const qInput = $('#quantumRR');
    const plInput = $('#usarPLRR');
    STATE.simulaciones.rr.quantum = qInput ? parseInt(qInput.value) || 3 : 3;
    STATE.simulaciones.rr.usarPL = plInput ? plInput.checked : true;
  }
  renderTodoAlgoritmo(algoritmo);
}

function pasoAnterior(algoritmo) {
  const sim = STATE.simulaciones[algoritmo];
  if (sim.tickActual <= 0) return;
  // Para retroceder, la forma más simple es resetear y avanzar hasta tickActual - 1
  const targetTick = sim.tickActual - 1;
  resetSimulacion(algoritmo);
  const newSim = STATE.simulaciones[algoritmo];
  for (let i = 0; i < targetTick; i++) pasoTick(newSim);
  if (!newSim.finished) calcularEstadisticas(newSim);
  renderTodoAlgoritmo(algoritmo);
}

function pasoSiguiente(algoritmo) {
  const sim = STATE.simulaciones[algoritmo];
  if (sim.finished) return;
  pasoTick(sim);
  if (!sim.finished) calcularEstadisticas(sim);
  renderTodoAlgoritmo(algoritmo);
}

function togglePlay(algoritmo) {
  const sim = STATE.simulaciones[algoritmo];
  if (sim.playing) {
    sim.playing = false;
    clearInterval(sim.timerPlay);
  } else {
    sim.playing = true;
    sim.timerPlay = setInterval(() => {
      if (sim.finished || !pasoTick(sim)) {
        clearInterval(sim.timerPlay);
        sim.timerPlay = null;
        sim.playing = false;
        calcularEstadisticas(sim);
      }
      renderTodoAlgoritmo(algoritmo);
    }, STATE.velocidadPlay);
  }
  renderControles(algoritmo);
}

function ejecutarHastaElFinal(algoritmo) {
  const sim = STATE.simulaciones[algoritmo];
  if (sim.playing) { togglePlay(algoritmo); }
  while (!sim.finished) pasoTick(sim);
  calcularEstadisticas(sim);
  renderTodoAlgoritmo(algoritmo);
}

function actualizarRelojIndicador(algoritmo) {
  const sim = STATE.simulaciones[algoritmo];
  const cont = $(`#clock-${algoritmo}`);
  if (!cont) return;
  const total = sim.stats?.globales?.tiempoEncendido || sim.tickActual;
  let cpuInfo = '';
  if (sim.timeline.length > 0) {
    const last = sim.timeline[sim.timeline.length - 1];
    const cpu = last.enCPU || '—';
    const cola = last.cola.length ? '[' + last.cola.join(', ') + ']' : 'vacía';
    cpuInfo = ` | CPU: ${cpu} | Listos: ${cola}`;
  }
  cont.textContent = `Tiempo actual: ${sim.tickActual} / ${total}${cpuInfo}`;
}

// ========== GANTT ==========

function renderGantt(algoritmo) {
  const cont = $(`#gantt-${algoritmo}`);
  const sim = STATE.simulaciones[algoritmo];
  if (!cont || !sim) return;

  const procs = STATE.procesos.map(p => p.id);
  const isRR = algoritmo === 'rr';
  const rows = isRR ? ['PL', ...procs] : procs;

  // Número total de columnas = ticks mostrados + 1 (columna 0 vacía al inicio)
  // El eje X muestra 0, 1, 2, ... hasta tickActual
  const maxTick = Math.max(sim.tickActual, 0);
  const cols = maxTick + 1; // columnas para ticks 0..maxTick

  let html = '<div class="gantt-grid">';

  // Filas de procesos (y PL para RR)
  rows.forEach(rowId => {
    const isPL = rowId === 'PL';
    html += '<div class="gantt-row">';
    // Etiqueta del proceso a la izquierda
    html += `<div class="gantt-cell label ${isPL ? 'pl-label' : ''}">${rowId}</div>`;
    for (let c = 0; c < cols; c++) {
      let estado = 'vacio';
      const t = c; // columna c = tiempo t (intervalo [t-1, t] pero mostramos t)
      // Antes de la llegada del proceso: vacío
      if (!isPL && t < STATE.procesos.find(p => p.id === rowId).arrival) {
        estado = 'vacio';
      } else {
        const g = sim.gantt[t];
        if (g) {
          if (isPL) {
            if (g.esPL) estado = 'pl';
          } else {
            if (g.enCPU === rowId) estado = 'ejecutando';
            else if (g.cola.includes(rowId)) estado = 'listo';
            else if (g.bloqueados.includes(rowId)) estado = 'bloqueado';
          }
        }
      }
      // Para fila PL, mostrar número "1" dentro de celda azul
      let contenido = '';
      if (estado === 'pl') contenido = '1';
      html += `<div class="gantt-cell estado-${estado}" title="${rowId} t=${t}: ${estado}">${contenido}</div>`;
    }
    html += '</div>';
  });

  html += '</div>';

  // Línea de tiempo inferior (eje X con números 0, 1, 2...)
  html += '<div class="gantt-timeline">';
  for (let c = 0; c < cols; c++) {
    html += `<div class="gantt-timeline-cell">${c}</div>`;
  }
  html += '</div>';

  cont.innerHTML = html;
}

// ========== ESTADÍSTICAS ==========

function renderStats(algoritmo) {
  const cont = $(`#stats-${algoritmo}`);
  const sim = STATE.simulaciones[algoritmo];
  if (!cont || !sim || !sim.stats) {
    cont.innerHTML = '<p style="color:var(--text-muted); padding:1rem;">Ejecute la simulación para ver estadísticas.</p>';
    return;
  }

  const st = sim.stats;
  const g = st.globales;
  const pp = st.porProceso;
  const isRR = algoritmo === 'rr';

  let html = '<h3>Estadísticas por Proceso</h3>';
  html += '<div class="table-wrap"><table>';
  html += '<thead><tr>';
  html += '<th>Proceso</th>';
  html += '<th class="num">Ejecución (t)</th>';
  html += '<th class="num">Espera</th>';
  html += '<th class="num">Bloqueo</th>';
  html += '<th class="num">I<sub>f</sub></th>';
  html += '<th class="num">Retorno (T)</th>';
  html += '<th class="num">T. perdido</th>';
  html += '<th class="num">Penalidad (Ip)</th>';
  html += '<th class="num">T. respuesta (Tr)</th>';
  html += '<th class="num">% uso CPU</th>';
  html += '</tr></thead><tbody>';

  STATE.procesos.forEach(p => {
    const s = pp[p.id];
    if (!s) return;
    const pctCPU = g.tiempoEncendido > 0 ? ((s.ejecucion / g.tiempoEncendido) * 100).toFixed(2) : '0.00';
    html += `<tr>
      <td><strong>${p.id}</strong></td>
      <td class="num">${s.ejecucion}</td>
      <td class="num">${s.espera}</td>
      <td class="num">${s.bloqueo}</td>
      <td class="num">${s.fin}</td>
      <td class="num">${s.retorno}</td>
      <td class="num">${s.perdido}</td>
      <td class="num">${s.penalidad.toFixed(3)}</td>
      <td class="num">${s.respuesta}</td>
      <td class="num">${pctCPU}%</td>
    </tr>`;
  });

  // Fila PL en RR
  if (isRR && g.ticksPL > 0) {
    const pctPL = g.tiempoEncendido > 0 ? ((g.ticksPL / g.tiempoEncendido) * 100).toFixed(2) : '0.00';
    html += `<tr class="pl-row">
      <td><strong>PL</strong></td>
      <td class="num">—</td><td class="num">—</td><td class="num">—</td><td class="num">—</td>
      <td class="num">—</td><td class="num">—</td><td class="num">—</td><td class="num">—</td>
      <td class="num">${pctPL}%</td>
    </tr>`;
  }

  html += '</tbody></table></div>';

  // Métricas globales
  html += '<h3 style="margin-top:1rem;">Resumen del Sistema</h3>';
  html += '<div class="metrics-grid">';
  html += `<div class="metric-item"><div class="metric-label">Tiempo encendido</div><div class="metric-value">${g.tiempoEncendido}</div></div>`;
  html += `<div class="metric-item"><div class="metric-label">Uso total CPU</div><div class="metric-value">${g.usoTotal}</div></div>`;
  if (isRR) html += `<div class="metric-item"><div class="metric-label">Uso CPU dispatcher (PL)</div><div class="metric-value">${g.ticksPL}</div></div>`;
  html += `<div class="metric-item"><div class="metric-label">CPU desocupada</div><div class="metric-value">${g.cpuDesocupada}</div></div>`;
  html += `<div class="metric-item"><div class="metric-label">Promedio retorno</div><div class="metric-value">${g.promRetorno.toFixed(2)}</div></div>`;
  html += `<div class="metric-item"><div class="metric-label">Promedio ejecución</div><div class="metric-value">${g.promEjecucion.toFixed(2)}</div></div>`;
  html += `<div class="metric-item"><div class="metric-label">Promedio espera</div><div class="metric-value">${g.promEspera.toFixed(2)}</div></div>`;
  html += `<div class="metric-item"><div class="metric-label">Promedio tiempo perdido</div><div class="metric-value">${g.promPerdido.toFixed(2)}</div></div>`;
  html += `<div class="metric-item"><div class="metric-label">Promedio penalidad</div><div class="metric-value">${g.promPenalidad.toFixed(3)}</div></div>`;
  html += `<div class="metric-item"><div class="metric-label">Promedio t. respuesta</div><div class="metric-value">${g.promRespuesta.toFixed(2)}</div></div>`;
  html += `<div class="metric-item"><div class="metric-label">% Uso CPU</div><div class="metric-value">${g.pctUsoCPU.toFixed(2)}%</div></div>`;
  html += '</div>';

  cont.innerHTML = html;
}

// ========== INICIALIZACIÓN ==========

document.addEventListener('DOMContentLoaded', () => {
  initTema();
  initPestanas();
  initTablaProcesos();

  // Cargar procesos por defecto
  STATE.procesos = JSON.parse(JSON.stringify(PROCESOS_DEFAULT));
  STATE.nextProcessId = 'H';
  renderTablaProcesos();

  // Inicializar simulaciones
  inicializarSimulaciones();

  // Render inicial
  renderTodoAlgoritmo('fcfs');
});