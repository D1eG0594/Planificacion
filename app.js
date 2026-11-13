/* =========================================
   Simulador SO - app.js (Paso 1)
   Motor base: datos, UI, navegación, memoria
   ========================================= */

const STATE = {
  tema: 'light',
  ramTotalMiB: 16,
  exeHeader: 2544,
  stackSize: 65536,
  heapSize: 131072,
  numTiempos: 5,

  // Programas: ID, nombre, disco, text, data
  programas: [
    { id: 'A', nombre: 'Chrome', disco: 3220120, text: 2599742, data: 532238 },
    { id: 'B', nombre: 'Calendario', disco: 54877, text: 51248, data: 563 },
    { id: 'C', nombre: 'Discord', disco: 579299, text: 52322, data: 496571 },
    { id: 'D', nombre: 'Photoshop', disco: 1317966, text: 1154894, data: 154362 },
    { id: 'E', nombre: 'VS Code', disco: 2025093, text: 1874529, data: 124032 },
    { id: 'F', nombre: 'Karpersky', disco: 865237, text: 452963, data: 405477 },
    { id: 'G', nombre: 'Word', disco: 1639224, text: 1254308, data: 254987 }
  ],

  // Matriz: { tiempo: { procesoId: valor } }  valor: '' vacío, número entrada, 'x' salida
  matriz: {},

  // Procesos CPU (compartido por los 4 algoritmos)
  procesosCPU: [
    { id: 'A', arrival: 6, burst: 15, blocks: [{ trigger: 3, dur: 3 }, { trigger: 10, dur: 2 }] },
    { id: 'B', arrival: 7, burst: 5, blocks: [{ trigger: 1, dur: 6 }, { trigger: 3, dur: 1 }] },
    { id: 'C', arrival: 4, burst: 17, blocks: [{ trigger: 1, dur: 5 }, { trigger: 10, dur: 10 }, { trigger: 15, dur: 3 }] },
    { id: 'D', arrival: 5, burst: 8, blocks: [{ trigger: 3, dur: 7 }, { trigger: 5, dur: 4 }] },
    { id: 'E', arrival: 2, burst: 11, blocks: [{ trigger: 4, dur: 5 }, { trigger: 10, dur: 1 }] },
    { id: 'F', arrival: 1, burst: 20, blocks: [{ trigger: 5, dur: 10 }, { trigger: 10, dur: 7 }, { trigger: 15, dur: 3 }] },
    { id: 'G', arrival: 3, burst: 9, blocks: [{ trigger: 5, dur: 15 }] }
  ],

  quantum: 3,
  usarPL: true,

  // Resultados calculados
  resultados: {}
};

// ========== UTILIDADES DOM ==========
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function formatoNumero(n) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ========== TEMA CLARO/OSCURO ==========
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

// ========== NAVEGACIÓN POR PESTAÑAS ==========
function initPestanas() {
  const btns = $$('.tab-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Desactivar todas
      btns.forEach(b => {
        b.classList.remove('active');
        const panel = document.getElementById('panel-' + b.dataset.tab);
        if (panel) panel.style.display = 'none';
      });
      // Activar seleccionada
      btn.classList.add('active');
      const panel = document.getElementById('panel-' + btn.dataset.tab);
      if (panel) panel.style.display = '';
      // Si es comparativo, renderizar
      if (btn.dataset.tab === 'comparativo') renderComparativo();
    });
  });
}

// ========== MEMORIA: CÁLCULOS ==========
function calcularCamposPrograma(p) {
  const ramInicial = p.disco - STATE.exeHeader;
  const bss = ramInicial - p.text - p.data;
  const ramUsar = ramInicial + STATE.stackSize + STATE.heapSize;
  return { ramInicial, bss, ramUsar };
}

