# Aceptación v0

| Decisión | Estado | Evidencia o brecha |
| --- | --- | --- |
| D01 | Verificado en motor | T22 restaura Vigor y conserva Salud y equipo entre encuentros. |
| D02 | Verificado en motor | Generación ponderada por semilla y pruebas T25–T26. |
| D03 | Implementado | Perfiles por combatiente en escenarios fijos o por ficha de especie en escenarios generados. |
| D04 | Verificado en motor | El generador elige mapa y posiciones con semilla. Tres plantillas de ensayo. |
| D05 | Verificado localmente | Tablero manual, automático y lotes con el mismo motor. |
| D06 | Verificado localmente | El perfil se edita y aplica desde Biblioteca. T24 conserva el resultado con y sin registro. |
| D07 | Implementado | Formularios de equipo y criaturas, editor JSON, validación y resolución de referencias compartidas al aplicar a una copia. |
| D08 | Pendiente en producción | Sesiones y PostgreSQL implementados. Falta provisionar y verificar Vercel y PostgreSQL gestionado. |
| D09 | Verificado localmente | Revisiones, conflicto, restauración y alias en test:web. Concurrencia real configurada en CI. |
| D10 | Verificado localmente | Tablero hexagonal, fichas y registro en el navegador. |
| D11 | Verificado localmente | T11 y T39. El modo manual pausa antes del daño. |
| D12 | Implementado | Panel legal, filtro por hexágono y motivos visibles de bloqueo para atacar, respirar y huir. |
| D13 | Parcial | Tablas editables, efectos y diagnóstico. Falta un editor de parámetros por módulo y compatibilidad completa de efectos. |
| D14 | Implementado | Distribuciones, percentiles, Wilson, métricas, CSV y comparación por muestras en un worker. |
| D15 | Implementado | Ficha de ensayo con atributos, Entrenamientos, Dominio, equipo y derivados visibles. |
| D16 | Verificado en motor | El equipo es fijo y el desgaste persiste en la cadena. |
| D17 | Verificado en motor | Capacidad, gasto, recarga, reserva y controles de encendido y alcance con costes declarados por escenario. |
| D18 | Verificado en motor | T19 y opción de cortar al incapacitar. |
| D19 | Verificado en motor | T21. Huida continúa en la cadena y no cuenta como victoria. |
| D20 | Verificado localmente | Guardar/reanudar y replay con hashes. T28 y T39. |
| D21 | Implementado | Editor JSON de prioridades y defensas. Asignación por combatiente y explicación de decisiones. |
| D22 | Verificado en motor | Validación de factibilidad, cuotas, inclusiones y combinaciones. |
| D23 | Verificado en motor | Distancias compatibles y diagnóstico T26. |
| D24 | Verificado en motor | Agresor fijo o ponderado por semilla. |
| D25 | Verificado localmente | 1×, 2×, 4×, instantánea, pausa y paso. Las decisiones determinan el resultado. |
| D26 | Parcial | Bloqueos, pérdidas al fin del turno o ronda, apilamiento y duración por turno, ronda y encuentro. Quedan disparadores declarativos más generales. |
| D27 | Verificado en motor | T27. Visibilidad provisional activable sin penalidades porcentuales. |
| D28 | Verificado en motor | Tres mapas con pesos editables en escenario generado. |
| D29 | Implementado | Control manual o IA por actor. Las transiciones de control quedan en el registro de la partida. |
| D30 | Verificado localmente | Escenarios fijos o generados disponibles en los tres modos. |
| D31 | Verificado localmente | Worker y checkpoints idempotentes. T30–T31 y test:web. |
| D32 | Verificado en motor | Límites de rondas, encuentros y acciones con censura. |
| D33 | Verificado en motor | Validación de snapshots, decisiones y reglas sin tabla. T38. |
| D34 | Implementado | Biblioteca, historial con filtros combinables y estudios con etiquetas, referencia, variantes y vínculos. |
| D35 | Implementado | ZIP con manifiesto, hashes, CSV, partidas vinculadas y remapeo transaccional con procedencia. |
| D36 | Verificado en motor | T35. Override por campo sobre una copia y comparación con la misma semilla. |
| D37 | Implementado | Tamaño muestral por escenario, Wilson al 95% y alertas de objetivos para medianas de Salud y rondas. |
| D38 | Verificado localmente | Hash scrypt, sesión firmada, alias y CSRF en test:web. |
| D39 | Implementado | Configuración general versionada, escenarios, variantes y trazabilidad por ruta de la configuración efectiva guardada. |
| D40 | Pendiente | La versión aún requiere completar los criterios parciales y validar producción. |

Las verificaciones del motor se ejecutan con `npm test`. La integración HTTP se ejecuta con `npm run build` y `npm run test:web`. La prueba local usa PostgreSQL embebido y el workflow de CI define un servicio PostgreSQL 17. La prueba visual local cubrió movimiento, ventana de defensa, guardado y reanudación, y un lote de 100 partidas en el worker.
