# Simulador Interactivo de Memoria y Planificación de CPU

Proyecto final de Sistemas Operativos. Aplicación web construida únicamente con **HTML5, CSS3 y JavaScript (Vanilla JS)**, sin frameworks ni dependencias externas. Se abre directamente haciendo doble clic en `index.html`.

## Estructura del proyecto

```
ProyectoFinal/
├── index.html      # Estructura semántica y navegación por pestañas
├── styles.css      # Diseño tipo dashboard técnico (tema claro/oscuro)
├── app.js          # Motor de cálculo, simulación y renderizado del DOM
├── PasoAPaso.md    # Especificación técnica del proyecto
└── README.md       # Este archivo
```

## Módulos implementados

### 1. Gestión de Memoria (pestaña "Memoria")
- Parámetros globales editables: RAM Total, encabezado `.exe`, pila `.stack`, montículo `.heap`, número de tiempos.
- Tabla de programas instalados con 7 procesos precargados (Chrome, Calendario, Discord, Photoshop, VS Code, Karpersky, Word).
- Cálculo en tiempo real de: `RAM inicial`, `.bss`, `RAM a USAR`.
- Matriz de simulación temporal (t=1 a N) con órdenes de entrada y salidas (`x`).
- Resultado por instante: procesos residentes, memoria ocupada (bytes y %), memoria libre, alerta si supera la RAM total.

### 2. Planificación de CPU (pestañas FCFS, SJF, SRTF, Round Robin)
- 7 procesos con llegada, burst y hasta 3 bloqueos de E/S cada uno.
- Motor discreto tick a tick.
- Diagrama de Gantt con estados: gris (listo), verde (ejecutando), rojo (bloqueado E/S), azul (PL/Dispatcher en RR).
- Estadísticas por proceso y globales: ejecución, espera, bloqueo, retorno, penalidad, tiempo de respuesta, % uso CPU.
- Debugger visual paso a paso con controles Anterior, Siguiente, Play/Pausa.
- Round Robin con Quantum editable (Q=3 por defecto) y dispatcher PL opcional.

### 3. Funcionalidades interactivas
- Edición en vivo de procesos.
- Simulación paso a paso (debugger visual).
- Persistencia: Exportar JSON, Importar JSON, Restaurar valores por defecto.
- Cambio de tema claro/oscuro.

## Cómo ejecutar

1. Clona o descarga este repositorio.
2. Abre el archivo `index.html` directamente en tu navegador (doble clic).
3. No se requiere servidor web ni instalación de dependencias.

## Tecnologías

- HTML5 (semántico)
- CSS3 (variables CSS, tema claro/oscuro, diseño responsivo)
- JavaScript ES6+ (Vanilla JS, sin frameworks)

## Autor

Proyecto final de Sistemas Operativos.