function renderTablaProgramas() {
  const tbody = $('#tbodyProgramas');
  tbody.innerHTML = '';

  STATE.programas.forEach((p, idx) => {
    const c = calcularCamposPrograma(p);
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td><strong>${p.id}</strong></td>
      <td>${p.nombre}</td>
      <td>${formatoNumero(p.disco)}</td>
      <td>${formatoNumero(p.text)}</td>
      <td>${formatoNumero(p.data)}</td>
      <td>${formatoNumero(c.ramInicial)}</td>
      <td class="${c.bss < 0 ? 'alerta' : ''}">${formatoNumero(c.bss)}</td>
      <td><strong>${formatoNumero(c.ramUsar)}</strong></td>
      <td>
        <button class="secondary" onclick="app.eliminarPrograma(${idx})">Eliminar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  renderResumenMemoria();
}

function renderResumenMemoria() {
  const ramBytes = STATE.ramTotalMiB * 1024 * 1024;
  let totalRamUsar = 0;
  STATE.programas.forEach(p => {
    totalRamUsar += calcularCamposPrograma(p).ramUsar;
  });
  const pct = ((totalRamUsar / ramBytes) * 100).toFixed(2);

  const resumen = $('#resumenMemoria');
  resumen.innerHTML = `
    <strong>Resumen:</strong> RAM a USAR total = ${formatoNumero(totalRamUsar)} bytes |
    RAM disponible = ${formatoNumero(ramBytes)} bytes |
    Ocupación simultánea = <strong>${pct}%</strong>
    ${pct > 100 ? '<br><span class="alerta">⚠ Alerta: la memoria requerida supera la RAM total del sistema</span>' : ''}
  `;
}

function actualizarEquivalenciasRAM() {
  $('#ramKiB').textContent = formatoNumero(STATE.ramTotalMiB * 1024);
  $('#ramBytes').textContent = formatoNumero(STATE.ramTotalMiB * 1024 * 1024);
  renderResumenMemoria();
}

// ========== MEMORIA: EVENTOS PARÁMETROS ==========
function initParametrosMemoria() {
  $('#ramTotal').addEventListener('input', (e) => {
    STATE.ramTotalMiB = parseInt(e.target.value) || 1;
    actualizarEquivalenciasRAM();
  });
  $('#exeHeader').addEventListener('input', (e) => {
    STATE.exeHeader = parseInt(e.target.value) || 0;
    renderTablaProgramas();
  });
  $('#stackSize').addEventListener('input', (e) => {
    STATE.stackSize = parseInt(e.target.value) || 0;
    renderTablaProgramas();
  });
  $('#heapSize').addEventListener('input', (e) => {
    STATE.heapSize = parseInt(e.target.value) || 0;
    renderTablaProgramas();
  });
  $('#numTiempos').addEventListener('input', (e) => {
    STATE.numTiempos = parseInt(e.target.value) || 1;
    renderMatriz();
  });
}

// ========== MEMORIA: AGREGAR / ELIMINAR / RESTAURAR ==========
window.app = {
  agregarPrograma() {
    const id = String.fromCharCode(65 + STATE.programas.length);
    STATE.programas.push({ id, nombre: 'Nuevo', disco: 0, text: 0, data: 0 });
    renderTablaProgramas();
  },
  eliminarPrograma(idx) {
    if (STATE.programas.length <= 1) return;
    STATE.programas.splice(idx, 1);
    renderTablaProgramas();
  },
  restaurarProgramas() {
    STATE.programas = [
      { id: 'A', nombre: 'Chrome', disco: 3220120, text: 2599742, data: 532238 },
      { id: 'B', nombre: 'Calendario', disco: 54877, text: 51248, data: 563 },
      { id: 'C', nombre: 'Discord', disco: 579299, text: 52322, data: 496571 },
      { id: 'D', nombre: 'Photoshop', disco: 1317966, text: 1154894, data: 154362 },
      { id: 'E', nombre: 'VS Code', disco: 2025093, text: 1874529, data: 124032 },
      { id: 'F', nombre: 'Karpersky', disco: 865237, text: 452963, data: 405477 },
      { id: 'G', nombre: 'Word', disco: 1639224, text: 1254308, data: 254987 }
    ];
    renderTablaProgramas();
  }
};

$('#btnAgregarPrograma').addEventListener('click', () => window.app.agregarPrograma());
$('#btnRestaurarProgramas').addEventListener('click', () => window.app.restaurarProgramas());

// ========== MEMORIA: MATRIZ ==========
function cargarMatrizPorDefecto() {
  STATE.matriz = {};
  const escenario = {
    1: { G: 1, B: 2 },
    2: { A: 1, F: 2, B: 'x' },
    3: { D: 1, C: 2, A: 'x', B: 'x' },
    4: { F: 1, E: 2, G: 3, C: 'x' },
    5: { A: 1, B: 2, E: 'x', G: 'x' }
  };
  // Asegurar hasta numTiempos
  for (let t = 1; t <= STATE.numTiempos; t++) {
    STATE.matriz[t] = escenario[t] || {};
  }
}

function renderMatriz() {
  const thead = $('#tablaMatriz thead');
  const tbody = $('#tbodyMatriz');
  thead.innerHTML = '';
  tbody.innerHTML = '';

  const tiempos = [];
  for (let t = 1; t <= STATE.numTiempos; t++) tiempos.push(t);

  // Encabezado
  const trH = document.createElement('tr');
  trH.innerHTML = '<th>Proceso</th>' + tiempos.map(t => `<th>t=${t}</th>`).join('');
  thead.appendChild(trH);

  // Filas por programa
  STATE.programas.forEach(p => {
    const tr = document.createElement('tr');
    let celdas = `<td><strong>${p.id} - ${p.nombre}</strong></td>`;
    tiempos.forEach(t => {
      const val = STATE.matriz[t] && STATE.matriz[t][p.id] !== undefined ? STATE.matriz[t][p.id] : '';
      celdas += `
        <td>
          <select data-t="${t}" data-pid="${p.id}" class="matriz-select">
            <option value="">Vacío</option>
            <option value="x">x (salida)</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
          </select>
        </td>
      `;
    });
    tr.innerHTML = celdas;
    tbody.appendChild(tr);
  });

  // Eventos selects
  $$('.matriz-select').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const t = parseInt(e.target.dataset.t);
      const pid = e.target.dataset.pid;
      const val = e.target.value;
      if (!STATE.matriz[t]) STATE.matriz[t] = {};
      if (val === '') delete STATE.matriz[t][pid];
      else STATE.matriz[t][pid] = val === 'x' ? 'x' : parseInt(val);
    });
  });

  // Inicializar valores de selects
  setTimeout(() => {
    tiempos.forEach(t => {
      STATE.programas.forEach(p => {
        const sel = document.querySelector(`.matriz-select[data-t="${t}"][data-pid="${p.id}"]`);
        if (sel && STATE.matriz[t] && STATE.matriz[t][p.id] !== undefined) {
          const v = STATE.matriz[t][p.id];
          sel.value = v === 'x' ? 'x' : String(v);
        }
      });
    });
  }, 0);
}

$('#btnRecalcularMatriz').addEventListener('click', () => {
  renderResultadoInstantes();
});

function renderResultadoInstantes() {
  const cont = $('#resultadoInstantes');
  const ramBytes = STATE.ramTotalMiB * 1024 * 1024;
  let html = '';

  for (let t = 1; t <= STATE.numTiempos; t++) {
    const celdasT = STATE.matriz[t] || {};
    const residentes = [];
    let ocupados = 0;

    STATE.programas.forEach(p => {
      const val = celdasT[p.id];
      if (val !== '' && val !== undefined && val !== 'x') {
        // entró en este o tiempo anterior y no salió
        residentes.push(p.id);
      }
    });

    // Calcular memoria ocupada por residentes que han entrado y no salido hasta t
    // Simplificado: suma RAM a USAR de residentes presentes en t
    let memOcupada = 0;
    STATE.programas.forEach(p => {
      // presente si hay entrada <= t y no hay 'x' en <= t
      let entro = false, salio = false;
      for (let tt = 1; tt <= t; tt++) {
        const v = (STATE.matriz[tt] && STATE.matriz[tt][p.id]);
        if (v !== '' && v !== undefined && v !== 'x') entro = true;
        if (v === 'x') salio = true;
      }
      if (entro && !salio) {
        memOcupada += calcularCamposPrograma(p).ramUsar;
      }
    });

    const libre = ramBytes - memOcupada;
    const pct = ((memOcupada / ramBytes) * 100).toFixed(2);
    const alerta = memOcupada > ramBytes ? '<span class="alerta">⚠ SUPERA RAM TOTAL</span>' : '';

    html += `
      <div style="border:1px solid var(--border); border-radius:var(--radius); padding:0.75rem; margin-bottom:0.5rem; background:var(--bg-card);">
        <strong>Instante t=${t}</strong> |
        Residentes: ${residentes.length ? residentes.join(', ') : 'ninguno'} |
        Ocupada: ${formatoNumero(memOcupada)} bytes (${pct}%) |
        Libre: ${formatoNumero(libre)} bytes ${alerta}
      </div>
    `;
  }

  cont.innerHTML = html || '<p>Sin resultados.</p>';
}

// ========== INICIALIZACIÓN ==========
// =========================================
// MOTOR DE SIMULACIÓN DE CPU (Paso 2)
// =========================================

const SIMS = {}; // estado separado por algoritmo: { fcfs, sjf, srtf, rr }
let algoritmoActivo = 'fcfs';

function getSim(algoritmo) {
  if (!SIMS[algoritmo]) {
    SIMS[algoritmo] = {
      tickActual: 0,
      tiempoFinal: 0,
      gantt: [],
      procesosSim: clonarProcesos(),
      colaListos: [],
      enCPU: null,
      bloqueados: [],
      timeline: [],
      quantumRestante: parseInt($('#quantumRR').value) || 3,
      statsPorProceso: {},
      statsGlobales: {}
    };
  }
  return SIMS[algoritmo];
}

// Clonar procesos iniciales para simulación
function clonarProcesos() {
  return STATE.procesosCPU.map(p => ({
    id: p.id,
    arrival: p.arrival,
    burst: p.burst,
    blocks: p.blocks.map(b => ({ trigger: b.trigger, dur: b.dur })),
    executed: 0,      // tiempo acumulado ejecutado en CPU
    remaining: p.burst,
    finished: false,
    firstExecStart: null, // instante de primera ejecución
    bloqueoIdx: 0,    // índice del próximo bloqueo
    enBloqueo: false,
    restanteBloqueo: 0
  }));
}

