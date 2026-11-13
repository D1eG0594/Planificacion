# Especificación Técnica: Simulador Interactivo de Memoria y Planificación de CPU

Construye una aplicación web completamente funcional usando únicamente **HTML5, CSS3 y JavaScript (Vanilla JS)**, sin frameworks ni dependencias externas (debe poder abrirse directamente haciendo doble clic en `index.html`).

La aplicación debe replicar y hacer interactivos dos módulos de Sistemas Operativos:
1. **Gestión de Memoria (Segmentos y Simulación de Carga en RAM)**
2. **Planificación de CPU con Bloqueos de E/S (FCFS, SJF, SRTF y Round Robin)**

---

## Paso 1: Estructura de Archivos y Diseño de Interfaz (UI)

Crea tres archivos base:
- `index.html`: Estructura semántica con navegación por pestañas (`Memoria`, `FCFS`, `SJF`, `SRTF`, `Round Robin`) y un panel comparativo global.
- `styles.css`: Diseño limpio tipo dashboard técnico (tema oscuro o claro con alto contraste), tablas responsivas, cuadrícula tipo hoja de cálculo para los diagramas de Gantt con scroll horizontal y leyenda de colores fija.
- `app.js`: Motor de cálculo de memoria, simulador discreto paso a paso (tick a tick) para los 4 algoritmos, renderizado del DOM y exportación/importación de configuraciones en JSON.

---

## Paso 2: Módulo 1 — Gestión de Memoria (Pestaña "Memoria")

### 2.1 Parámetros Globales Editables (Inputs numéricos)
- **RAM Total:** Por defecto `16` MiB. Calcular y mostrar automáticamente su equivalencia en KiB (`MiB * 1024` = `16384`) y Bytes (`KiB * 1024` = `16777216`).
- **Tamaño encabezado `.exe`:** Por defecto `2544` bytes.
- **Pila (`.stack`):** Por defecto `65536` bytes (`64 KiB`).
- **Montículo (`.heap`):** Por defecto `131072` bytes (`128 KiB`, por defecto `2 * stack`, pero editable).

### 2.2 Tabla de Programas Instalados (Editable y con opción de agregar/eliminar filas)
Por cada proceso (`ID`, `Nombre`, `Tamaño en Disco`, `.text`, `.data`), calcular en tiempo real:
- `RAM inicial` = `Tamaño en Disco - Tamaño encabezado .exe`
- `.bss` = `RAM inicial - .text - .data` (validar que no sea negativo)
- `RAM a USAR` = `RAM inicial + .stack + .heap`

Cargar por defecto estos 7 procesos exactos:
1. **A - Chrome:** Disco `3220120`, `.text` `2599742`, `.data` `532238`
2. **B - Calendario:** Disco `54877`, `.text` `51248`, `.data` `563`
3. **C - Discord:** Disco `579299`, `.text` `52322`, `.data` `496571`
4. **D - Photoshop:** Disco `1317966`, `.text` `1154894`, `.data` `154362`
5. **E - VS Code:** Disco `2025093`, `.text` `1874529`, `.data` `124032`
6. **F - Karpersky:** Disco `865237`, `.text` `452963`, `.data` `405477`
7. **G - Word:** Disco `1639224`, `.text` `1254308`, `.data` `254987`

Mostrar un indicador resumen con la suma total de `RAM a USAR` si todos corren simultáneamente vs. la RAM disponible (`% de ocupación`).

### 2.3 Matriz de Simulación Temporal de Memoria
- Permitir definir una línea de tiempo de `1` a `N` instantes (por defecto `5` tiempos).
- En cada celda `(Proceso, Tiempo)`, permitir seleccionar:
  - Vacío (sin evento)
  - Número de orden de entrada (`1`, `2`, `3`...) indicando que el proceso entra a RAM en ese instante.
  - `'x'` indicando que el proceso finaliza y libera su memoria.
