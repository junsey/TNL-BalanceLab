# The Night Land BalanceLab: plan de reparación y ampliación por etapas

**Versión:** 0.2, 19 de noviembre de 2026  
**Estado:** borrador de especificación para revisar antes de entregarlo a Codex  
**Destino:** [`junsey/TNL-BalanceLab`](https://github.com/junsey/TNL-BalanceLab), rama `main`  
**Base de inicio publicada:** `ade2f70cb6cf1ccabebc5017b2f216c24d28385d`. La auditoría preliminar original partía de `3d1081f1bf2d509ca5102a6d5dde9f25c9d346e4`.  
**Objetivo:** restaurar la correspondencia con las reglas actuales del juego, ampliar las herramientas de balance del Coliseo, UNIFICAR SU INTERFAZ DE COMBATE con el Laboratorio y añadir creación de personajes reproducible, manual o aleatoria. Este documento NO modifica el CORE ni aprueba nuevas reglas del juego.

## 0. Orden de trabajo, seguridad y contrato para Codex

Este archivo es un **plan de implementación por tareas atómicas**, no una orden de ejecutar las tres fases sin revisión humana. Se debe completar en orden, terminando y publicando cada etapa antes de comenzar la siguiente. **No comenzar este plan hasta que termine y se publique el lote de Codex que ya está en ejecución.** No revertir a ciegas sus cambios ni mezclar código de ese lote con las instrucciones de esta versión.

**Regla obligatoria para CADA etapa:**

1. Registrar SHA de `main` de partida y los archivos que se inspeccionarán; trabajar exclusivamente el alcance de esa etapa.
2. Comparar con las fuentes de reglas del apartado 1, sin confiar en los documentos técnicos históricos cuando discrepan del CORE vigente.
3. Implementar las modificaciones mínimas necesarias, añadir/actualizar pruebas pertinentes y probar la interacción en navegador si afecta la interfaz.
4. Ejecutar al menos `npm test`, `npm run typecheck`, `npm run lint` y `npm run build` según disponibilidad. Ante fallos existentes, documentar cuál era previo y cuál introdujo la etapa; **no declarar verde una verificación que no se ejecutó**.
5. Crear **un commit coherente por etapa**, con mensaje descriptivo `fix(...)`, `test(...)` o `feat(...)`; hacer **push explícito a `origin/main`** al finalizarla. Verificar en remoto el SHA publicado, no solo el commit local. Si `main` avanzó por trabajo concurrente, traer esos cambios de manera segura, resolver conflictos sin sobrescribir trabajo de otro agente y volver a ejecutar los tests. Nunca usar `push --force`.
6. Entregar una nota breve de cierre: SHA remoto, archivos cambiados, reglas aplicadas, pruebas ejecutadas (resultados), divergencias pendientes y capturas cuando procedan. Solo entonces comenzar la siguiente etapa.

**Estados reglamentarios:** `CORE_DEFINIDO` (aplicar exactamente), `BANCO_DE_PRUEBAS` (valor experimental citado y versionado), `PENDIENTE_DE_REGLAS` (no inventar ni activar mecánica definitiva), `HISTORICO` (datos conservados pero ajenos al balance actual). No confundir *una regla todavía sin terminar* con una elección opcional del jugador.

**Prohibiciones transversales:** no calcular ninguna habilidad ofensiva mediante la Vulnerabilidad descartada; no almacenar `capacidad ofensiva` como estadística autoritativa; no construir fórmulas alternativas de ataque en la pantalla de inicio; no usar resultados de simulaciones antiguas para validar el nuevo balance; no cambiar el contenido de las reglas en CORE 01/02/03 por comodidad técnica; no sustituir valores de fichas por cifras inventadas. Todo cálculo y estado debe poder auditarse desde datos de entrada y eventos.

## 1. Fuentes, precedencia y trazabilidad

1. **CORE 01, Resolución de acciones**: https://docs.google.com/document/d/1VStCBzbHJWPHsW_VRNJdnbKklWAmD8bzZrSTDDeskHY/edit
2. **CORE 02, Creación de personajes**: https://docs.google.com/document/d/15D3CWXjoYmwbRMJFsUhT0F7Le5_idJLIfMG-GFGoSdo/edit
3. **CORE 03, Combate**: https://docs.google.com/document/d/1sXRXLuB6rFQ8XTGH0BesdaFhgWm0mcIBm4Rtb8Y_ZsI/edit
4. **Atributos y habilidades**: https://docs.google.com/document/d/1MADQVhqkQG7G-IEky58MYu-04b_HW1MtijLxDOIC3W0/edit
5. **Nacionalidades y Arquetipos**: https://docs.google.com/document/d/155OKRQ0wxXLh55RTZHDPq9fF_prjEnZ381QCQHEWjtU/edit
6. **Auditoría de código preliminar del 19/11/2026**: https://docs.google.com/document/d/1sp7YjAhWP5x5t5HhnAtgn3H0gxFYnkdnybqeEXDkfdc/edit
7. **Novela de W. H. Hodgson, fuente primaria para bestiario**: https://www.gutenberg.org/cache/epub/10662/pg10662.html.utf8

El CORE vigente tiene precedencia sobre `docs/rules-traceability.md`, `docs/unresolved-rules.md` y antiguos módulos de Vulnerabilidad. Las tablas documentadas como propuestas y las armas/armaduras del banco de pruebas no se elevan a definitivas. Guardar en los nuevos registros `rulesVersion`, `catalogVersion`, `schemaVersion`, `rngVersion` y fuente de regla/estado experimental donde corresponda.

---

# FASE I: AUDITAR Y REPARAR EL SISTEMA ACTUAL (ANTES DE AÑADIR CONTENIDO)

## Etapa 1.1 — Revisión verificable del generador de dados y reproducción

**Propósito:** investigar resultados aparentemente extraños antes de confiar en cualquier estadística del laboratorio.

**Código a inspeccionar:** `packages/engine/src/rng.ts`, `dice.ts`, `state.ts`, `generator.ts`, `simulation.ts`, `tactical.ts`, `coliseum.ts`; pruebas existentes y consumidores del UI. La implementación auditada utiliza Mulberry32 con semilla UTF-8/mezcla hash, rechazo para evitar sesgo de módulo en `rollDie`, decenas/unidades compartidas para ventaja/desventaja, y semillas derivadas por índice. La lectura estática **no demuestra por sí sola un sesgo**, ni se presupone que todas las tiradas observadas son correctas.

**Trabajo:**
- Probar `rollDie` con d2, d3, d4, d6, d8, d10, d12, d20, d100 y valores de borde. Cada cara debe estar en `[1,n]` y ser equiprobable dentro de tolerancia estadística previamente fijada; efectuar pruebas de chi-cuadrado o criterio equivalente y reportar metodología, número de muestras, intervalo y semilla.
- Verificar especialmente `rollPercentile`: 00 representa 100; combinaciones 01..99; pares decenas/unidades; ventaja conserva la decena menor, desventaja la mayor y comparte unidades según CORE 01; cancelación exacta; resultado 01/100; no hay saltos, sobre-representación ni correlación manifiesta entre secuencias consecutivas. Separar errores de interpretación visual de defectos del RNG.
- Verificar `parseDice` y `rollDice` para expresiones autorizadas, modificador `+K`, suma de caras, min/max y valores de entrada inválidos; no permitir expresiones arbitrarias, silenciosas o dependientes de `Math.random` en otra ruta.
- Trazar el ciclo completo: semilla → consumo de RNG → tirada natural → modificación → grado → daño → evento → replay → visualización. Detectar *tiradas repetidas, reusadas por error, consumidas antes de una animación o generadas una segunda vez por la UI*.
- Probar determinismo entre ejecución manual, automática y por lotes para una misma secuencia válida de decisiones, y entre distintos tamaños de chunk/batch. Confirmar que distintas semillas no producen inadvertidamente el mismo enfrentamiento.
- Añadir prueba estadística reproducible separada de la suite rápida, con reporte de frecuencias del d100 y de sumas típicas (ej. 2d6). No tratar una desviación aislada como prueba de sesgo; criterio objetivo, tamaño muestral y falsas alarmas.

**Aceptación:** pruebas unitarias y estadísticas documentadas, replay exacto y un informe de hallazgos con ejemplos de semilla; si el RNG es correcto, dejarlo sin cambios. No reemplazar el algoritmo por intuición. **Commit y push a `main` de esta etapa.**

## Etapa 1.2 — Una única fuente de cálculo para habilidades y ataques

**Hallazgos preliminares H01, H03, H04, H07.**

**Trabajo:**
- Hacer inventario y mapa de llamadas a `deriveCharacter`, `attackTarget`, `classify`, `compareResistanceAttack`, `previewAttack`, `declareAttack` y consumidores del Coliseo, laboratorio, pruebas y blanco pasivo.
- Separar **solo para lectura histórica** la ruta `mastery + vulnerability` y deshabilitarla en las simulaciones nuevas del CORE. No eliminar registros antiguos ni compararlos con datos nuevos como si fueran equivalentes.
- La prueba de habilidad común usa `valor = min(100, Atributo asociado + Entrenamiento)`; para armas `min(100, Atributo asociado del Dominio + Dominio)`; para acciones propias de criaturas `min(100, Atributo asociado + valor de la acción)`. Atributos humanos entre 5–50 y Entrenamientos/Dominios entre 0–50 según CORE. El sistema debe leerlo de ficha y catálogo, **no** del campo precomputado `mastery` ni del bloque paralelo de configuración.
- Impacto: `d100 natural + Resistencia natural del objetivo + bonificación de armadura equipada + bonificación temporal aplicable de escudo <= valor total de ataque`. Grados sobre el resultado modificado, umbrales normal / mitad / cuarto con redondeo hacia abajo. Natural 100 es pifia; natural 01 es crítico según CORE 03, pero su interacción definitiva con Resistencia/defensas sigue abierta: mantener una única política técnica provisional **identificada, no un selector obligatorio de reglas en el combate**. No presentar una política experimental como definitiva.
- Resistencia natural se almacena como valor propio del cuerpo/ficha; no se deriva de Destreza. Armadura aporta Resistencia; reducción directa solo si su modelo la concede. Blindaje y resistencia no reducen el mismo daño dos veces.
- Prohibir duplicación de atributo/dominio/umbral autoritativo; las cifras derivadas pueden usarse como caché **invalidable y verificable** sin convertirse en datos de ficha.
- Fijar fixtures de ensayo explícitos y etiquetados sin reintroducir valores inventados como canon, y crear tests de cambiar Destreza, Dominio, arma, objetivo, armadura y escudo.

**Aceptación:** un mismo personaje, arma y defensor producen idéntico cálculo en todas las vías del motor; un cambio de Atributo o Dominio propaga su efecto; la ruta histórica no contamina simulaciones nuevas. **Commit y push.**

## Etapa 1.3 — Migración de fichas, esquemas y presets sin pérdida de datos

**Hallazgos H02, H03, H04 y H06.**

**Trabajo:**
- Actualizar `packages/schemas`, `fighterState`, `character`, `creature`, presets, serialización y migraciones para que los datos de combate y las acciones sean conformes a CORE 02/03; eliminar la obligatoriedad operativa de `vulnerability` para nuevas fichas. Las fichas existentes del laboratorio se migran una sola vez de manera explícita con trazabilidad, o quedan identificadas como `HISTORICO` si no existe una transformación sin pérdida.
- Mantener Atributos, habilidades/Entrenamientos y Dominios separadamente; catálogo de armas identifica Dominio y Atributo asociado; cada acción de criatura incluye Atributo y valor propio, con coste y dado de daño individual.
- Resistencia natural en ficha y aportes de equipo por separado. Confirmar límites: la fórmula de generación general de Resistencia está **pendiente en CORE 02/03**, por lo que no crear una distribución arbitraria para personajes nuevos. Los fixtures temporales permiten ensayar un escenario versionado, no generan una regla.
- Implementar validaciones de completitud: ficha compatible con combate vs ficha incompleta en campos todavía no reglados; señalar campo faltante de modo específico y sin abrir el antiguo formulario global de parámetros.
- Conservar importación de datasets/replay históricos mediante versiones y migración segura; no reinterpretar silenciosamente cifras de Vulnerabilidad como Resistencia.

**Aceptación:** probar persistencia, carga, exportación/replay de formatos históricos y nuevos; los presets activos inician sin pedir reglas; las capacidades son siempre derivadas. **Commit y push.**

## Etapa 1.4 — Auditoría funcional de la cadena completa de combate

**Trabajo:** implementar y verificar pruebas contra ejemplos derivados de CORE 01 y CORE 03: iniciativa (mínimo agresor, Alerta estrictamente menor, tres grupos con libertad de intercalación); una Mayor + una Menor; coste Vigor y recuperar mediante Respirar/Tomar Aliento; oportunidad por alcance o abandonar Cerca; Esquivar, Parar y Bloquear con escudo, incluyendo costes y momento de declaración; daño por grado/arma, intercepción, reducción directa y deterioro según fichas; Barrido, Patear, Escabullirse, Arrojar arma, recoger, preparar ataque, manos y daga guardada; inyecciones, Incapacitación, Agonía y muerte. La criatura tiene sus propias acciones y puede tener ataques naturales a 0 Vigor y no usar la recuperación humana.

**Casos mínimos obligatorios:**
- Destreza 25 + Dominio 35 = 60; d100 natural 09 vs Resistencia 4 → resultado modificado 13, éxito a cuarto (13 <= floor(60/4)=15), salvo regla extrema específica.
- d100 natural 76 vs Resistencia 5 → 81, fallo para capacidad 60; no infligir daño.
- Esquivar y Parar son pruebas separadas; Bloquear reutiliza el dado atacante y suma el escudo a Resistencia, sin un nuevo dado de bloqueo.
- La misma tirada para todos los blancos en Barrido y daños/resistencias individuales; división entera del daño antes de intercepción.
- Un cambio de arma confirmado consume una Menor; cancelar y explorar menús no consumen nada.
- Una sola preparación dispara una sola vez y termina al expirar; no preparar Respirar o Tomar Aliento en el ensayo de CORE 03.

**Aceptación:** matriz regla → función → pruebas → evidencia; tests de regresión de todos los casos anteriores. Si una tabla está pendiente, registrar `UNRESOLVED_RULE` o mecanismo equivalente, nunca completarla con una interpretación anónima. **Commit y push.**

## Etapa 1.5 — Consistencia entre interfaz, ejecución automática, laboratorio y métricas

**Trabajo:** confirmar que UI, simulación automática, lotes, estudios, Coliseo y blanco pasivo usan **la misma** lógica activa, salvo módulos históricos etiquetados y aislados. Verificar que el visor muestra el resultado modificado como número principal y debajo «**XX** resultado natural»; no repetir Salud/Vigor en líneas técnicas visibles; log detallado a demanda; menú por niveles para Cambiar arma y Preparar ataque; inicio sin selector de reglas. Comprobar el flujo de resultados de motor hacia animaciones sin tirar dados nuevamente. Revisar si el lote de Codex anterior ya arregló estos puntos y no duplicar trabajo.

**Resultados:** versionado de reglas en cada lote/informe, separación de simulaciones obsoletas, tests end-to-end de combate y capturas UI, warnings cuando se compare información de versiones incompatibles.

**Aceptación:** una partida reproducible con misma semilla y mismas decisiones produce los mismos eventos, totales de tiradas y resultados en cada modalidad; CI y build pasan; auditoría de código H01–H12 reevaluada con evidencias `resuelto / pendiente / no aplica`. **Commit y push.**

---

# FASE II: COLISEO, BESTIARIO DE AMENAZA BAJA Y EQUIPAMIENTO

## Etapa 2.1 — Dos criaturas pequeñas para enfrentamientos numerosos

**Objetivo:** disponer de opciones significativamente más débiles que un humano armado y evitar que la primera oleada obligue a luchar contra saqueadores comparables a un PJ.

**Fuente literaria:** en *The Night Land* se describen seres extraños del tamaño aproximado de una cabeza, semejantes a escorpiones, achaparrados, cerca de pozos de fuego; también se mencionan pequeños seres capaces de picar cuya apariencia/especie no se determina completamente. Fuente: Project Gutenberg, https://www.gutenberg.org/cache/epub/10662/pg10662.html.utf8 . **Los nombres en español, características de combate y clasificación de amenaza que siguen son interpretaciones de diseño PARA EL JUEGO, no estadísticas canónicas de Hodgson.** La segunda entrada no debe atribuirse falsamente a una especie detallada en la novela.

### Perfil C1: Escorpión de los Pozos de Fuego (`fire_pit_scorpion`)
- Naturaleza: pequeña criatura terrestre, caparazón compacto, hábitat junto a pozos de fuego. Inspiración textual identificable.
- Función de balance: enemigo frágil relativamente protegido, útil en grupos 4–12.
- **Especificación provisional de ensayo, no CORE:** Salud objetivo aproximado 9–14; Resistencia natural 2–3; ataque Mordida/Picadura o equivalente sencillo a 1d4 de daño base; éxito a mitad añade 1d2 y a cuarto añade 2d2; tipo de daño perforante. No activar veneno, estados ni ataques de zona sin regla documentada.
- Propuesta compatible con el generador actual de criaturas: Fuerza `10 + 1d6` (11–16); Salud `3 + 1d3 + floor(Fuerza/2)` (9–14); Resistencia natural `1 + 1d2` (2–3). Demás Atributos mediante perfil específico validado por el esquema, diseñados para que el valor total de su acción (Fuerza + valor) sea modesto, no 60–80; esos valores exactos deben quedar **rotulados como banco de pruebas** y basarse en una ficha completa versionada, no en totales ofensivos fijos.
- Acción básica a 0 Vigor si corresponde al diseño de criatura; no asignar automáticamente Respirar/Tomar Aliento humano ni reacción de Esquivar sin ficha.

### Perfil C2: Pequeña criatura punzante (`small_stinging_creature`)
- Naturaleza: organismo pequeño no identificado en detalle por la novela. Nombre descriptivo **no taxonómico**.
- Función de balance: enemigo muy frágil, ofensiva escasa, grupos 6–15.
- **Especificación provisional de ensayo:** Salud objetivo 5–8; Resistencia natural muy baja; ataque Picar de 1d3 de daño base, tipo perforante, extras a mitad/cuarto **conforme a su ficha explícita de banco** (sugerencia +1d2 / +2d2). No asignar automáticamente veneno: el texto habla de seres que pican, no establece un efecto reglamentario.
- Ejemplo de generación compatible: Fuerza `5 + 1d4` (6–9); Salud `1 + 1d3 + floor(Fuerza/2)` (5–8); Resistencia `1d2` (1–2), **más baja que el escorpión**. El resto de atributos y valor de acción deben almacenarse como un registro completo de bestiario de ensayo; su comportamiento se debe medir con pruebas, no deducir una «capacidad ofensiva» fija.
- No asumir uso de Vigor ni recuperación automática; ficha decide. Aceptar que muchas criaturas en un mismo encuentro utilicen múltiples hexágonos o distribución de posiciones según reglas del tablero, no compartir hexágonos sin validar semántica.

**Acciones de implementación:** completar ambas fichas en `packages/fixtures/src/coliseum.ts` (y catálogo de criaturas normalizado que resulte de fase I), etiquetar fuente literaria y provisionalidad, definir acciones/rasgos/comportamiento de manera mínima pero consistente, añadir nombres y filtros al selector, crear pruebas de rangos generados en miles de semillas, extremos, tiradas y amenaza frente a Saqueador. Asegurar que las criaturas nunca heredan la daga del humano simplemente por usar un modelo técnico de arma natural. **No copiar nuevas reglas al CORE.**

**Aceptación:** ambas criaturas seleccionables por separado, aparecen al armar una oleada y generan fichas reproducibles, son materialmente más frágiles que Saqueador, se pueden lanzar encuentros de 1, 5, 10 y 15 individuos sin cuelgues (con límite técnico explícito). **Commit y push.**

## Etapa 2.2 — Armamento, armaduras y objetos del Coliseo

**Trabajo:** exponer de modo consistente el catálogo de armas y armaduras de ensayo de CORE 03: Daga, Espada corta, Espada ancha, Hacha de combate, Espadón, Lanza larga, Diskos apagado/encendido, armaduras ligera/media/avanzada pesada y consumibles experimentales; conservar daño base, extras por grado, daño cortante/perforante/contundente, alcance, manos, Vigor y Energía según ficha. Equipamiento humano según su ficha; criaturas con acciones naturales específicas en lugar de armas humanas. Un arma debe referir al Dominio y Atributo asociados, y estos toman Entrenamiento desde el PJ. Propiedad Arrojadiza solo para modelos que la tengan (no casilla libre que la agregue arbitrariamente a cualquiera). Modos tecnológicos y Durabilidad: conservar valores del banco como provisionales, o señalar de forma honesta si la ficha no especifica valores, sin inventar recargas y umbrales.

**Interfaz:** editor de equipamiento por personaje de Coliseo con manos derecha/izquierda, arma principal, reserva, armadura, escudo si catalogado, objetos y cambios coherentes. Debe permitir comparar armamento entre ejecuciones, guardar configuraciones y exportarlas. Separar posesiones narrativas del Arquetipo de carga de combate específica del laboratorio.

**Aceptación:** cambiar arma altera los daños/costes y dominio aplicable, pero **no modifica arbitrariamente Atributos**; armadura suma Resistencia, no resta Vulnerabilidad; importar/repetir conserva el equipo. **Commit y push.**

## Etapa 2.3 — Escalado de encuentros numerosos y balance

**Trabajo:** actualizar la matriz inicial de oleadas, que hoy prioriza saqueadores, para incorporar primeras oleadas de criaturas pequeñas, y permitir elegir/aleatorizar grupos fáciles, mixtos y peligrosos sin imponer la misma dificultad a todos. Revisar `initialWavePresetMatrix`, `packThreat`, `defaultColiseumSettings.enemyCap` y validaciones: la configuración actual tiene tope técnico editable hasta 20, con valor predeterminado 8. Subirlo solo tras medir performance de IA, iniciativa, acumulación de eventos, dibujo de sprites/hexágonos y tasa de censura. Nunca confundir mayor número de enemigos con igual cantidad de acciones disponibles para cada uno.

**Ensayos sugeridos:** 1/2/4 PJ, 1/5/10/15 criaturas pequeñas, partidas con y sin mezcla; 1000+ ensayos independientes por conjunto, seed reproducible, tasa de victoria, duración, daño a Salud y gasto de Vigor, muertes, errores y censuras. Comparar perfiles **solo dentro de la misma versión de reglas**. No ajustar a mano un factor global de amenaza hasta disponer de las estadísticas de base.

**Aceptación:** seleccionar fauna menor como oleada inicial, formatos de 10+ o 15 enemigos dentro del límite medido y sin pérdida de eventos; reporte de balance reproducible por composición. **Commit y push.**

## Etapa 2.4 — Unificación OBLIGATORIA de la UI de combate del Coliseo con el Laboratorio

**Tipo de intervención:** reutilización/refactorización de componentes existentes. **No** rediseñar otra pantalla de combate, **no** copiar JSX/CSS en dos versiones, **no** modificar el motor para adaptarlo a diferencias visuales. Esta etapa es atómica y termina con pruebas, commit y push a `main` antes de iniciar Fase III.

### Diagnóstico verificado directamente en GitHub (commit base auditado `3d1081f`)

- **Laboratorio, fuente del diseño aprobado:** `apps/web/app/lab.tsx`, aprox. líneas 1310–1410, utiliza `div.combat-layout` con `PartyBar` de `./party-bar`, los cuatro slots de personaje y `CommandMenu` **dentro del slot de comandos**, `div.combat-center` con `TacticalBoard` y `LatestResolution`, y `EnemyPanel` lateral. Su resolución usa `EncounterWindow` e `InitiativeSequence`. La visual final aprobada tras los cambios en curso es la referencia, no una captura antigua.
- **Coliseo, divergencia que debe corregirse:** `apps/web/app/coliseum.tsx`, aprox. líneas 1268–1400, monta un `div.coliseum-roster` con **botones/tarjetas independientes para TODOS los combatientes**, seguido de `div.coliseum-combat` con `TacticalBoard`, y un `div.coliseum-command` flotante/independiente que muestra `h3` y `CommandMenu`. Debajo de este layout también incluye `LatestResolution`, `CombatLog` y `EncounterWindow`. Es la causa estructural de que la interfaz no tenga la misma jerarquía del Laboratorio. No es un problema de colores: son contenedores, posiciones y selección diferentes.
- **Componentes ya disponibles:** `apps/web/app/party-bar.tsx` exporta `PartyBar` con cuatro espacios, indicadores Mayor/Menor, barras de Salud/Vigor, ficha ampliable y slot de comandos; `apps/web/app/combat-view.tsx` contiene `TacticalBoard`, `EnemyPanel`, `CommandMenu`, `Resource`; `apps/web/app/encounter-window.tsx` contiene `EncounterWindow`. El Coliseo YA importa `TacticalBoard`, `CommandMenu` y `EncounterWindow`, pero NO reutiliza `PartyBar` ni `EnemyPanel` de la forma del Laboratorio.
- **Limitación relevante:** `PartyBar` admite hasta 4 actores; el Coliseo permite 1–4 PJ. Su uso debe incluir todos los PJ humanos de `run.party` y sus estados actuales en `state.actors`, NO limitarse al primero como hace hoy el Laboratorio de prueba. Las criaturas enemigas, incluso 10–15, van al mapa y al panel/listado lateral reutilizable; NO deben ocupar slots de PJ en la barra ni generar decenas de tarjetas de plantilla encima del tablero.

### Disposición exacta requerida en combate activo

Reutilizar la misma **estructura de composición** y los mismos componentes que termine utilizando el Laboratorio en la última implementación aprobada. Escribir un componente de layout compartido (por ejemplo, `CombatLayout` en `apps/web/app/`) o extraer el que ya exista tras el lote de Codex; ambos modos deben consumir ese componente, no mantener dos árboles JSX independientes. El lugar de uso puede recibir `mode='lab' | 'coliseum'` y datos/callbacks, pero NO bifurcar el diseño según el modo.

En desktop, los elementos y la relación visual deben ser los siguientes:

1. **Zona principal de combate:** mismo tablero hexagonal (`TacticalBoard`), misma escala visual/selección de zona y objetivos, y panel de enemigos equivalente al `EnemyPanel` aprobado. Las criaturas no ganan cartas sobredimensionadas alrededor del tablero.
2. **Franja inferior fija:** en el orden `[COMANDOS] [PJ 1] [PJ 2] [PJ 3] [PJ 4]`, con el mismo `PartyBar` y los mismos estilos de la vista principal. El panel `COMANDOS` aloja `CommandMenu` en su primer slot. Los cuatro slots presentan hasta cuatro PJ vivos/incapacitados, incluso si no tienen turno. Los vacíos se mantienen como slots vacantes.
3. **Menús idénticos:** `Ataque`, `Movimiento`, `Habilidades y maniobras`, `Objetos` y `Preparar acción`; las opciones `Cambiar arma` y `Preparar ataque` usan sus **propias capas internas del panel**, con `Volver`. Nada se despliega incrustado debajo de la lista aumentando el scroll. Los controles directos `Respirar`, `Tomar Aliento` y `Pasar turno` permanecen en la misma posición y con el mismo comportamiento del Laboratorio. No crear alternativas del menú específicas del Coliseo.
4. **Intercambio e iniciativa idénticos:** usar exactamente el mismo modal `EncounterWindow`, los mismos sprites, presentación secuencial de tiradas, resultado **modificado** grande y debajo el natural en negrita (por ejemplo, `09 resultado natural`), barras, variaciones de Salud/Vigor, `Continuar`, replay/pausa/velocidad y secuencia de iniciativa. Evitar `ready=true` fijo o otra lógica de autoplay que produzca flujos diferentes; adaptar datos y callbacks del Coliseo al controlador de presentación compartido. No duplicar las tiradas ni alterar los eventos.
5. **Navegación y estados:** seleccionar un PJ en su slot de la barra cambia el actor activo solo cuando sea legal; puede verse la ficha de cualquier PJ sin consumir acciones. Los enemigos solo se seleccionan como objetivos por el mismo mapa/panel que usa el Laboratorio. Si el motor tiene una defensa pendiente, el panel de comandos debe enfocarse en el defensor correspondiente, independientemente de si está en los slots de PJ o es una criatura controlada por IA; no ofrecer comandos ilegales a otros PJ. Se reflejan correctamente las tres fases de iniciativa, acciones Mayor/Menor, turno de IA, fin de combate y replay.
6. **Responsive:** en pantallas estrechas mantener la misma jerarquía y funcionalidad mediante layout adaptativo, sin recortar los 4 slots ni esconder las acciones. Solo permitir scroll en las áreas internas previstas, no en formularios apilados.

### Qué debe desaparecer de `coliseum.tsx`

- El bloque de presentación `div.coliseum-roster` que pinta una **tarjeta por cada combatiente** como sustituto de la barra de PJ + panel de enemigos. No eliminar la información de Salud/Vigor: pasa a los componentes compartidos.
- La envoltura `div.coliseum-command` y su `h3` separados del layout inferior; se reemplazan por el slot `COMANDOS` compartido.
- Cualquier CSS de `apps/web/app/styles.css` que duplique o contradiga a `.combat-layout`, `.party-bar`, `.combat-center`, `.enemy-panel`, `.command-*`, `.exchange-*`. No borrar estilos del apartado **configuración, oleadas, progreso, resultados, calibración ni métricas** que siguen siendo propios del Coliseo.
- Cualquier copia de lógica de presentación: preferir props/controladores comunes. Asegurar que `LatestResolution` y `CombatLog` no vuelven a introducir barras o cambios de recursos redundantes en el centro del combate.

### Qué debe conservarse

**Toda la funcionalidad propia del Coliseo:** selección de 1–4 PJ, perfiles y composición de oleadas, modo independiente/supervivencia, configuración/calibración, equipos y recursos persistentes, control de IA/manual, resultados y estadísticas, descarga/reanudación de carrera, historial y límites técnicos. Se muestran **antes/después de combatir** o en paneles secundarios discretos según corresponda; no justifican una interfaz de combate distinta.

### Comprobaciones de aceptación obligatorias

- **UI-01:** con 1 PJ, el Coliseo y el Laboratorio se ven estructuralmente iguales en combate: tablero, panel enemigo, barra inferior con `[COMANDOS][PJ1][vacío][vacío][vacío]`, acciones, colores y dimensiones compartidas.
- **UI-02:** con 4 PJ, aparecen cuatro slots de PJ reales, con Salud/Vigor y Mayor/Menor correctos; se puede seleccionar un PJ legal y ejecutar ataque, defensa, movimiento, consumible y cambio de arma sin usar la antigua lista de tarjetas.
- **UI-03:** con 10–15 criaturas, el tablero y los enemigos siguen disponibles, sin colocar 10–15 tarjetas por encima; no hay overflow horizontal ni scroll vertical desmesurado en el combate.
- **UI-04:** ataque, defensa, iniciativa y replay usan los MISMOS componentes/controladores y el MISMO resultado del motor en ambos modos; natural/modificado, grado de éxito y daño no cambian según la pantalla.
- **UI-05:** `Cambiar arma` y `Preparar ataque` navegan a un layer interno en ambos modos y `Volver` regresa al padre sin consumir acciones; `COMANDOS` permanece abajo.
- **UI-06:** fin de oleada, recuperación de supervivencia, guardado y reanudación siguen operativos y no alteran las fichas ni el orden de acciones.
- **UI-07:** capturas comparativas **lado a lado** de Laboratorio vs Coliseo con 1 PJ y con 4 PJ, además de 15 criaturas, intercambio de ataque y menú de cambiar arma. Revisión manual visual antes del push.
- **UI-08:** ejecutar `npm test`, `npm run typecheck`, `npm run build` y los tests web/e2e disponibles. Ninguna regresión de reglas o interfaz.

**Entrega atómica:** documentar componentes extraídos/reutilizados y CSS eliminado, evidencias de pruebas, capturas y compatibilidad; un commit con nombre identificable (por ejemplo, `refactor(ui): share combat layout between lab and coliseum`) y push verificado a `main` antes de empezar Fase III. **No implementar un nuevo look ni rediseñar el Laboratorio para que se parezca al Coliseo: el sentido de la convergencia es del Coliseo hacia el diseño ya aprobado.**

---

# FASE III: CREACIÓN DE PERSONAJES CON REGLAS DEL JUEGO

## Etapa 3.1 — Modelo de creación y tablas ampliables

**Objetivo:** introducir «Crear personaje» como pantalla principal separada del Coliseo/combate, con generación aleatoria **y** modo manual legal, usando datos reales de los documentos. No equiparar este creador con el editor libre de pruebas.

**Orden obligatorio CORE 02:** Procedencia/área → localidad disponible → origen social → Arquetipo obtenido según tabla de esa procedencia y origen → Atributos → Entrenamientos (incluidos beneficios/especializaciones y 20 puntos libres bajo límites) → reservas/Resistencia → posesiones → equipamiento → confirmar ficha.

**Tablas de procedencia documentadas:** 01–10 Upper Cities, 11–40 Lower Cities, 41–65 Base, 66–80 Underground Fields, 81–90 Lesser Redoubt, 91–00 Outside. Para las Upper Cities hay una segunda tabla 01–100: Augyre Siege 01–17; Ficino City 982 18–32; Midmost City 33–39; Penultimate City 40–46; High Aerie 47–52; Star Chambers 53–58; Ogygia City 1000 59–64; Chamber of the Great Spy Glass 65–70; Core Chamber 71–75; Foreteller City 76–80; Hall of Concurrence 81–85; City of Studies City 1004 86–90; K City 881 91–95; Great Embrasure 96–100. **No inventar el resto de tablas**.

**Advertencia de cobertura fundamental:** el documento «2. Nacionalidades y Arquetipos» contiene tablas completas de origen social y Arquetipo para **Augyre Siege, Ficino City 982 y High Aerie**, además de un catálogo general de Arquetipos y sus Entrenamientos/posesiones; otras locaciones están listadas pero **no tienen todas las tablas completas** en ese documento. No extrapolar las tablas de Augyre o High Aerie a Midmost, Ogygia u otras ciudades, y no repartir uniformemente las opciones faltantes. El generador aleatorio completo v0 debe operar solo sobre **rutas de creación resolubles de punta a punta**, y dejar visible cuánta cobertura del mundo está pendiente. En modo manual, las locaciones incompletas pueden consultarse, pero no deben generar una ficha «legal y completa» sin la información faltante.

**Estructura de datos:** catálogos declarativos por IDs estables, tabla de probabilidad por rangos enteros 01–100 (00=100), opción condicional por sexo para High Aerie y cualquier otro condicionante explícito, origen social, arquetipos permitidos, modificadores por atributo, habilidades/arquetipos y equipo/posesiones. Cada entrada incluye `sourceDoc`, `sourceSection`, `status` y `schemaVersion`. Validación automática de huecos y superposiciones de rangos; si una rama de 1d100 conduce a contenido no desarrollado, el programa **no debe alterar sus probabilidades sin consentimiento**: registrar «rama sin contenido implementado», permitir repetir la generación solo a pedido o elegir ruta completa en modo asistido. Mostrar si la tirada es auténtica sobre tabla parcial o muestra deliberadamente condicionada a rutas disponibles; no llamar «aleatorio canónico» al muestreo condicionado.

**Aceptación:** catálogo versionado que admite nuevas localidades/tablas sin modificar el algoritmo, exactitud de rangos, condiciones y fuentes, import/export del catálogo, pruebas contra las tablas completas. **Commit y push.**

## Etapa 3.2 — Motor determinista de creación aleatoria

**Trabajo:** usar el RNG auditado en etapa 1.1 y conservar seed + historial completo de dados para reproducir **cada** elección: área, ciudad, origen social, Arquetipo, rasgos y beneficios, Atributos modificados, Entrenamientos y posesiones aleatorias. Implementar fórmulas de Atributo documentadas: Normal `1d10×5`; Muy favorecido `(1d4+6)×5`; Favorecido `(1d6+4)×5`; Levemente favorecido `(1d8+2)×5`; Levemente perjudicado `1d8×5`; Perjudicado `1d6×5`; Muy perjudicado `1d4×5`. Si existieran categorías adicionales, tomarlas del documento, no inventarlas.

**Beneficios y límites:** Arquetipos aportan fórmulas específicas de Entrenamiento; distinguir habilidad base, Entrenada y Memoria; habilidades adicionales elegibles distintas entre sí y no duplicadas; restricción de Seer en Servicio/Veterano y Facultades distintas; mejoras especiales de Veterano de la Tower y Seer Veterano sustituyen un dado por su máximo; decisiones secundarias de Foreteller, Monstruwacan, Watchman, Censor, Chaperone y otros donde estén documentadas; los 20 puntos adicionales se asignan entre 2+ habilidades con los límites y restricciones CORE 02. No recortar resultados de fórmulas erróneas para hacerlas entrar en 50: reportar inconsistencia de fuente.

**Derivados CORE 02:** Salud máxima provisional `25 + floor(Fuerza/2)`; Salud Mental máxima provisional `25 + floor(Voluntad/2)`; Vigor máximo `4 + floor((Fuerza+Voluntad)/20)`. Resistencia natural tiene generación pendiente: **no asignar 4, 8 ni otra constante automáticamente como si fuera regla**. La ficha generada puede quedar en estado `incompleta_para_combate: resistencia_sin_regla` con campos claramente indicados. Para playtesting, permitir un **perfil técnico de ensayo expresamente elegido y versionado** en preparación del encuentro; no contaminar el registro canónico del personaje ni afirmar que se generó con regla inexistente. Hasta que se apruebe la fórmula, no anunciar un creador 100 % completo con Resistencia canónica.

**Aceptación:** 10 000 seeds de creación sin violaciones de límites o ramas inválidas, igualdad byte a byte al repetir seed/decisiones/catálogos; pruebas específicas de High Aerie, Augyre, Ficino y Arquetipos que requieran decisiones. **Commit y push.**

## Etapa 3.3 — Pantalla de creación: aleatoria y manual

**Ruta:** navegación dedicada «Crear personaje» desde el inicio; no modal antes del combate ni datos incrustados en panel de comandos.

**Modo aleatorio:** botón «Generar» con semilla visible/copiable (opcional al usuario), cronología de tiradas y resultado completo por etapas; volver a generar desde cero o repetir una etapa **solo cuando hacerlo no infrinja la dependencia de tablas**. Mostrar título de localidad, origen social, Arquetipo, Atributos, Entrenamientos, talentos y poseídos; opciones manuales válidas donde el reglamento exige elección (p. ej., especializaciones).

**Modo manual:** seleccionar área, ciudad y origen social entre ramas válidas, y elegir Arquetipo **solo entre los permitidos por la tabla aplicable** (manual elige un resultado legal, no crea una opción que no podría salir); permitir lanzar Atributos o introducir valores legales según categoría de origen, con etiqueta de edición manual, pero sin cambiar restricciones; escoger especializaciones, adicionales y distribuir 20 puntos por validación activa. Mostrar fórmula y resultado de cada derived field (no usar un total «capacidad ofensiva» almacenado). Si se habilita modo de edición libre para balance, debe estar marcado separadamente `no_canónico_laboratorio` y no fingir ser creación reglamentaria.

**Validaciones visuales:** indicador de progreso, explicación concisa de restricciones y origen de cada regla, bloquear confirmación de una ficha *reglamentariamente completa* si faltan datos; permitir guardar borrador incompleto. No añadir selectores arbitrarios para reglas del 01 crítico ni para generación de Resistencia pendiente.

**Aceptación:** crear personajes legales de las rutas completas en ambos modos, derivar atributos/habilidades correctamente y respetar todos los bloqueos. Capturas y pruebas e2e. **Commit y push.**

## Etapa 3.4 — Equipo, posesiones, guardado, exportación e importación

**Trabajo:** presentar las «Posesiones preciadas» que realmente concede el Arquetipo, con sus elecciones explícitas y propiedad (p. ej. Diskos de servicio y nightsuit de la Watch). Separarlas de armas/armaduras elegidas para ensayo. Pantalla de equipamiento: armas disponibles en catálogo, armaduras y objetos; combinar manos y restricciones, dos manos cuando el arma lo requiere; inventario, mano derecha e izquierda, reserva, peso/capacidad solo si existe regla documentada. Cuando el CORE no especifica presupuesto o derecho a un objeto adicional, no fingir que es posesión inicial legal: marcar la equipación adicional como `configuracion_de_laboratorio` y preservarla aparte de la ficha original.

**Persistencia:** el usuario puede (a) guardar ficha en almacenamiento persistente del laboratorio cuando el backend/sesión lo permita, (b) mantenerla solamente durante la sesión sin guardar en servidor, y (c) descargar archivo JSON versionado para importación futura desde «Importar personaje». Ofrecer también exportación legible (por ejemplo TXT/MD o PDF en una fase posterior si se necesita), pero JSON es el formato exacto de ida y vuelta. Conservar nombre, procedencia, origen, Arquetipo, todos los valores base, entrenamiento y posesiones, equipo, decisiones, seed, historial de tiradas, versiones y estado reglamentario; validar hashes y esquemas en la importación, rechazar datos corruptos, mostrar incompatibilidades de versiones sin sobrescribir fichas.

**Integración:** la ficha importada o creada puede utilizarse como PJ en combate y Coliseo sin recargar o reinventar atributos, pero sólo si dispone de datos de combate completos, o si el jugador eligió expresamente un perfil de ensayo separado para campos todavía pendientes. «No guardar» conserva el personaje vivo en sesión y «Descargar» permite recuperarlo luego sin base de datos. Tests de exportar → importar → comparar toda la ficha → iniciar una simulación con igual seed.

**Aceptación:** tres flujos probados (guardado, solo sesión, descarga/importación), fichas de origen legal protegidas de parámetros de ensayo, equipo válido e integridad de replays. **Commit y push.**

---

# 4. Matriz de entregables y checkpoints

| Paso | Dependencia | Resultado mínimo | Checkpoint obligatorio |
|---|---|---|---|
| 1.1 Dados y RNG | Lote actual de Codex publicado | Reporte de distribución, secuencias, determinismo y tests | Commit + push `main` |
| 1.2 Motor unificado | 1.1 | Cálculo único, tests de capacidades y Resistencia | Commit + push `main` |
| 1.3 Esquemas y presets | 1.2 | Fichas normalizadas y migración segura | Commit + push `main` |
| 1.4 Combate completo | 1.3 | Matriz CORE → funciones → pruebas | Commit + push `main` |
| 1.5 Integración y balance | 1.4 | UI/automático/lotes consistentes; nueva auditoría H01–H12 | Commit + push `main` |
| 2.1 Fauna menor | 1.5 | Dos criaturas débiles en el catálogo | Commit + push `main` |
| 2.2 Equipo | 2.1 | Armas, armaduras, objetos y editor de equipo | Commit + push `main` |
| 2.3 Oleadas numerosas | 2.2 | Oleadas 10–15, escalado y reportes | Commit + push `main` |
| 2.4 UI de combate compartida | 2.3 | Coliseo con exactamente el layout/menús/modales del Laboratorio; 1–4 PJ y 15 enemigos validados | Commit + push `main` |
| 3.1 Catálogo de creación | 2.4 | Tablas versionadas con cobertura declarada | Commit + push `main` |
| 3.2 Generación | 3.1 | RNG y reglas de creación reproducibles | Commit + push `main` |
| 3.3 Pantalla | 3.2 | Manual y aleatorio legal | Commit + push `main` |
| 3.4 Equipo y persistencia | 3.3 | Guardado, sesión, JSON, importación y uso en combate | Commit + push `main` |

## 5. Bloqueadores de diseño a no resolver automáticamente

- Generación, rango y progresión de **Resistencia natural humana**, pendiente en CORE 02/03.
- Política definitiva del **01 natural ante Resistencia/defensa**; el sistema técnico temporal debe estar etiquetado, nunca fingirse definitivo.
- Tablas pendientes de lesiones y pifias, intercepciones/absorción especiales, durabilidad de modelos específicos, reparación, Diskos y visibilidad.
- **Tablas sociales/Arquetipos faltantes** para muchas localidades y las demás áreas de procedencia. El creador será ampliable, pero su cobertura inicial legal es parcial; documentarla como tal.
- Distribución final de venenos, efectos especiales, anatomía y ataques de las dos criaturas nuevas, no descritas con números por Hodgson; usar fichas **de banco**, sin presentarlas como canon.

**Cierre esperado de la revisión humana:** decidir si se aprueban las propuestas experimentales de las dos criaturas y si se desea que la creación manual acepte valores de ensayo separados del personaje reglamentario. Estas son decisiones de juego, no bloqueos para escribir y almacenar este primer plan.