// Reiniciar simulación de un algoritmo
function reiniciarSim(algoritmo) {
  const s = getSim(algoritmo);
  s.tickActual = 0;
  s.gantt = [];
  s.procesosSim = clonarProcesos();
  s.colaListos = [];
  s.enCPU = null;
  s.bloqueados = [];
  s.timeline = [];
  s.quantumRestante = parseInt($('#quantumRR').value) || 3;
  // Calcular tiempo final estimado (suma de bursts + bloques + margen)
  let total = 0;
  STATE.procesosCPU.forEach(p => { total += p.burst; p.blocks.forEach(b => total += b.dur); });
  s.tiempoFinal = Math.max(...STATE.procesosCPU.map(p => p.arrival)) + total + 10;
  renderGantt(algoritmo);
  renderStats(algoritmo);
  renderDebugger(algoritmo);
  actualizarLabelTick(algoritmo);
}

// ---------- Lógica de bloqueos ----------
function verificarBloqueo(proc) {
  // Si el proceso está ejecutando y llega a un trigger de bloqueo
  if (proc.enBloqueo) return false;
  const nextBlock = proc.blocks[proc.bloqueoIdx];
  if (nextBlock && proc.executed >= nextBlock.trigger) {
    proc.enBloqueo = true;
    proc.restanteBloqueo = nextBlock.dur;
    proc.bloqueoIdx++;
    return true;
  }
  return false;
}

function avanzarBloqueos(tick) {
  // Decrementar bloqueos y liberar los que terminen
  const liberados = [];
  SIM.bloqueados = SIM.bloqueados.filter(b => {
    b.restante--;
    if (b.restante <= 0) {
      liberados.push(b.pid);
      return false;
    }
    return true;
  });
  // Marcar procesos liberados
  liberados.forEach(pid => {
    const proc = SIM.procesosSim.find(p => p.id === pid);
    if (proc) { proc.enBloqueo = false; proc.restanteBloqueo = 0; }
  });
  return liberados;
}

// ---------- Algoritmos ----------

function pasoFCFS() {
  const s = SIMS['fcfs'];
  const t = s.tickActual;
  const procs = s.procesosSim;

  // 1. Llegadas: procesos que llegan en este instante entran a cola
  procs.filter(p => p.arrival === t && !p.finished && !p.enBloqueo && !s.colaListos.includes(p) && s.enCPU !== p)
    .forEach(p => { if (!s.colaListos.includes(p)) s.colaListos.push(p); });

  // 2. Bloqueos: si el que está en CPU se bloquea
  if (s.enCPU && !s.enCPU.finished) {
    if (verificarBloqueo(s.enCPU)) {
      s.bloqueados.push({ pid: s.enCPU.id, restante: s.enCPU.restanteBloqueo });
      s.enCPU = null;
    }
  }

  // 3. Si CPU libre y hay listos, asignar
  if (!s.enCPU && s.colaListos.length > 0) {
    const next = s.colaListos.shift();
    if (next.firstExecStart === null) next.firstExecStart = t;
    s.enCPU = next;
  }

  // 4. Ejecutar un tick
  if (s.enCPU) {
    s.enCPU.executed++;
    s.enCPU.remaining--;
    // Verificar si termina
    if (s.enCPU.remaining <= 0) {
      s.enCPU.finished = true;
      s.enCPU = null;
    } else {
      // Verificar bloqueo después de ejecutar
      if (verificarBloqueo(s.enCPU)) {
        s.bloqueados.push({ pid: s.enCPU.id, restante: s.enCPU.restanteBloqueo });
        s.enCPU = null;
      }
    }
  }

  // 5. Avanzar bloqueos (los que no están en CPU)
  avanzarBloqueos(t);

  // Registrar en gantt
  s.gantt[t] = {
    enCPU: s.enCPU ? s.enCPU.id : null,
    cola: s.colaListos.map(p => p.id),
    bloqueados: s.bloqueados.map(b => b.pid),
    esPL: false
  };

  // Snapshot para debugger
  s.timeline.push({
    tick: t,
    enCPU: s.enCPU ? s.enCPU.id : null,
    colaListos: s.colaListos.map(p => p.id),
    bloqueados: s.bloqueados.map(b => ({ pid: b.pid, restante: b.restante })),
    restantes: procs.map(p => ({ id: p.id, remaining: p.remaining }))
  });

  s.tickActual++;
  return !procs.every(p => p.finished) || s.bloqueados.length > 0 || s.colaListos.length > 0;
}

function pasoSJF() {
  const s = SIMS['sjf'];
  const t = s.tickActual;
  const procs = s.procesosSim;

  // 1. Llegadas
  procs.filter(p => p.arrival === t && !p.finished && !p.enBloqueo && !s.colaListos.includes(p) && s.enCPU !== p)
    .forEach(p => { if (!s.colaListos.includes(p)) s.colaListos.push(p); });

  // 2. Bloqueo de CPU actual
  if (s.enCPU && !s.enCPU.finished) {
    if (verificarBloqueo(s.enCPU)) {
      s.bloqueados.push({ pid: s.enCPU.id, restante: s.enCPU.restanteBloqueo });
      s.enCPU = null;
    }
  }

  // 3. Si CPU libre, seleccionar SJF (menor burst total, empate alfabético)
  if (!s.enCPU && s.colaListos.length > 0) {
    s.colaListos.sort((a, b) => a.burst - b.burst || a.id.localeCompare(b.id));
    const next = s.colaListos.shift();
    if (next.firstExecStart === null) next.firstExecStart = t;
    s.enCPU = next;
  }

  // 4. Ejecutar
  if (s.enCPU) {
    s.enCPU.executed++;
    s.enCPU.remaining--;
    if (s.enCPU.remaining <= 0) {
      s.enCPU.finished = true;
      s.enCPU = null;
    } else {
      if (verificarBloqueo(s.enCPU)) {
        s.bloqueados.push({ pid: s.enCPU.id, restante: s.enCPU.restanteBloqueo });
        s.enCPU = null;
      }
    }
  }

  avanzarBloqueos(t);

  s.gantt[t] = {
    enCPU: s.enCPU ? s.enCPU.id : null,
    cola: s.colaListos.map(p => p.id),
    bloqueados: s.bloqueados.map(b => b.pid),
    esPL: false
  };

  s.timeline.push({
    tick: t,
    enCPU: s.enCPU ? s.enCPU.id : null,
    colaListos: s.colaListos.map(p => p.id),
    bloqueados: s.bloqueados.map(b => ({ pid: b.pid, restante: b.restante })),
    restantes: procs.map(p => ({ id: p.id, remaining: p.remaining }))
  });

  s.tickActual++;
  return !procs.every(p => p.finished) || s.bloqueados.length > 0 || s.colaListos.length > 0;
}