- Cargar el escenario por defecto:
  - **t=1:** G (`1`), B (`2`)
  - **t=2:** A (`1`), F (`2`), B (`x`)
  - **t=3:** D (`1`), C (`2`), A (`x`), B (`x`)
  - **t=4:** F (`1`), E (`2`), G (`3`), C (`x`)
  - **t=5:** A (`1`), B (`2`), E (`x`), G (`x`)
- **Renderizado:** Mostrar para cada instante `t`: qué procesos están residentes en RAM, memoria total ocupada (bytes y %), memoria libre, y una alerta visual si en algún instante la memoria requerida supera la RAM total del sistema.

---

## Paso 3: Módulo 2 — Motor de Simulación de CPU (Tick a Tick)

### 3.1 Estructura de Datos de Entrada (Compartida entre los 4 algoritmos)
Cada proceso tiene:
- `id`: Letra (`A`..`G`)
- `arrival`: Instante de llegada $I_i$
- `burst`: Tiempo total de ejecución requerido $t$
- `blocks`: Lista de hasta 3 bloqueos de E/S, cada uno definido por `(triggerExecTime, duration)`.
  - **Regla crítica del disparo de bloqueo:** `triggerExecTime` es el **tiempo acumulado de ejecución en CPU** del propio proceso (no el reloj global). Por ejemplo, si un proceso tiene bloqueo en `3` con duración `3`, tras ejecutar 3 unidades de CPU pasa inmediatamente a estado `BLOQUEADO` durante 3 unidades de reloj.

Cargar por defecto estos datos exactos:
- **A:** Llegada `6`, Ejecución `15`, Bloqueos: `(3, 3)`, `(10, 2)`
- **B:** Llegada `7`, Ejecución `5`, Bloqueos: `(1, 6)`, `(3, 1)`
- **C:** Llegada `4`, Ejecución `17`, Bloqueos: `(1, 5)`, `(10, 10)`, `(15, 3)`
- **D:** Llegada `5`, Ejecución `8`, Bloqueos: `(3, 7)`, `(5, 4)`
- **E:** Llegada `2`, Ejecución `11`, Bloqueos: `(4, 5)`, `(10, 1)`
- **F:** Llegada `1`, Ejecución `20`, Bloqueos: `(5, 10)`, `(10, 7)`, `(15, 3)`
- **G:** Llegada `3`, Ejecución `9`, Bloqueos: `(5, 15)`

### 3.2 Convención de Tiempo y Estados en el Diagrama de Gantt
- El eje horizontal representa intervalos unitarios de tiempo: la columna etiquetada `k` representa el intervalo `[k-1, k]` (empezando en `t=1` para el intervalo `[0, 1]`).
- Un proceso con llegada `Ii` aparece por primera vez en la columna `Ii + 1` (intervalo `[Ii, Ii+1]`).
- **Estados visuales por celda:**
  - **Gris (`#D9D9D9`):** En cola de listos (esperando CPU).
  - **Verde (`#00B050`):** Ejecutando en CPU.
  - **Rojo (`#FF0000`):** Bloqueado en E/S.
  - **Azul (`#00B0F0`):** Fila superior exclusiva de Round Robin (`PL` / Dispatcher).

### 3.3 Reglas Exactas de los 4 Algoritmos
Implementar un motor discreto que avance de `1` en `1` unidad de tiempo hasta que todos los procesos terminen:

1. **FCFS (First-Come, First-Served — No expropiativo):**
   - Cola FIFO de listos. Cuando un proceso llega o termina su bloqueo, entra al final de la cola de listos. El proceso en CPU solo la suelta si termina su ejecución o entra en bloqueo.
2. **SJF (Shortest Job First — No expropiativo):**
   - Cuando la CPU queda libre, selecciona de la cola de listos el proceso con menor tiempo total de ejecución `t` (o menor tiempo restante al momento de selección; en caso de empate, por orden de llegada a cola / alfabético). No expropia un proceso en ejecución salvo que este se bloquee o termine.
