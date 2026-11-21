# Etapa 2.3 — Escalado y medición de fauna menor

Base: 700a3aa2203c1c99741592e2ef1c3249d6b2ade7 (CI correcto). Catálogo/matriz: `coliseum-catalog-2026-11-20-v4`. Las carreras de v3 anteriores siguen siendo históricas y conservan datos originales.

## Configuración

La primera oleada predeterminada usa pequeñas criaturas punzantes (1/3/5/7 según 1–4 PJ); la segunda usa escorpiones (1/2/3/4); la tercera mezcla ambas especies. Se puede elegir fauna menor, fauna mixta, peligro o sortear la dificultad con la corriente de composición. Las propuestas peligrosas conservan los anteriores humanos y criaturas; los temas con mecánicas pendientes mantienen su advertencia y sustitución explícita. La composición inicial elegida manualmente tiene precedencia y no se recorta silenciosamente cuando supera el límite: se rechaza con explicación.

El límite predeterminado pasa de 8 a 15 tras las pruebas técnicas de 2.1 y el piloto reproducible de 180 encuentros de esta etapa. El máximo configurable continúa en 20. Se elimina el segundo límite oculto de `2 + 2×PJ` en la búsqueda de composiciones: el presupuesto de amenaza y el límite elegido gobiernan la propuesta. No se ajustan pesos, capacidades de PJ, atributos ni factores globales de amenaza.

## Protocolo reproducible

`npm run balance:minor-fauna -- 1000` ejecuta 36 composiciones: grupos alternados Saqueador/Lancero de 1/2/4 PJ × 1/5/10/15 enemigos × escorpiones/punzantes/mezcla alternada empezando por escorpión. Con un solo enemigo la opción mezcla es necesariamente un escorpión; sus semillas siguen siendo independientes. Cada composición tiene 1000 semillas derivadas del caso e índice; no hay curación, stock adicional ni adaptación durante el encuentro.

Límites explícitos: 30 rondas y 3000 acciones por encuentro. La política de finalización del escenario detiene al incapacitar al grupo, por lo que las muertes registradas no miden mortalidad posterior por Agonía. La victoria usa como denominador solo casos resueltos; censuras y errores se muestran por separado. Los intervalos de confianza son Wilson al 95%. Salud, Vigor gastado/recuperado, rondas, pasos y consumo de dados quedan disponibles como totales por caso. Cada fila conserva hashes de la primera y última semilla.

El informe se guarda progresivamente en `reports/minor-fauna-balance-v1.json`. `complete: true` y 1000 muestras en las 36 filas son condiciones para declarar terminado el muestreo. Puede reanudarse por chunks identificados, sin duplicar ni saltar semillas cuando los trabajadores terminan fuera de orden. `--fresh` inicia un informe nuevo. Los tiempos por encuentro son informativos: incluyen concurrencia y otras validaciones locales, no son un benchmark aislado ni una promesa de rendimiento en cualquier equipo.

## Estado de verificación

Muestreo completo: 36 filas ×1000 ensayos, cero errores. `node scripts/balance-minor-fauna.ts 1000 --verify` reprodujo los 72 extremos de semilla (primero/último de cada caso), comprobó los 40 chunks por fila y no encontró diferencias. Un bloqueo temporal de lectura en Windows interrumpió el guardado a las 21750 muestras; se conservó el checkpoint y se reanudó sin huecos. El guardado ahora utiliza archivo temporal y reemplazo atómico con reintento. El piloto histórico del catálogo v3 está separado en `reports/minor-fauna-performance-pilot.json`; no se mezcla con el informe v4.

Ejemplos de 15 adversarios (victorias y censuras sobre 1000 intentos, no porcentajes intercambiables):

| PJ | Escorpiones: victorias / censuras | Punzantes: victorias / censuras | Mezcla: victorias / censuras |
| --- | --- | --- | --- |
| 1 | 0 / 0 | 3 / 325 | 0 / 7 |
| 2 | 99 / 610 | 935 / 65 | 488 / 492 |
| 4 | 997 / 3 | 1000 / 0 | 1000 / 0 |

La fragilidad individual no implica que quince enemigos sean fáciles para un solo PJ. Las diferencias y la censura justifican conservar la selección de composición; no se presentan como dificultad oficial ni motivan una alteración silenciosa de fichas. Las medias locales de los casos con 15 enemigos quedaron entre 248 y 574 ms por encuentro automático completo, bajo carga concurrente; no son tiempos de cada animación ni garantías de FPS.

108 pruebas, tipos, lint, build y pruebas web correctos. Las pruebas nuevas verifican selección/sorteo reproducible de dificultad y presupuesto individual de 15 enemigos, todos los eventos y replay completo. Chrome mostró 15 enemigos, 35 zonas disponibles, pausa operativa y ancho de documento igual al viewport (1741 px), sin desborde horizontal. Captura en `reports/scaling-ui/01-quince-enemigos.png`. La jerarquía visual todavía usa tarjetas antiguas; su reemplazo obligatorio es 2.4, antes de Fase III.