function pasoSRTF() {
  const s = SIMS['srtf'];
  const t = s.tickActual;
  const procs = s.procesosSim;

  // 1. Llegadas
  procs.filter(p => p.arrival === t && !p.finished && !p.enBloqueo && !s.colaListos.includes(p) && s.enCPU !== p)
    .forEach(p => { if (!s.colaListos.includes(p)) s.colaListos.push(p); });

  // 2. Liberados de bloqueo entran a cola
  const liberados = avanzarBloqueos(t);
  liberados.forEach(pid => {
    const p = procs.find(x => x.id === pid);
    if (p && !p.finished && !s.colaListos.includes(p)) s.colaListos.push(p);
  });

  // 3. Seleccionar el de menor remaining (incluyendo el que está en CPU)
  const candidatos = [...s.colaListos];
  if (s.enCPU && !s.enCPU.finished) candidatos.push(s.enCPU);
  if (candidatos.length > 0) {
    candidatos.sort((a, b) => a.remaining - b.remaining || a.id.localeCompare(b.id));
    const seleccionado = candidatos[0];
    // Expropiar si es diferente al actual
    if (s.enCPU && s.enCPU.id !== seleccionado.id) {
      if (!s.enCPU.finished && !s.enCPU.enBloqueo) {
        if (!s.colaListos.includes(s.enCPU)) s.colaListos.push(s.enCPU);
      }
      s.enCPU = null;
    }
    if (!s.enCPU) {
      s.enCPU = seleccionado;
      s.colaListos = s.colaListos.filter(p => p.id !== seleccionado.id);
      if (s.enCPU.firstExecStart === null) s.enCPU.firstExecStart = t;
    }
  }

  // 4. Ejecutar
  if (s.enCPU) {
    s.enCPU.executed++;
    s.enCPU.remaining--;
    if (s.enCPU.remaining <= 0) {
      s.enCPU.finished = true;
      s.enCPU = null;
    } else {
      if (verificarBloqueo(s.enCPU)) {
        s.bloqueados.push({ pid: s.enCPU.id, restante: s.enCPU.restanteBloqueo });
        s.enCPU = null;
      }
    }
  }

  s.gantt[t] = {
    enCPU: s.enCPU ? s.enCPU.id : null,
    cola: s.colaListos.map(p => p.id),
    bloqueados: s.bloqueados.map(b => b.pid),
    esPL: false
  };

  s.timeline.push({
    tick: t,
    enCPU: s.enCPU ? s.enCPU.id : null,
    colaListos: s.colaListos.map(p => p.id),
    bloqueados: s.bloqueados.map(b => ({ pid: b.pid, restante: b.restante })),
    restantes: procs.map(p => ({ id: p.id, remaining: p.remaining }))
  });

  s.tickActual++;
  return !procs.every(p => p.finished) || s.bloqueados.length > 0 || s.colaListos.length > 0;
}

function pasoRR() {
  const s = SIMS['rr'];
  const t = s.tickActual;
  const procs = s.procesosSim;
  const Q = parseInt($('#quantumRR').value) || 3;
  const usarPL = $('#usarPLRR').checked;
  let quantumRestante = s.quantumRestante !== undefined ? s.quantumRestante : Q;

  // 1. Llegadas
  procs.filter(p => p.arrival === t && !p.finished && !p.enBloqueo && !s.colaListos.includes(p) && s.enCPU !== p)
    .forEach(p => { if (!s.colaListos.includes(p)) s.colaListos.push(p); });

  // 2. Liberados de bloqueo entran a cola
  const liberados = avanzarBloqueos(t);
  liberados.forEach(pid => {
    const p = procs.find(x => x.id === pid);
    if (p && !p.finished && !s.colaListos.includes(p)) s.colaListos.push(p);
  });

  // Determinar si necesitamos dispatcher
  let necesitaPL = false;
  if (!s.enCPU && s.colaListos.length > 0) necesitaPL = true;

  // Si hay PL y necesitamos dispatcher, consumir tick en PL
  if (usarPL && necesitaPL) {
    s.gantt[t] = { enCPU: 'PL', cola: [], bloqueados: [], esPL: true };
    s.timeline.push({
      tick: t,
      enCPU: 'PL',
      colaListos: s.colaListos.map(p => p.id),
      bloqueados: s.bloqueados.map(b => ({ pid: b.pid, restante: b.restante })),
      restantes: procs.map(p => ({ id: p.id, remaining: p.remaining }))
    });
    s.tickActual++;
    return !procs.every(p => p.finished) || s.bloqueados.length > 0 || s.colaListos.length > 0;
  }

  // Asignar CPU si está libre
  if (!s.enCPU && s.colaListos.length > 0) {
    const next = s.colaListos.shift();
    if (next.firstExecStart === null) next.firstExecStart = t;
    s.enCPU = next;
    quantumRestante = Q;
    s.quantumRestante = quantumRestante;
  }

  // Bloqueo de CPU actual
  if (s.enCPU && !s.enCPU.finished) {
    if (verificarBloqueo(s.enCPU)) {
      s.bloqueados.push({ pid: s.enCPU.id, restante: s.enCPU.restanteBloqueo });
      s.enCPU = null;
      quantumRestante = Q;
      s.quantumRestante = quantumRestante;
    }
  }

  // Ejecutar un tick
  if (s.enCPU) {
    s.enCPU.executed++;
    s.enCPU.remaining--;
    quantumRestante--;
    s.quantumRestante = quantumRestante;

    if (s.enCPU.remaining <= 0) {
      s.enCPU.finished = true;
      s.enCPU = null;
      quantumRestante = Q;
      s.quantumRestante = quantumRestante;
    } else if (verificarBloqueo(s.enCPU)) {
      s.bloqueados.push({ pid: s.enCPU.id, restante: s.enCPU.restanteBloqueo });
      s.enCPU = null;
      quantumRestante = Q;
      s.quantumRestante = quantumRestante;
    } else if (quantumRestante <= 0 && s.colaListos.length > 0) {
      if (!s.enCPU.finished && !s.enCPU.enBloqueo) {
        s.colaListos.push(s.enCPU);
      }
      s.enCPU = null;
      quantumRestante = Q;
      s.quantumRestante = quantumRestante;
    }
  }

  s.gantt[t] = {
    enCPU: s.enCPU ? s.enCPU.id : null,
    cola: s.colaListos.map(p => p.id),
    bloqueados: s.bloqueados.map(b => b.pid),
    esPL: false
  };

  s.timeline.push({
    tick: t,
    enCPU: s.enCPU ? s.enCPU.id : null,
    colaListos: s.colaListos.map(p => p.id),
    bloqueados: s.bloqueados.map(b => ({ pid: b.pid, restante: b.restante })),
    restantes: procs.map(p => ({ id: p.id, remaining: p.remaining }))
  });

  s.tickActual++;
  return !procs.every(p => p.finished) || s.bloqueados.length > 0 || s.colaListos.length > 0;
}

function pasoTick() {
  let continuar;
  switch (algoritmoActivo) {
    case 'fcfs': continuar = pasoFCFS(); break;
    case 'sjf': continuar = pasoSJF(); break;
    case 'srtf': continuar = pasoSRTF(); break;
    case 'rr': continuar = pasoRR(); break;
  }
  renderGantt(algoritmoActivo);
  renderDebugger(algoritmoActivo);
  actualizarLabelTick(algoritmoActivo);
  if (!continuar) {
    calcularEstadisticas(algoritmoActivo);
    renderStats(algoritmoActivo);
    actualizarBotonesPlay(algoritmoActivo);
  }
  return continuar;
}

function ejecutarHastaElFinal() {
  while (pasoTick()) {}
}