3. **SRTF (Shortest Remaining Time First — Expropiativo):**
   - En cada unidad de tiempo `t`, evalúa todos los procesos en estado `LISTO` (incluido el que está actualmente en CPU). Selecciona el que tenga menor `tiempo_restante` (`burst - executedTime`). Si entra un proceso nuevo o sale uno de bloqueo con `tiempo_restante` estrictamente menor al actual en CPU, expropia inmediatamente.
4. **Round Robin (Expropiativo con Quantum $Q$ y Dispatcher `PL`):**
   - Input editable para `Quantum` (por defecto `Q = 3`) y toggle opcional para activar/desactivar el costo del Dispatcher (`PL = 1` unidad de CPU).
   - **Regla del Dispatcher (`PL`):** Cada vez que el planificador debe asignar la CPU (al inicio si hay listos, cuando vence el quantum de un proceso y hay otro esperando, o cuando un proceso termina/se bloquea y entra otro), consume `1` tick completo en la fila `PL` (color azul). Durante ese tick `PL`, todos los procesos listos permanecen en espera (gris).
   - El proceso seleccionado ejecuta hasta `Q` ticks consecutivos, salvo que antes se bloquee o termine. Al agotar su quantum sin terminar ni bloquearse, regresa al final de la cola de listos.

---

## Paso 4: Cálculo de Estadísticas y Métricas

Para cada algoritmo, generar dinámicamente la tabla de estadísticas por proceso y los promedios globales:

### 4.1 Por Proceso
- **Ejecución ($t$):** Total de unidades verdes.
- **Espera:** Total de unidades grises (`Retorno - Ejecución - Bloqueo`).
- **Bloqueo:** Total de unidades rojas.
- **Instante fin ($I_f$):** Último instante en que el proceso termina su última unidad verde.
- **Retorno ($T$):** $I_f - I_i$.
- **Tiempo perdido:** $T - t$.
- **Penalidad ($I_p$):** $T / t$ (mostrar con 2 decimales).
- **Tiempo de respuesta ($T_r$):** Tiempo transcurrido desde su llegada $I_i$ hasta el inicio de su **primera** unidad verde de ejecución (es decir, cantidad de celdas grises antes de la primera celda verde).
- **% Uso CPU:** $(t / \text{Tiempo encendido}) \times 100$. (En RR, incluir también la fila `PL` con su `% Uso CPU = (Total ticks PL / Tiempo encendido) * 100`).

### 4.2 Métricas Globales del Sistema
- **Tiempo encendido:** Instante $I_f$ máximo entre todos los procesos.
- **Uso total de CPU:** Suma de `t` de todos los procesos (+ ticks de `PL` en RR).
- **CPU desocupada:** `Tiempo encendido - Uso total de CPU`.
- **Promedios:** Media aritmética de `Retorno`, `Ejecución`, `Espera`, `Tiempo perdido`, `Penalidad` y `Tiempo de respuesta`.

---

## Paso 5: Funcionalidades Interactivas Adicionales

1. **Edición en vivo:** Permitir modificar llegadas, tiempos de ejecución, bloqueos o agregar/quitar procesos en una tabla maestra y recalcular instantáneamente las 4 pestañas.
2. **Inspección paso a paso (Debugger visual):** Añadir un deslizador o botones (`Anterior`, `Siguiente`, `Play/Pausa`) en cada algoritmo para avanzar tick a tick y ver en un panel lateral: qué procesos están en `Cola de Listos`, cuál está en `CPU`, cuáles están `Bloqueados` (con su contador restante) y el `Tiempo Restante` de cada uno (replicando la tabla auxiliar de SRTF).
3. **Pestaña Comparativa:** Una tabla resumen que enfrente lado a lado las métricas globales de `FCFS`, `SJF`, `SRTF` y `RR` resaltando en verde el mejor algoritmo por métrica (menor retorno, menor espera, menor penalidad, mejor tiempo de respuesta).
4. **Persistencia:** Botones para `Restaurar valores del Excel`, `Exportar JSON` e `Importar JSON`.