// ---------- Renderizado Gantt ----------
function renderGantt(algoritmo) {
  const cont = $(`#gantt-${algoritmo}`);
  if (!cont) return;
  const s = SIMS[algoritmo];
  const procs = STATE.procesosCPU.map(p => p.id);
  const cols = s.tickActual + 1;

  // Clase CSS por estado
  function claseEstado(estado) {
    switch (estado) {
      case 'ejecutando': return 'ejecutando';
      case 'listo': return 'listo';
      case 'bloqueado': return 'bloqueado';
      case 'pl': return 'pl';
      default: return 'idle';
    }
  }
  function letraEstado(estado) {
    switch (estado) {
      case 'ejecutando': return '▶';
      case 'listo': return '⏳';
      case 'bloqueado': return '⏸';
      case 'pl': return 'PL';
      default: return '';
    }
  }

  let html = '<div class="gantt-grid">';

  // Fila de tiempos
  html += '<div class="gantt-row">';
  html += '<div class="gantt-cell header label">t</div>';
  for (let t = 0; t < cols; t++) {
    html += `<div class="gantt-cell header">${t}</div>`;
  }
  html += '</div>';

  // Filas de procesos
  procs.forEach(pid => {
    html += '<div class="gantt-row">';
    html += `<div class="gantt-cell label">${pid}</div>`;
    for (let t = 0; t < cols; t++) {
      const c = s.gantt[t];
      let estado = 'idle';
      if (c && c.esPL) {
        // fila PL solo se pinta en la fila PL, no aquí
        estado = 'idle';
      } else if (c && c.enCPU === pid) {
        estado = 'ejecutando';
      } else if (c && c.cola.includes(pid)) {
        estado = 'listo';
      } else if (c && c.bloqueados.includes(pid)) {
        estado = 'bloqueado';
      }
      html += `<div class="gantt-cell ${claseEstado(estado)}" title="${pid} t=${t}: ${estado}">${letraEstado(estado)}</div>`;
    }
    html += '</div>';
  });

  // Fila PL para RR
  if (algoritmo === 'rr') {
    html += '<div class="gantt-row">';
    html += '<div class="gantt-cell label">PL</div>';
    for (let t = 0; t < cols; t++) {
      const c = SIM.gantt[t];
      const esPL = c && c.esPL;
      html += `<div class="gantt-cell ${esPL ? 'pl' : 'idle'}">${esPL ? 'PL' : ''}</div>`;
    }
    html += '</div>';
  }

  html += '</div>';
  cont.innerHTML = html;
}

// ---------- Estadísticas ----------
function calcularEstadisticas(algoritmo) {
  const s = SIMS[algoritmo];
  const procs = STATE.procesosCPU;
  const gantt = s.gantt;
  const tiempoEncendido = s.tickActual - 1; // último tick con algo

  const porProceso = {};
  let totalEjecucion = 0;
  let totalRetorno = 0;
  let totalEspera = 0;
  let totalPerdido = 0;
  let totalPenalidad = 0;
  let totalRespuesta = 0;
  let ticksPL = 0;

  procs.forEach(p => {
    const ejecucion = p.executed;
    const bloqueo = p.blocks.reduce((sum, b) => sum + b.dur, 0);
    // Instante fin: último tick donde ejecutó
    let fin = p.arrival;
    for (let t = 0; t < gantt.length; t++) {
      if (gantt[t] && gantt[t].pid === p.id) fin = t + 1; // columna t representa [t, t+1]
    }
    const retorno = fin - p.arrival;
    const espera = retorno - ejecucion - bloqueo;
    const perdido = retorno - ejecucion;
    const penalidad = ejecucion > 0 ? (retorno / ejecucion).toFixed(2) : 0;
    const respuesta = p.firstExecStart !== null ? p.firstExecStart - p.arrival : 0;

    // Contar ticks PL para este algoritmo (solo RR)
    if (algoritmo === 'rr') {
      ticksPL = gantt.filter(c => c && c.esPL).length;
    }

    porProceso[p.id] = { ejecucion, espera, bloqueo, fin, retorno, perdido, penalidad, respuesta };
    totalEjecucion += ejecucion;
    totalRetorno += retorno;
    totalEspera += espera;
    totalPerdido += perdido;
    totalPenalidad += parseFloat(penalidad);
    totalRespuesta += respuesta;
  });

  const n = procs.length;
  const usoTotal = totalEjecucion + (algoritmo === 'rr' ? ticksPL : 0);
  const cpuDesocupada = tiempoEncendido - usoTotal;
  const pctUsoCPU = tiempoEncendido > 0 ? ((usoTotal / tiempoEncendido) * 100).toFixed(2) : 0;

  s.statsPorProceso = porProceso;
  s.statsGlobales = {
    tiempoEncendido,
    usoTotal,
    cpuDesocupada,
    promRetorno: (totalRetorno / n).toFixed(2),
    promEjecucion: (totalEjecucion / n).toFixed(2),
    promEspera: (totalEspera / n).toFixed(2),
    promPerdido: (totalPerdido / n).toFixed(2),
    promPenalidad: (totalPenalidad / n).toFixed(2),
    promRespuesta: (totalRespuesta / n).toFixed(2),
    pctUsoCPU,
    ticksPL
  };
}

function renderStats(algoritmo) {
  const cont = $(`#stats-${algoritmo}`);
  if (!cont) return;
  const s = SIMS[algoritmo];
  const g = s.statsGlobales;
  const pp = s.statsPorProceso;
  const procs = STATE.procesosCPU;
  const usarPL = algoritmo === 'rr' && $('#usarPLRR').checked;

  let html = '<table><thead><tr>';
  html += '<th>Proceso</th><th>Ejecución (t)</th><th>Espera</th><th>Bloqueo</th><th>I_f</th><th>Retorno (T)</th><th>Tiempo perdido</th><th>Penalidad (T/t)</th><th>T. respuesta (Tr)</th><th>% Uso CPU</th>';
  html += '</tr></thead><tbody>';

  procs.forEach(p => {
    const s = pp[p.id];
    html += `<tr>
      <td><strong>${p.id}</strong></td>
      <td>${s.ejecucion}</td>
      <td>${s.espera}</td>
      <td>${s.bloqueo}</td>
      <td>${s.fin}</td>
      <td>${s.retorno}</td>
      <td>${s.perdido}</td>
      <td>${s.penalidad}</td>
      <td>${s.respuesta}</td>
      <td>${usarPL ? '-' : ((s.ejecucion / g.tiempoEncendido) * 100).toFixed(2)}%</td>
    </tr>`;
  });

  if (usarPL && g.ticksPL > 0) {
    html += `<tr><td><strong>PL</strong></td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>${g.pctUsoCPU}%</td></tr>`;
  }

  html += '</tbody></table>';

  // Métricas globales
  html += `<div class="resumen-memoria" style="margin-top:1rem;">
    <strong>Métricas globales:</strong><br>
    Tiempo encendido: ${g.tiempoEncendido} | Uso total CPU: ${g.usoTotal} | CPU desocupada: ${g.cpuDesocupada}<br>
    Prom. Retorno: ${g.promRetorno} | Prom. Espera: ${g.promEspera} | Prom. Penalidad: ${g.promPenalidad} | Prom. T. respuesta: ${g.promRespuesta}<br>
    ${usarPL ? `Ticks PL: ${g.ticksPL} | % Uso CPU (incl. PL): ${g.pctUsoCPU}%` : ''}
  </div>`;

  cont.innerHTML = html;
}

// ---------- Debugger ----------
function renderDebugger(algoritmo) {
  const cont = $(`#debug-${algoritmo}`);
  if (!cont) return;
  const s = SIMS[algoritmo];
  const ultimo = s.timeline[s.timeline.length - 1];
  if (!ultimo) { cont.innerHTML = '<p>Inicie la simulación para ver el debugger.</p>'; return; }

  const procs = STATE.procesosCPU;
  let html = `<strong>Tick:</strong> ${ultimo.tick} &nbsp;|&nbsp; <strong>CPU:</strong> ${ultimo.enCPU || '—'}<br>`;

  html += `<strong>Cola de Listos:</strong> ${ultimo.colaListos.length ? ultimo.colaListos.join(', ') : 'vacía'}<br>`;

  html += `<strong>Bloqueados:</strong> <ul>`;
  if (ultimo.bloqueados.length) {
    ultimo.bloqueados.forEach(b => html += `<li>${b.pid} (restante: ${b.restante})</li>`);
  } else {
    html += '<li>ninguno</li>';
  }
  html += `</ul>`;

  html += `<strong>Tiempo Restante por proceso:</strong> <ul>`;
  ultimo.restantes.forEach(r => {
    const p = procs.find(x => x.id === r.id);
    html += `<li>${r.id}: ${r.remaining} / ${p ? p.burst : '?'}</li>`;
  });
  html += `</ul>`;

  cont.innerHTML = html;
}

// ---------- Label tick ----------
function actualizarLabelTick(algoritmo) {
  const lbl = $(`#lbl${algoritmo.toUpperCase()}Tick`);
  const s = SIMS[algoritmo];
  if (lbl) lbl.textContent = `Tick: ${s ? s.tickActual : 0}`;
}

// ---------- Botones Play ----------
function actualizarBotonesPlay(algoritmo) {
  const btn = $(`#btn${algoritmo.toUpperCase()}Play`);
  if (btn) btn.textContent = playing ? '⏸ Pausa' : '▶ Play';
}

let playing = false;
let timerPlay = null;

function togglePlay(algoritmo) {
  algoritmoActivo = algoritmo;
  if (playing) {
    playing = false;
    if (timerPlay) { clearInterval(timerPlay); timerPlay = null; }
  } else {
    playing = true;
    timerPlay = setInterval(() => {
      if (!pasoTick()) {
        clearInterval(timerPlay);
        timerPlay = null;
        playing = false;
      }
      actualizarBotonesPlay(algoritmo);
    }, 500);
  }
  actualizarBotonesPlay(algoritmo);
}

// =========================================
// EDICIÓN EN VIVO DE PROCESOS CPU (Paso 5.1)
// =========================================

function renderTablaProcesosCPU() {
  const tbody = $('#tbodyProcesosCPU');
  tbody.innerHTML = '';

  STATE.procesosCPU.forEach((p, idx) => {
    const b1 = p.blocks[0] || { trigger: '-', dur: '-' };
    const b2 = p.blocks[1] || { trigger: '-', dur: '-' };
    const b3 = p.blocks[2] || { trigger: '-', dur: '-' };

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${p.id}</strong></td>
      <td><input type="number" data-idx="${idx}" data-field="arrival" value="${p.arrival}" min="0" /></td>
      <td><input type="number" data-idx="${idx}" data-field="burst" value="${p.burst}" min="1" /></td>
      <td>
        <input type="number" data-idx="${idx}" data-field="b1t" value="${b1.trigger}" min="0" />
        <input type="number" data-idx="${idx}" data-field="b1d" value="${b1.dur}" min="0" />
      </td>
      <td>
        <input type="number" data-idx="${idx}" data-field="b2t" value="${b2.trigger}" min="0" />
        <input type="number" data-idx="${idx}" data-field="b2d" value="${b2.dur}" min="0" />
      </td>
      <td>
        <input type="number" data-idx="${idx}" data-field="b3t" value="${b3.trigger}" min="0" />
        <input type="number" data-idx="${idx}" data-field="b3d" value="${b3.dur}" min="0" />
      </td>
      <td>
        <button class="secondary" onclick="app.eliminarProcesoCPU(${idx})">Eliminar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function initEdicionProcesosCPU() {
  const tbody = $('#tbodyProcesosCPU');
  tbody.addEventListener('input', (e) => {
    if (!e.target.matches('input')) return;
    const idx = parseInt(e.target.dataset.idx);
    const field = e.target.dataset.field;
    const val = parseInt(e.target.value) || 0;
    const p = STATE.procesosCPU[idx];

    if (field === 'arrival') p.arrival = val;
    if (field === 'burst') p.burst = val;
    if (field === 'b1t') {
      if (!p.blocks[0]) p.blocks[0] = { trigger: 0, dur: 0 };
      p.blocks[0].trigger = val;
    }
    if (field === 'b1d') {
      if (!p.blocks[0]) p.blocks[0] = { trigger: 0, dur: 0 };
      p.blocks[0].dur = val;
    }
    if (field === 'b2t') {
      if (!p.blocks[1]) p.blocks[1] = { trigger: 0, dur: 0 };
      p.blocks[1].trigger = val;
    }
    if (field === 'b2d') {
      if (!p.blocks[1]) p.blocks[1] = { trigger: 0, dur: 0 };
      p.blocks[1].dur = val;
    }
    if (field === 'b3t') {
      if (!p.blocks[2]) p.blocks[2] = { trigger: 0, dur: 0 };
      p.blocks[2].trigger = val;
    }
    if (field === 'b3d') {
      if (!p.blocks[2]) p.blocks[2] = { trigger: 0, dur: 0 };
      p.blocks[2].dur = val;
    }

    // Recalcular todas las simulaciones
    reiniciarSim('fcfs');
    reiniciarSim('sjf');
    reiniciarSim('srtf');
    reiniciarSim('rr');
    renderComparativo();
  });
}

window.app = window.app || {};

window.app.agregarProcesoCPU = function() {
  const id = String.fromCharCode(65 + STATE.procesosCPU.length);
  STATE.procesosCPU.push({ id, arrival: 0, burst: 5, blocks: [] });
  renderTablaProcesosCPU();
  reiniciarSim('fcfs');
  reiniciarSim('sjf');
  reiniciarSim('srtf');
  reiniciarSim('rr');
  renderComparativo();
};

window.app.eliminarProcesoCPU = function(idx) {
  if (STATE.procesosCPU.length <= 1) return;
  STATE.procesosCPU.splice(idx, 1);
  renderTablaProcesosCPU();
  reiniciarSim('fcfs');
  reiniciarSim('sjf');
  reiniciarSim('srtf');
  reiniciarSim('rr');
  renderComparativo();
};

window.app.restaurarProcesosCPU = function() {
  STATE.procesosCPU = [
    { id: 'A', arrival: 6, burst: 15, blocks: [{ trigger: 3, dur: 3 }, { trigger: 10, dur: 2 }] },
    { id: 'B', arrival: 7, burst: 5, blocks: [{ trigger: 1, dur: 6 }, { trigger: 3, dur: 1 }] },
    { id: 'C', arrival: 4, burst: 17, blocks: [{ trigger: 1, dur: 5 }, { trigger: 10, dur: 10 }, { trigger: 15, dur: 3 }] },
    { id: 'D', arrival: 5, burst: 8, blocks: [{ trigger: 3, dur: 7 }, { trigger: 5, dur: 4 }] },
    { id: 'E', arrival: 2, burst: 11, blocks: [{ trigger: 4, dur: 5 }, { trigger: 10, dur: 1 }] },
    { id: 'F', arrival: 1, burst: 20, blocks: [{ trigger: 5, dur: 10 }, { trigger: 10, dur: 7 }, { trigger: 15, dur: 3 }] },
    { id: 'G', arrival: 3, burst: 9, blocks: [{ trigger: 5, dur: 15 }] }
  ];
  renderTablaProcesosCPU();
  reiniciarSim('fcfs');
  reiniciarSim('sjf');
  reiniciarSim('srtf');
  reiniciarSim('rr');
  renderComparativo();
};

// =========================================
// PESTAÑA COMPARATIVA (Paso 4)
// =========================================

function renderComparativo() {
  const cont = $('#tablaComparativo');
  if (!cont) return;

  const algs = ['fcfs', 'sjf', 'srtf', 'rr'];
  const nombres = { fcfs: 'FCFS', sjf: 'SJF', srtf: 'SRTF', rr: 'Round Robin' };

  // Recoger métricas globales de cada algoritmo
  const metricas = {};
  algs.forEach(a => {
    const s = SIMS[a];
    const g = s.statsGlobales;
    metricas[a] = g || {};
  });

  // Determinar el mejor por cada métrica (menor es mejor)
  const metricNames = ['promRetorno', 'promEspera', 'promPenalidad', 'promRespuesta'];
  const mejores = {};
  metricNames.forEach(m => {
    let mejorVal = Infinity;
    let mejoresAlgs = [];
    algs.forEach(a => {
      const v = parseFloat(metricas[a][m]) || Infinity;
      if (v < mejorVal) { mejorVal = v; mejoresAlgs = [a]; }
      else if (v === mejorVal) { mejoresAlgs.push(a); }
    });
    mejores[m] = mejoresAlgs;
  });

  let html = '<div class="comparativo-wrap">';
  html += '<table>';
  html += '<thead><tr>';
  html += '<th>Métrica</th>';
  algs.forEach(a => html += `<th>${nombres[a]}</th>`);
  html += '<th>Mejor</th>';
  html += '</tr></thead><tbody>';

  // Fila: Promedio de Retorno
  html += '<tr>';
  html += '<td><strong>Prom. Retorno</strong></td>';
  algs.forEach(a => {
    const esMejor = mejores['promRetorno'].includes(a);
    const cls = esMejor ? 'class="mejor"' : '';
    html += `<td ${cls}>${metricas[a].promRetorno || '-'}</td>`;
  });
  html += `<td>${mejores['promRetorno'].map(a => nombres[a]).join(', ')} <span class="mejor-badge">✓</span></td>`;
  html += '</tr>';

  // Fila: Promedio de Espera
  html += '<tr>';
  html += '<td><strong>Prom. Espera</strong></td>';
  algs.forEach(a => {
    const esMejor = mejores['promEspera'].includes(a);
    const cls = esMejor ? 'class="mejor"' : '';
    html += `<td ${cls}>${metricas[a].promEspera || '-'}</td>`;
  });
  html += `<td>${mejores['promEspera'].map(a => nombres[a]).join(', ')} <span class="mejor-badge">✓</span></td>`;
  html += '</tr>';

  // Fila: Promedio de Penalidad
  html += '<tr>';
  html += '<td><strong>Prom. Penalidad</strong></td>';
  algs.forEach(a => {
    const esMejor = mejores['promPenalidad'].includes(a);
    const cls = esMejor ? 'class="mejor"' : '';
    html += `<td ${cls}>${metricas[a].promPenalidad || '-'}</td>`;
  });
  html += `<td>${mejores['promPenalidad'].map(a => nombres[a]).join(', ')} <span class="mejor-badge">✓</span></td>`;
  html += '</tr>';

  // Fila: Promedio T. Respuesta
  html += '<tr>';
  html += '<td><strong>Prom. T. Respuesta</strong></td>';
  algs.forEach(a => {
    const esMejor = mejores['promRespuesta'].includes(a);
    const cls = esMejor ? 'class="mejor"' : '';
    html += `<td ${cls}>${metricas[a].promRespuesta || '-'}</td>`;
  });
  html += `<td>${mejores['promRespuesta'].map(a => nombres[a]).join(', ')} <span class="mejor-badge">✓</span></td>`;
  html += '</tr>';

  // Fila: Tiempo Encendido
  html += '<tr>';
  html += '<td><strong>Tiempo Encendido</strong></td>';
  algs.forEach(a => html += `<td>${metricas[a].tiempoEncendido || '-'}</td>`);
  html += '<td>—</td>';
  html += '</tr>';

  // Fila: Uso Total CPU
  html += '<tr>';
  html += '<td><strong>Uso Total CPU</strong></td>';
  algs.forEach(a => html += `<td>${metricas[a].usoTotal || '-'}</td>`);
  html += '<td>—</td>';
  html += '</tr>';

  // Fila: CPU Desocupada
  html += '<tr>';
  html += '<td><strong>CPU Desocupada</strong></td>';
  algs.forEach(a => html += `<td>${metricas[a].cpuDesocupada || '-'}</td>`);
  html += '<td>—</td>';
  html += '</tr>';

  // Fila: % Uso CPU
  html += '<tr>';
  html += '<td><strong>% Uso CPU</strong></td>';
  algs.forEach(a => html += `<td>${metricas[a].pctUsoCPU || '-'}%</td>`);
  html += '<td>—</td>';
  html += '</tr>';

  html += '</tbody></table>';
  html += '<p style="margin-top:0.5rem; font-size:0.85rem; color:var(--text-muted);"><span class="mejor-badge">✓</span> = Mejor algoritmo por métrica (menor valor)</p>';
  html += '</div>';

  cont.innerHTML = html;
}

// =========================================
// PERSISTENCIA JSON (Paso 5.4)
// =========================================

function exportarJSON() {
  const configuracion = {
    memoria: {
      ramTotalMiB: STATE.ramTotalMiB,
      exeHeader: STATE.exeHeader,
      stackSize: STATE.stackSize,
      heapSize: STATE.heapSize,
      numTiempos: STATE.numTiempos,
      programas: STATE.programas,
      matriz: STATE.matriz
    },
    cpu: {
      procesosCPU: STATE.procesosCPU,
      quantum: parseInt($('#quantumRR').value) || 3,
      usarPL: $('#usarPLRR').checked
    },
    fechaExportacion: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(configuracion, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `simulador-so-config-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importarJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const config = JSON.parse(e.target.result);

      // Importar memoria
      if (config.memoria) {
        STATE.ramTotalMiB = config.memoria.ramTotalMiB || 16;
        STATE.exeHeader = config.memoria.exeHeader || 2544;
        STATE.stackSize = config.memoria.stackSize || 65536;
        STATE.heapSize = config.memoria.heapSize || 131072;
        STATE.numTiempos = config.memoria.numTiempos || 5;
        STATE.programas = config.memoria.programas || STATE.programas;
        STATE.matriz = config.memoria.matriz || {};

        $('#ramTotal').value = STATE.ramTotalMiB;
        $('#exeHeader').value = STATE.exeHeader;
        $('#stackSize').value = STATE.stackSize;
        $('#heapSize').value = STATE.heapSize;
        $('#numTiempos').value = STATE.numTiempos;
        actualizarEquivalenciasRAM();
        renderTablaProgramas();
        cargarMatrizPorDefecto();
        renderMatriz();
        renderResultadoInstantes();
      }

      // Importar CPU
      if (config.cpu) {
        STATE.procesosCPU = config.cpu.procesosCPU || STATE.procesosCPU;
        $('#quantumRR').value = config.cpu.quantum || 3;
        $('#usarPLRR').checked = config.cpu.usarPL !== false;

        renderTablaProcesosCPU();
        reiniciarSim('fcfs');
        reiniciarSim('sjf');
        reiniciarSim('srtf');
        reiniciarSim('rr');
        renderComparativo();
      }

      alert('Configuración importada correctamente.');
    } catch (err) {
      alert('Error al importar el archivo JSON: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function restaurarTodo() {
  if (!confirm('¿Restaurar todos los valores por defecto? Se perderán los cambios actuales.')) return;

  // Restaurar memoria
  STATE.ramTotalMiB = 16;
  STATE.exeHeader = 2544;
  STATE.stackSize = 65536;
  STATE.heapSize = 131072;
  STATE.numTiempos = 5;
  STATE.programas = [
    { id: 'A', nombre: 'Chrome', disco: 3220120, text: 2599742, data: 532238 },
    { id: 'B', nombre: 'Calendario', disco: 54877, text: 51248, data: 563 },
    { id: 'C', nombre: 'Discord', disco: 579299, text: 52322, data: 496571 },
    { id: 'D', nombre: 'Photoshop', disco: 1317966, text: 1154894, data: 154362 },
    { id: 'E', nombre: 'VS Code', disco: 2025093, text: 1874529, data: 124032 },
    { id: 'F', nombre: 'Karpersky', disco: 865237, text: 452963, data: 405477 },
    { id: 'G', nombre: 'Word', disco: 1639224, text: 1254308, data: 254987 }
  ];
  STATE.matriz = {};

  $('#ramTotal').value = 16;
  $('#exeHeader').value = 2544;
  $('#stackSize').value = 65536;
  $('#heapSize').value = 131072;
  $('#numTiempos').value = 5;

  actualizarEquivalenciasRAM();
  renderTablaProgramas();
  cargarMatrizPorDefecto();
  renderMatriz();
  renderResultadoInstantes();

  // Restaurar CPU
  STATE.procesosCPU = [
    { id: 'A', arrival: 6, burst: 15, blocks: [{ trigger: 3, dur: 3 }, { trigger: 10, dur: 2 }] },
    { id: 'B', arrival: 7, burst: 5, blocks: [{ trigger: 1, dur: 6 }, { trigger: 3, dur: 1 }] },
    { id: 'C', arrival: 4, burst: 17, blocks: [{ trigger: 1, dur: 5 }, { trigger: 10, dur: 10 }, { trigger: 15, dur: 3 }] },
    { id: 'D', arrival: 5, burst: 8, blocks: [{ trigger: 3, dur: 7 }, { trigger: 5, dur: 4 }] },
    { id: 'E', arrival: 2, burst: 11, blocks: [{ trigger: 4, dur: 5 }, { trigger: 10, dur: 1 }] },
    { id: 'F', arrival: 1, burst: 20, blocks: [{ trigger: 5, dur: 10 }, { trigger: 10, dur: 7 }, { trigger: 15, dur: 3 }] },
    { id: 'G', arrival: 3, burst: 9, blocks: [{ trigger: 5, dur: 15 }] }
  ];
  $('#quantumRR').value = 3;
  $('#usarPLRR').checked = true;

  renderTablaProcesosCPU();
  reiniciarSim('fcfs');
  reiniciarSim('sjf');
  reiniciarSim('srtf');
  reiniciarSim('rr');
  renderComparativo();

  alert('Todos los valores han sido restaurados por defecto.');
}

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', () => {
  initTema();
  initPestanas();
  initParametrosMemoria();
  initEdicionProcesosCPU();
  actualizarEquivalenciasRAM();
  renderTablaProgramas();
  renderTablaProcesosCPU();
  cargarMatrizPorDefecto();
  renderMatriz();
  renderResultadoInstantes();
  renderComparativo();

  // Inicializar simulaciones
  reiniciarSim('fcfs');
  reiniciarSim('sjf');
  reiniciarSim('srtf');
  reiniciarSim('rr');

  // Controles FCFS
  $('#btnFcfsAnt').onclick = () => { algoritmoActivo = 'fcfs'; pasoTick(); };
  $('#btnFcfsSig').onclick = () => { algoritmoActivo = 'fcfs'; pasoTick(); };
  $('#btnFcfsPlay').onclick = () => { togglePlay('fcfs'); };
  $('#btnFcfsReset').onclick = () => { reiniciarSim('fcfs'); };

  // Controles SJF
  $('#btnSjfAnt').onclick = () => { algoritmoActivo = 'sjf'; pasoTick(); };
  $('#btnSjfSig').onclick = () => { algoritmoActivo = 'sjf'; pasoTick(); };
  $('#btnSjfPlay').onclick = () => { togglePlay('sjf'); };
  $('#btnSjfReset').onclick = () => { reiniciarSim('sjf'); };

  // Controles SRTF
  $('#btnSrtfAnt').onclick = () => { algoritmoActivo = 'srtf'; pasoTick(); };
  $('#btnSrtfSig').onclick = () => { algoritmoActivo = 'srtf'; pasoTick(); };
  $('#btnSrtfPlay').onclick = () => { togglePlay('srtf'); };
  $('#btnSrtfReset').onclick = () => { reiniciarSim('srtf'); };

  // Controles RR
  $('#btnRrAnt').onclick = () => { algoritmoActivo = 'rr'; pasoTick(); };
  $('#btnRrSig').onclick = () => { algoritmoActivo = 'rr'; pasoTick(); };
  $('#btnRrPlay').onclick = () => { togglePlay('rr'); };
  $('#btnRrReset').onclick = () => { reiniciarSim('rr'); };
  $('#quantumRR').onchange = () => { reiniciarSim('rr'); };
  $('#usarPLRR').onchange = () => { reiniciarSim('rr'); };

  // Controles Edición en Vivo
  $('#btnAgregarProcesoCPU').onclick = () => window.app.agregarProcesoCPU();
  $('#btnRestaurarProcesosCPU').onclick = () => window.app.restaurarProcesosCPU();

  // Controles Persistencia
  $('#btnExportarJSON').onclick = exportarJSON;
  $('#btnImportarJSON').onclick = () => $('#inputImportarJSON').click();
  $('#inputImportarJSON').onchange = importarJSON;
  $('#btnRestaurarTodo').onclick = restaurarTodo;

});
