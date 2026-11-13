# PLAN.md | The Night Land Combat Simulator v0

**Estado:** alcance funcional cerrado y aprobado (40 decisiones).  
**Fecha:** 11 de noviembre de 2026.  
**Destino:** Codex, implementación por fases de una aplicación web privada, colaborativa y orientada a simulación de balance.  
**Idioma:** español.

> **Directiva para Codex:** Implementar las 40 decisiones en fases verificables, con motor determinista, puro y desacoplado de la interfaz. No inventar reglas pendientes del juego. Identificar módulos experimentales, valores provisionales, fuentes y límites. No considerar terminada una fase sin pruebas de aceptación.

## 0. Fuentes, alcance y criterios de interpretación

**Objetivo:** simular combates individuales y cadenas de supervivencia de un personaje configurable contra grupos de criaturas del mundo de *The Night Land*, en modo manual, automático o masivo, para analizar el balance de armas, defensas, Vigor, Energía, armaduras, lesiones, IA y condiciones del encuentro.

Fuentes CORE de The Night Land RPG:

1. [01 - Resolución de acciones](https://docs.google.com/document/d/1VStCBzbHJWPHsW_VRNJdnbKklWAmD8bzZrSTDDeskHY/edit): tiradas, umbrales, ventajas y pifias.
2. [02 - Creación de personajes](https://docs.google.com/document/d/15D3CWXjoYmwbRMJFsUhT0F7Le5_idJLIfMG-GFGoSdo/edit): atributos, Entrenamientos, Dominios y derivados. La v0 NO implementa creación completa.
3. [03 - Combate](https://docs.google.com/document/d/1sXRXLuB6rFQ8XTGH0BesdaFhgWm0mcIBm4Rtb8Y_ZsI/edit): **fuente operativa principal del motor**, con reglas y banco de pruebas detallados.
4. [04 - Vulnerabilidad y armaduras](https://docs.google.com/document/d/16ix5U6S3a8j1KlezqWSZY-o3fuS9CnyLWBgXAtRlqiY/edit): principios resumidos; CORE 03 desarrolla procedimientos posteriores.
5. [05 - Salud y consecuencias](https://docs.google.com/document/d/1qbFScgrel13i95FEDC7V3SV6URLmPWLBrE35DEdJ5mw/edit): separación conceptual de Salud y lesiones; CORE 03 contiene secuencia provisional más detallada.
6. [06 - Progresión](https://docs.google.com/document/d/1q3YK3hURoJ3SZoIwnBBDUfWTD8pEoJeRsSUzKVPxMZ8/edit): entrenamiento y memoria. Sin progresión en v0.

Carpeta de referencia: https://drive.google.com/drive/folders/1MVGh02nSG9K8B3sYbbiBT_miznwqnMNe

**Política de autoridad:** diferenciar (A) reglas confirmadas del CORE, (B) valores de ensayo, (C) módulos experimentales editables y (D) reglas pendientes. Priorizar la redacción vigente y específica de CORE 03 frente a resúmenes anteriores de CORE 04/05, documentando contradicciones en `docs/unresolved-rules.md`. El documento presente define el producto, no sustituye los textos completos del CORE.

**Excluido:** creación aleatoria por ciudad/arquetipo, progresión, curación gratuita, inventario cambiante o reparaciones entre encuentros, editor geométrico de mapas, luz física dinámica compleja, editor visual condicional de IA, búsqueda automática de combinaciones de parámetros, cuentas individuales o roles, ejecución persistente de batches con navegador cerrado, creación automática de reglas de disparos, cobertura, sorpresa, percepción pasiva o tablas no definidas.

## 1. Registro íntegro de las 40 decisiones de alcance

| ID | Decisión confirmada | Comportamiento requerido |
|---|---|---|
| D01 | Recuperar todo el Vigor entre encuentros; persistir Salud, lesiones, desgaste. | Cadena hasta muerte, sin niveles. |
| D02 | Grupos aleatorios configurables, especies, pesos y semillas. | Generación reproducible. |
| D03 | IA con perfiles por criatura. | Conducta separada del motor. |
| D04 | Plantillas de mapas y variaciones aleatorias. | Semillas y posicionamiento reproducibles. |
| D05 | Modos manual, automático individual y masivo. | Un único motor de reglas. |
| D06 | IA del personaje con parámetros ajustables. | Autoplay comparable. |
| D07 | Laboratorio completo de criaturas, armas, armaduras y escudos; JSON. | Validación y edición. |
| D08 | Vercel, DB compartida, contraseña común, sin cuentas. | Web privada. |
| D09 | Catálogos comunes; simulaciones independientes; historial conjunto, diffs y restauración. | Versiones y snapshots. |
| D10 | UI táctica retro 8-bit con mapa, sprites, indicadores, iniciativa y log. | Interfaz visual. |
| D11 | Defensa manual por defecto y automática opcional, intercambiable. | Pausa tras impacto y antes del daño. |
| D12 | Panel de acciones y menú contextual sobre hexágonos y combatientes. | Solo acciones legales. |
| D13 | Módulos experimentales configurables, tablas editables y activación individual. | No inventar reglas. |
| D14 | Estadísticas avanzadas, distribuciones, percentiles, comparativas y CSV. | Logs completos solo para runs individuales/seleccionadas. |
| D15 | Un personaje predefinido editable, atributos, Entrenamientos y Dominios. | Derivados automáticos, sin creación completa. |
| D16 | Equipamiento fijo toda la partida, sin cambios ni reparaciones. | Desgaste persistente. |
| D17 | Energía especial: capacidad, consumo y recarga configurables, incluso infinita. | Reserva independiente de Vigor. |
| D18 | Muerte por defecto; final por incapacitación opcional. | Clasificaciones distintas. |
| D19 | Huida exitosa permite seguir, sin contar victoria. | Supervivencia táctica. |
| D20 | Guardar/reanudar y replay paso a paso de eventos, tiradas y decisiones. | Eventos históricos inmutables. |
| D21 | Editor de prioridades tácticas, perfiles guardables, objetivos, recursos, defensas y huida. | IA explicable. |
| D22 | Encuentros ponderados con restricciones por especie/combinación. | Validar factibilidad. |
| D23 | Distancias iniciales Cerca, Lejos, Muy Lejos o aleatorias. | Distribución en zonas. |
| D24 | Agresor configurable: PJ, enemigos o aleatorio ponderado. | Iniciativa CORE. |
| D25 | Velocidades 1×, 2×, 4×, instantánea; pausa y avance paso a paso. | UI no altera resultados. |
| D26 | Aplicación automática de efectos, duración y persistencia de lesiones/estados. | Motor de condiciones configurable. |
| D27 | Iluminación experimental, activable y desactivable. | Alcance visual sin penalidades inventadas. |
| D28 | Biblioteca de 3 a 5 mapas con frecuencias y variaciones; sin editor geométrico. | Plantillas compartidas. |
| D29 | Control manual o IA de cualquier combatiente, intercambiable, auditado. | Intervención manual en combates individuales. |
| D30 | Escenarios guardables y compartidos, ejecutables en tres modos. | Fixtures controlados. |
| D31 | Batches por lotes con progreso, cancelación y resultados parciales. | Checkpoints y límites configurables. |
| D32 | Máximos independientes por rondas y encuentros, protección contra loops. | Censura, no resultados ficticios. |
| D33 | Validación previa y durante combate, diagnósticos reproducibles. | Invariantes y seed. |
| D34 | Historial compartido y estudios con etiquetas, referencia y comparativas. | Investigación organizada. |
| D35 | ZIP completo exportable/importable sin sobrescribir registros. | Portabilidad versionada. |
| D36 | Variantes experimentales por estudio sin modificar catálogos. | Overrides locales. |
| D37 | Objetivos, alertas, tamaño muestral e incertidumbre por estudio. | Alertas no normativas. |
| D38 | Contraseña compartida + alias por sesión, sin permisos diferenciados. | Atribución informativa. |
| D39 | Configuración general compartida, editable, versionada, con overrides. | General > escenario > estudio/variante > snapshot. |
| D40 | v0 integral con todas las funciones y aceptación verificable; reglas pendientes pueden ser experimentales. | No cerrar con solo un prototipo. |

## 2. Contrato de reglas del motor

**Todo número bajo «ensayo» o «provisional» debe conservar su etiqueta y versión en la configuración.** Codex debe leer CORE 03 antes de cerrar cada procedimiento.

### 2.1 Tiradas y derivados

- d100, éxito cuando `tirada <= objetivo`. `01` siempre éxito crítico y `100` siempre pifia, aun si objetivo es 100.
- Umbrales normal: valor entero; mitad: `floor(valor/2)`; cuarto: `floor(floor(valor/2)/2)`.
- Ventaja o desventaja: dos dados de decenas y **uno de unidades**, seleccionar resultado menor/mayor; no acumulan y mutuamente se anulan.
- Atributos 5 a 50: Fuerza, Destreza, Percepción, Voluntad, Conocimiento y Presencia. Entrenamientos 0 a 50; habilidad general `Atributo + Entrenamiento` (máximo 100). Habilidades Entrenadas necesitan Entrenamiento salvo excepción expresa.
- Dominios de Armas 0 a 50, independientes, **sin suma de Atributo**.
- Salud máxima **provisional** `25 + floor(Fuerza/2)`.
- Vigor máximo `4 + floor((Fuerza+Voluntad)/20)`, rango 4–9, sin tope de 8.
- Vulnerabilidad humana sin armadura `50 - floor(Destreza/2)`; con armadura `max(0, base - Protección)`.
- Ataque `min(100, DominioArma + VulnerabilidadObjetivo)`.
- Esquivar = Destreza + Entrenamiento en Esquivar; Parar = Destreza + Dominio del arma apta; Aguante = Fuerza + Entrenamiento en Aguante.

### 2.2 Ataque, daño, defensas y desgaste

1. Tirar ataque, confirmar impacto. Un fallo no permite defensa ni desgaste automático de arma.
2. El éxito normal da daño base; éxito a mitad agrega dados **propios de cada arma**; éxito a cuarto agrega más dados propios. Nunca aplicar multiplicadores o una regla universal de dados adicionales.
3. `01` natural: daño de cuarto **más** resultado de tabla de herida crítica por tipo contundente/cortante/perforante, si está definida. Lesiones no nacen de umbrales universales de daño ni de Salud.
4. **Después de impacto confirmado pero antes de tirar/revelar daño**, el defensor puede declarar **una** defensa activa por ataque y paga Vigor al declarar. Puede defender múltiples golpes de una ronda si dispone de Vigor.
5. Esquivar cuesta 2 Vigor; éxito evita todo daño y deterioro de armadura por el golpe. Su traducción exacta de desplazamiento a zonas está pendiente.
6. Parar con arma ligera/media cuesta 1 Vigor, pesada 2; requiere prueba `Destreza+Dominio` y arma apta. Si tiene éxito, intercepta hasta capacidad estructural **propia del modelo**. Excedente llega al cuerpo y activa tabla experimental de Parada superada, si existe.
7. Bloquear con escudo es automático al pagar Vigor: ligero 1, pesado 2; absorción/capacidad según ficha, excedente puede activar tabla de Bloqueo superado. No usar capacidad universal inventada.
8. Orden: daño base + adicionales; interceptación por Parada/Bloqueo; reducción **directa** de armadura avanzada; daño efectivo `max(0,residual-reducción)`; restar Salud; consultar deterioro según tabla de equipo.
9. **Protección reduce Vulnerabilidad, no daño.** Solo equipos especiales pueden ofrecer reducción directa. Armaduras se deterioran por su tabla cuando hay daño efectivo a Salud; escudos y armas pueden deteriorarse por impacto interceptado incluso sin daño a Salud.
10. Durabilidad 0 inutiliza arma o armadura según CORE, sin destruirla irreversiblemente. Desgaste no tiene valor fijo universal. Las reparaciones están descritas en CORE 03 pero no se ofrecen entre encuentros en v0.

### 2.3 Acciones, Vigor y zonas

- Una Acción Mayor y una Menor por ronda; se pueden intercalar dentro del grupo de iniciativa.
- Ataque normal: ligera 1 Vigor, media 2, pesada 3, usa Acción Mayor. Mover una zona adyacente usa Menor; Correr hasta dos zonas usa Mayor.
- **Respirar:** Menor, +1 Vigor inmediato, sin superar máximo.
- **Tomar Aliento:** Mayor, termina turno de inmediato, impide reacciones hasta el siguiente turno. Al comenzar el siguiente: `2 + dado(Aguante)` hasta máximo. Aguante 0–24 `1d2`; 25–49 `1d4`; 50–74 `1d6`; 75–100 `1d8`. Si recibió un impacto confirmado durante descanso, dividir recuperación total por 2 redondeando abajo, aunque no pierda Salud.
- Fatiga con 0 Vigor impide costes impagables pero permite Respirar y después un ataque ligero si quedan acciones. Una acción preparada reserva su acción, expira al turno siguiente y gasta Vigor solo al ejecutarse, si su disparador es observable.
- Hexágonos son **zonas narrativas**, no casillas individuales ni escala métrica. Múltiples combatientes pueden compartir zona. Cerca = misma; Lejos = adyacentes; Muy Lejos = dos o más zonas.
- Alcance corto/medio/largo compara armas dentro de **Cerca**, no distancia entre hexágonos.
- Salir de una zona compartida provoca posible ataque de oportunidad antes del desplazamiento. Un arma con alcance relativo superior puede hacer oportunidad antes de recibir ataque de arma más corta en Cerca. Coste ofensivo normal; máximo **una oportunidad por cada adversario y ronda** para cada combatiente, compartido entre disparadores. Un impacto no interrumpe automáticamente el ataque o movimiento que originó la oportunidad.
- Huida: estando Muy Lejos de todos los rivales, usar Acción Mayor y cerrar el encuentro sin victoria, continuando supervivencia.

### 2.4 Iniciativa, Salud y visibilidad

- Agresores tiran 1d100 cada uno, se conserva el menor como umbral. Cada defensor tira Alerta; anticipa si la supera **y** resultado estrictamente menor al umbral. Orden fijo: defensores anticipados, agresores, defensores restantes; integrantes del mismo grupo pueden ordenar/intercalar acciones. Para automatizar elecciones dentro del grupo, usar política técnica documentada, reproducible y no atribuida al canon.
- Salud >0 permite actuar, salvo condiciones. Salud <=0: Incapacitado, sin acciones ni reacciones, en Agonía; 1d4 de pérdida al final de cada ronda sin estabilizar; muerte en `-ceil(SaludMaxima/4)`. Primeros Auxilios por otro actor es posible según CORE 03; no inventar asistencia para el PJ solitario.
- Por defecto seguir hasta muerte, opción de cortar al quedar incapacitado. Límite alcanzado = inconcluso/censurado, no muerte/victoria.
- Visibilidad **provisional**: luz suficiente hasta Muy Lejos; poca luz hasta Lejos; penumbra solo Cerca; oscuridad total sin visión útil. La interacción con sentidos de CORE 01 sigue pendiente. No crear penalizadores porcentuales arbitrarios.

### 2.5 Fixtures iniciales, explícitamente experimentales

Cargar estos valores de CORE 03 como catálogo de ensayo editable, **no como canon definitivo**:

| Arma | Categoría | Daño normal | Extra mitad | Extra cuarto | Tipo | Alcance |
|---|---|---|---|---|---|---|
| Daga | Ligera | 1d3 | +2d4 | +4d4 | Perforante | Corto |
| Espada corta | Ligera | 1d6+1 | +1d4 | +2d4 | Cortante | Corto |
| Espada ancha | Media | 1d8+1 | +1d6 | +2d6 | Cortante | Medio |
| Hacha de combate | Media | 1d8+2 | +1d6 | +2d6 | Cortante | Medio |
| Espadón | Pesada | 2d8 | +1d8 | +2d8 | Cortante | Medio |
| Lanza larga | Pesada | 1d10+1 | +1d6 | +2d6 | Perforante | Largo |
| Diskos apagado | Pesada | 2d8 | +1d8 | +2d8 | Cortante | Medio/largo por mango extensible |
| Diskos encendido | Pesada | 4d8+4 | +1d8 | +2d8 | Cortante | Medio/largo por mango extensible |

Diskos encendido: 3 Vigor por ataque, Energía 1 por ataque como ensayo. Reserva, activación y recarga son parámetros experimentales pendientes, editables. Puede funcionar apagado cuando no hay Energía. El rasgo de mango extensible controla alcance relativo, pero no autoriza inventar coste de activación; explicitar el módulo usado.

| Armadura experimental | Protección | Durabilidad inicial | Reducción directa |
|---|---:|---:|---:|
| Ligera | 3 | 8 | 0 |
| Media | 6 | 12 | 0 |
| Avanzada pesada | 9 | 16 | 2 |

Las cifras definitivas de absorción, capacidad estructural de armas y escudos, tablas de desgaste, especiales y reparación **no existen todavía** para todos los modelos. No completar fichas con valores ficticios encubiertos. Etiquetas de prueba como Ágil, Barrido e Impacto concentrado no conceden ventajas nuevas mientras no haya procedimiento confirmado.

### 2.6 Vacíos de reglas: tratamiento técnico obligatorio

Registrar explícitamente como pendientes: tabla general de pifias 100, tablas de críticos por tipo, tablas aleatorias de Parada/Bloqueo superados, capacidades estructurales y desgaste por modelo, alcance zonal preciso del desplazamiento de Esquivar, funciones especiales y activación del Diskos, curación/recuperación de Salud, percepción sensorial y oscuridad, armas a distancia, cobertura, sorpresa y efectos especiales todavía no desarrollados.

**Protocolo:** cuando una simulación requiere un resultado de regla pendiente, validar antes de empezar si es previsible, o generar un evento `UNRESOLVED_RULE` en ejecución y clasificar el run como incompleto/no válido para el modelo completo. Se admite ejecutar un **modelo experimental reducido** si los módulos ausentes fueron desactivados expresamente antes de iniciar y su ausencia figura claramente en el reporte. Nunca inventar una tirada, daño, penalizador o consecuencia por defecto.

## 3. Arquitectura técnica propuesta

> Los productos y librerías de esta sección son **propuestas de implementación**, no nuevas decisiones del juego. Cambiarlas está permitido si Codex deja un ADR y mantiene los contratos y pruebas aprobadas.

### 3.1 Componentes

- **Web:** Next.js + TypeScript, compatible con despliegue en Vercel; diseño de escritorio prioritario, adaptable a otros tamaños. UI retro 8-bit con estética pixel-art y buena legibilidad.
- **Motor:** paquete TypeScript puro, funcional o con mutación controlada, sin React, navegador, DB, red, reloj, timers ni `Math.random`. Mismo paquete para pruebas, UI y simulación masiva.
- **IA:** capa independiente que solicita acciones legales al motor y selecciona entre ellas según prioridades y datos observables, generando una explicación reproducible.
- **Simulación masiva:** Web Worker del navegador como punto de partida; procesa chunks sin renderizar y envía checkpoints a API. No necesita una cola de ejecución persistente en la nube, que fue expresamente excluida. Al cerrar la pestaña, el trabajo no continúa automáticamente.
- **Backend:** API autenticada para guardar catálogos, revisiones, escenarios, partidas, estudios, estadísticas, paquetes y checkpoints. Validación rigurosa también del lado del servidor.
- **Base de datos:** PostgreSQL gestionada, preferentemente Neon o alternativa compatible con Vercel. Esquema versionado mediante migraciones.
- **Formatos:** JSON validado para configuraciones y snapshots, eventos ordenados para replay, CSV para datos, ZIP con manifiesto para portabilidad.
- **Tests y CI:** unitarios, de propiedades/invariantes, integración, golden tests, tests estadísticos, e2e y build automatizado.

### 3.2 Estructura sugerida de repositorio

```text
/PLAN.md
/README.md
/.env.example
/package.json
/apps/web/
  app/
  components/
  workers/
  styles/
/packages/engine/
  src/dice/
  src/core/
  src/combat/
  src/effects/
  src/ai/
  src/simulation/
  src/events/
  src/diagnostics/
  tests/
/packages/schemas/src/
/packages/analytics/src/
/packages/fixtures/src/
/db/migrations/
/db/seeds/
/docs/decisions/
/docs/rules-traceability.md
/docs/unresolved-rules.md
/docs/architecture.md
/docs/api.md
/docs/testing.md
```

Evitar dependencias del motor hacia UI/API/DB. Los cálculos deben poder ejecutarse en pruebas de Node sin servicios externos.

### 3.3 Contrato de determinismo

Una ejecución se define completamente por:

```yaml
engineVersion: string
rngAlgorithmVersion: string
seed: string
rulesSchemaVersion: string
rulesSnapshot: object
rulesHash: string
catalogSnapshot: object
catalogHash: string
scenarioSnapshot: object
scenarioHash: string
aiSnapshot: object
aiHash: string
executionOptions: object
```

**Requisitos:**

1. Usar PRNG explícito y versionado, con semilla estable; no usar `Math.random` en el motor. Documentar generación de d100, dados genéricos, desempates e índices.
2. Derivar la semilla de cada repetición a partir de la semilla maestra y su índice mediante función estable. Cambiar el tamaño de chunk no puede cambiar ni los resultados por repetición ni el agregado.
3. Recorridos con orden canónico cuando el orden pueda afectar al consumo de números aleatorios. Para acciones que admiten múltiples órdenes dentro de una fase de iniciativa, definir selección técnica parametrizable y documentada; no atribuirla a CORE.
4. Snapshot **inmutable** al iniciar la ejecución. Un cambio global no afecta combates existentes ni en curso.
5. Guardar eventos para replay visual sin volver a tirar dados. Conservar versión del motor; puede cambiar la ejecución histórica de código entre versiones, pero el replay de eventos almacenados debe permanecer estable.
6. Una misma `engineVersion + rngAlgorithmVersion + snapshot + seed` debe producir idénticos eventos y hash final. Testear serial y Worker.
7. Toda intervención humana se registra como acción externa con actor y momento, de forma que no se la confunda con selección automática por seed.

### 3.4 Jerarquía de configuraciones

```text
Configuración general compartida (versionada)
  -> Overrides del escenario
     -> Overrides del estudio y variante
        -> Configuración efectiva inmutable de cada ejecución
```

Implementar merge **semántico por campo**, validación después de resolver overrides y visualización de diferencias con origen de cada valor. No mezclar silenciosamente dos versiones incompatibles de reglas. Una restauración siempre crea una revisión nueva; no reescribe el pasado.

### 3.5 Modelo de datos conceptual

Entidades con UUID, timestamps, revisión y versión de esquema:

- `SharedSettings` y `SharedSettingsRevision`.
- `CatalogEntity` (`creature`, `weapon`, `armor`, `shield`, `condition`, `ruleModule`, `consequenceTable`, `aiProfile`, `mapTemplate`) y `CatalogRevision` inmutable con puntero a revisión activa.
- `CharacterPreset` y revisiones para personaje experimental, con base de atributos/Entrenamientos/Dominios y derived recalculables.
- `Scenario` y `ScenarioRevision`: contenido fijo o reglas de generador, mapa, iluminación, distancias, agresor, restricciones y límites.
- `Study`: nombre, descripción, etiquetas, objetivos métricos y referencia; `StudyVariant`: snapshot base y overrides locales.
- `SimulationRun`: modo, engineVersion, seed, configuración total, hashes, estado y clasificación terminal; referencia opcional a estudio/escenario/variante.
- `CombatEvent`: `sequence`, ronda, fase, actor, acción, decisiones IA, tiradas, valores intermedios, delta de estado y razón; permitir bloques ordenados de eventos.
- `BatchJob`: total solicitado, completados válidos, fallidos, censurados, cancelados, en proceso, checkpoint y timestamps.
- `BatchCheckpoint`: índice estable, rango de partidas, agregados y hash; idempotente.
- `AggregateStats`: conteos, sumas, sumas de cuadrados o datos suficientes para métricas, histogramas/percentiles según estrategia de memoria.
- `ImportExportRecord` para manifiestos y procedencia de paquetes (si resulta útil).

Los resultados masivos guardan **agregados**, no todos los eventos de cada pelea, excepto las corridas expresamente seleccionadas para diagnóstico o muestreo. Indicar cuándo no existe un replay individual porque no se guardó su log.

### 3.6 Seguridad y colaboración

- Única contraseña comprobada **en servidor**, mediante hash seguro. Nunca en código cliente o JSON público. Secretos en variables de entorno, jamás en Git.
- Sesiones firmadas y expiran; cookie `HttpOnly`, `Secure`, `SameSite` apropiado; logout; proteger lectura y escritura en la API, no solo las pantallas. Protección de CSRF según patrón de sesión implementado.
- Alias elegido en cada sesión, asociado a cambios, estudios y runs. Es información declarada, **no identidad verificada**.
- Sin permisos diferenciados; todas las sesiones autenticadas comparten catálogos y estudios pero ejecutan sus simulaciones con estados independientes.
- Edición concurrente mediante revisión esperada y transacción/compare-and-swap. Si otro cambió el objeto, responder conflicto y ofrecer diff, nunca sobrescribir.
- Registrar auditoría con alias, fecha, cambios y versión. Restaurar mediante revisión nueva.
- Validar importación ZIP: tamaño, cantidad de entradas, rutas seguras, hashes, esquema, recursos y duplicados. No ejecutar código arbitrario proveniente de configuraciones o ZIP.

### 3.7 Ejecución por lotes

- Chunks configurables con cotas técnicas de memoria y duración. Worker sin render gráfico. Esquema de progreso `requested`, `completed`, `valid`, `excluded`, `censored`, `failed`.
- Guardar checkpoints periódicos en servidor. Cada chunk tiene ID/índice y operación idempotente: retransmitir no duplica resultados.
- Cancelación cooperativa en bordes de chunk, preservando solo partidas completadas y confirmadas. Visualizar resultados **parciales** con su denominador real.
- Si se cierra el navegador, no prometer que siga corriendo. Marcar interrupción y permitir reanudar solo si se implementa recuperación determinista segura; si no, ofrecer reiniciar con snapshot/seed.
- Límites independientes de rondas y encuentros; protección técnica ante ciclos e inactividad que no cuentan como muerte/victoria.
- El máximo operativo se ajustará a rendimiento observado, no fijar por intuición una capacidad garantizada de 10.000 campañas.

## 4. Módulos y comportamiento de aplicación

### 4.1 Máquina de estados común

Modelar ubicación narrativa, participantes, salud, vigor, energía, durabilidad, condiciones, estado de descanso, rondas, fases de iniciativa, acciones pendientes/usadas, acciones preparadas y oportunidades consumidas. Exponer `getLegalActions(state, actor)` y `resolveAction(state, action, rng)` con validación estricta. UI e IA solamente solicitan **acciones legales**; ninguna modifica estado de forma paralela.

Separar **decisión de defensa después de impacto** de **generación de daño**. Admitir pausa exacta, guardado y reanudación desde esa ventana sin repetir tiradas. Registrar antes/después de cada evento significativo.

### 4.2 Efectos y módulos experimentales

Definir esquema declarativo de efectos: origen, objetivo, tipo permitido, magnitud, disparador, comienzo, duración (turnos, rondas, encuentros o persistente), condición de terminación, política de acumulación. Validar efectos no soportados como regla no resuelta. Cada módulo tiene ID, versión, parámetros, tablas y `enabled`. Habilitar/inhabilitar individualmente; capturar estado exacto en cada snapshot. No aceptar JavaScript ejecutable dentro de tablas o importaciones.

### 4.3 Equipamiento fijo, Energía e IA

Antes del primer encuentro elegir arma, armadura, escudo. Mantenerlos hasta terminal de la cadena; persistir desgaste y pérdida de funcionalidad. Entre encuentros restaurar **Vigor completo** solamente como regla fija. Energía especial se recupera conforme a parámetros experimentales de recarga por ronda/entre encuentros; permitir modo infinito explícito. No reparar ni cambiar equipamiento entre encuentros.

Perfiles de IA editables para jugador y enemigos, con prioridades de objetivos, ataque, movimiento, defensa, descanso, huida y recursos; umbrales de Salud/Vigor y política de desempate. Emitir evento explicativo de elección entre acciones legales. Respetar información visible al combatiente; no permitir «ver» daños no tirados ni criaturas ocultas.

### 4.4 Encuentros, mapas y modos

Generar grupos por pesos, min/máx, máximos por especie, inclusiones y combinaciones permitidas/prohibidas. Comprobar factibilidad antes de ejecutar. Elegir plantilla de entre 3 y 5, con peso y variantes por seed. Distribuir según distancia inicial Cerca/Lejos/Muy Lejos/aleatoria; **si el mapa no admite una distancia, fallar validación**, no reubicar sin aviso. Configurar agresor PJ/enemigos/aleatorio ponderado. No autoajustar dificultad después de una victoria.

Modos: (A) manual con toma de control individual y defensas manual/auto; (B) automático individual con visualización; (C) masivo sin render. Escenarios individuales y cadenas de supervivencia; huida continúa a otro encuentro sin sumar victoria. Estados terminales por muerte/incapacitación configurables y límites censurados.

### 4.5 Interfaz táctica y replay

Mapa central de hexágonos, sprites pixelados, barra de Salud, Vigor, Energía y Durabilidad, condiciones, economía Mayor/Menor, iniciativa y log de eventos. Panel y menú contextual con acciones válidas y razón de bloqueo. Velocidades 1×, 2×, 4×, instantánea; pausa y paso a paso. Una variable visual nunca altera el RNG ni el orden real de eventos. Replay histórico **solo lectura**, a partir de eventos almacenados y sin volver a tirar.

### 4.6 Estudios, variantes y estadísticas

Biblioteca de escenarios compartidos/versionados. Estudios con nombre, descripción, etiquetas, objetivos, referencia y variantes locales. Las variantes modifican copias de la configuración, no el catálogo. Comparar diffs y advertir de parámetros simultáneamente modificados.

Métricas: victorias, huidas, incapacitaciones, muertes, censura, duración por rondas, supervivencia en encuentros, daño infligido/recibido/evitado, ataques por grado, defensas, oportunidades, desgaste, recursos, lesiones, frecuencia de acciones y causas de muerte. Distribuciones, medias, medianas, percentiles y CSV. Mostrar denominadores reales e intervalos de confianza documentados para proporciones (por ejemplo, Wilson al 95%). No presentar alertas como juicios universales: objetivos y rangos son **definidos por estudio**. Comparaciones con diferentes reglas habilitadas o datos censurados requieren advertencia visible.

### 4.7 Exportación

Exportar ejecución o estudio como ZIP con `manifest.json`, versionado, hashes, reglas y catálogos efectivos, seed, escenario, IA, parámetros, estadísticas, CSV y eventos **que existan**. Importar con validación de integridad y crear IDs nuevos preservando procedencia; no sobrescribir historial. Los logs individuales que no se guardaron durante un batch no pueden «reconstruirse» a partir de los agregados.

## 5. Fases de implementación en Codex

**Orden de dependencias:** F0 -> F1 -> F2 -> F3 -> F4 -> F5; F6 puede avanzar en paralelo cuando los contratos F1/F3 estén estables; F7/F8 dependen de motor y persistencia; F9 -> F10 -> F11. Cada fase debe terminar con tests, documentación y evidencia. Las fases son incrementales, pero la **v0 no se considera terminada** hasta superar F11 y cubrir D01–D40.

### F0. Fundamentos, inventario documental y contratos

**Depende de:** ninguna.  
**Resultado:** estructura del repositorio, trazabilidad de CORE y contratos.

- [ ] **F0.01** Crear estructura de monorepo TypeScript, `package.json`, lint, format, typecheck, tests, build, `.env.example` y README.
- [ ] **F0.02** Crear `docs/rules-traceability.md`: `ruleId`, referencia exacta a CORE, estado `confirmed/experimental/pending`, módulo y tests.
- [ ] **F0.03** Crear `docs/unresolved-rules.md`, enumerando tablas críticas/pifias, capacidades, desgaste, desplazamiento de Esquivar, Diskos, percepción, curación, etc.; indicar bloqueos.
- [ ] **F0.04** Definir esquemas versionados de personaje, criaturas, armas, armaduras, escudos, condiciones, módulos, IA, escenario, acción, evento, snapshot, run y batch.
- [ ] **F0.05** Documentar decisiones técnicas propuestas separadas de reglas confirmadas; preparar fixtures experimentales desde CORE 03.
- [ ] **F0.06** Activar CI sin base de datos remota obligatoria: lint, typecheck, unit tests y build.

**Aceptación:** repo clonado compila y prueba con instrucciones verificadas; las 40 decisiones tienen módulo dueño; toda regla implementable tiene fuente y estado identificado.

### F1. Matemática, RNG y estado base

**Depende de:** F0.  
**Resultado:** librería pura, determinista y comprobada.

- [ ] **F1.01** PRNG seedable versionado; derivación estable por índice de partida para batches de cualquier chunk size. Documentar codificación de semillas y consumo RNG.
- [ ] **F1.02** Parser seguro de dados (`NdM+K`) sin `eval`, rangos válidos y errores reproducibles.
- [ ] **F1.03** d100, `01/100`, umbrales completo/mitad/cuarto, ventaja/desventaja de dos decenas y una unidad.
- [ ] **F1.04** Atributos, Entrenamientos, Dominios, derivados, reglas de límites y validación de datos.
- [ ] **F1.05** Modelo de `WorldState` y `Event`, serialización canónica, hash y API de mutaciones validadas.
- [ ] **F1.06** Golden tests e invariantes sobre 0, 1, 25, 50, 99, 100, truncamientos y topes. Test de determinismo repetido sin red ni reloj.

**Aceptación:** tests de bordes verdes; el mismo snapshot, motor y seed siempre producen igual secuencia de dados y hashes.

### F2. Combate táctico completo del CORE disponible

**Depende de:** F1.  
**Resultado:** un encuentro de varios combatientes resoluble sin interfaz gráfica.

- [ ] **F2.01** Iniciativa: mínimo agresor, tiradas Alerta defensoras, fases de anticipados/agresores/restantes.
- [ ] **F2.02** Acción Mayor/Menor, preparación, costes Vigor 1/2/3, Fatiga, Respirar, Tomar Aliento, interrupción parcial y recuperación por Aguante.
- [ ] **F2.03** Zonas hexagonales con ocupación múltiple, adyacencia, distancias Cerca/Lejos/Muy Lejos, movimiento y Correr.
- [ ] **F2.04** Ataque Dominio + Vulnerabilidad, éxito por grado, daño específico de arma, 01, 100 y rutas a tablas de consecuencias.
- [ ] **F2.05** Ventana interactuable de defensa después de impacto y antes de daño. Esquivar, Parar, Bloquear, costes, tiradas y capacidad estructural.
- [ ] **F2.06** Secuencia de daño, reducción directa y desgaste por tabla de equipo. No reducir daño por Protección normal.
- [ ] **F2.07** Oportunidades por salida de zona y alcance relativo, contador único por rival y ronda.
- [ ] **F2.08** Salud, incapacidad, Agonía, umbral muerte; clasificaciones y huida desde Muy Lejos.
- [ ] **F2.09** Pruebas para varios combatientes, reacciones consecutivas, falta de Vigor, ataques simultáneamente desencadenados y acciones ilegales.
- [ ] **F2.10** Evidencia de replay determinista de un fixture sin frontend y de eventos pendientes no resueltos sin reglas inventadas.

**Aceptación:** las mismas acciones declaradas y seed producen el mismo resultado; defensa no conoce daño; todos los costes, prioridades, fases y consecuencias validadas del CORE tienen test.

### F3. Extensiones experimentales, lesiones, equipos y visibilidad

**Depende de:** F2.  
**Resultado:** módulos configurables que no modifican el CORE sin permiso.

- [ ] **F3.01** Esquema de `RuleModule` con activación, revisión, parámetros, tablas, compatibilidad, validación y snapshot.
- [ ] **F3.02** Motor declarativo de estados, lesiones, disparadores, duración, persistencia y apilamiento explicitado.
- [ ] **F3.03** Tablas configurables de críticos, pifias, Parada/Bloqueo superados y deterioro; impedir ejecución completa si el caso requiere resultados inexistentes.
- [ ] **F3.04** Energía por equipo especial: capacidad, consumo, recarga por ronda y entre encuentros, infinito; estados Diskos apagado/encendido, sin inventar costes faltantes.
- [ ] **F3.05** Iluminación activable/desactivable con restricciones experimentales de visión/detección ligadas a zonas, nunca penalizadores supuestos.
- [ ] **F3.06** Tests de módulos on/off, tablas mal formadas, Durabilidad 0, efectos persistentes y conflictos entre efectos.

**Aceptación:** un módulo desactivado no interviene; uno activado usa solo sus reglas declaradas; si requiere contenido ausente el motor emite diagnóstico, no un desenlace falso.

### F4. IA, composición de encuentros y mapas

**Depende de:** F2 y F3.  
**Resultado:** combate automatizable y escenarios reproducibles.

- [ ] **F4.01** `getLegalActions` único para IA y manual; AI elige y explica sin manipular estado.
- [ ] **F4.02** Editor de prioridades como modelo de datos: objetivos, Vigor, Salud, movimiento, defensa, recuperación, Energía y retirada.
- [ ] **F4.03** Defensa IA/manual por combatiente, decisión explicada, sin metainformación de tiradas futuras.
- [ ] **F4.04** Generador ponderado con min/máx total, máximo por especie, obligatorias y combinaciones permitidas/prohibidas; factibilidad previa.
- [ ] **F4.05** 3 a 5 plantillas de mapas conectadas, pesos de selección, variaciones iniciales bajo seed y distancias compatibles.
- [ ] **F4.06** Configurar PJ/enemigos como agresor o selección aleatoria ponderada.
- [ ] **F4.07** Tests: seed fija, perfiles igual decisión, configs imposibles rechazadas, 0 Vigor, arma inutilizada, blancos invisibles, decisiones de huida y bloqueo de movimiento.

**Aceptación:** sin acciones ilegales de IA; resultados reproducibles; cuando un mapa no permite la distancia solicitada, validar y explicar el error sin corrección silenciosa.

### F5. Supervivencia y ejecución masiva

**Depende de:** F4.  
**Resultado:** tres modos lógicos, batches, progreso y agregados.

- [ ] **F5.01** Resolver un encuentro automáticamente sin UI hasta terminal, límite o error mecánico.
- [ ] **F5.02** Orquestar cadenas: Vigor restaurado, Salud/lesiones/equipo persistentes, Energía según módulo; equipamiento fijo.
- [ ] **F5.03** Finalización configurable muerte/incapacidad, huida no victoriosa y continuación.
- [ ] **F5.04** Límites configurables e independientes de rondas y encuentros, detección técnica de estancamiento y censura sin derrotas ficticias.
- [ ] **F5.05** Worker de batches, chunks, semillas derivadas por índice, progreso y recolección de métricas sin dibujar.
- [ ] **F5.06** Protocolo de cancelación y checkpoints idempotentes para persistencia; mantener parciales con denominadores.
- [ ] **F5.07** Captura optativa de eventos detallados de corridas elegidas; no guardar logs completos para miles de peleas por defecto.
- [ ] **F5.08** Tests serial vs chunks 1/10/100: mismos hashes de corridas y agregados, cancelación sin doble conteo.

**Aceptación:** cambiar chunk size, velocidad visual o pestaña de visualización no cambia resultados; resultados cancelados, censurados y fallidos etiquetados correctamente.

### F6. Base compartida, seguridad, sesiones y versiones

**Depende de:** contratos de F0/F1 y modelos estables de F3/F5.  
**Resultado:** infraestructura colaborativa segura.

- [ ] **F6.01** PostgreSQL gestionado, migraciones y entornos local/preview/producción.
- [ ] **F6.02** Login con contraseña compartida hash seguro y cookie de sesión, expiración, logout, control servidor en todas las rutas privadas y CSRF.
- [ ] **F6.03** Alias por sesión y auditoría asociada a edición, importación y ejecución.
- [ ] **F6.04** Repositorios de catálogo/revisiones inmutables, diff estructural y rollback como nueva revisión.
- [ ] **F6.05** Control de concurrencia: rechazo de escritura basada en versión desactualizada; conflicto con diferencias visibles.
- [ ] **F6.06** Persistencia de escenarios, estudios, variantes, snapshots, eventos, partidas, batches, checkpoints y estadísticas.
- [ ] **F6.07** Idempotencia, paginación, validación de JSON, cuotas por payload y protección de secretos/logs.
- [ ] **F6.08** Tests e2e de dos navegadores, accesos no autenticados, dos editores concurrentes y rechazo de checkpoint duplicado.

**Aceptación:** dos colaboradores comparten datos pero sus partidas son independientes; ninguna escritura sobrescribe silenciosamente la de otro; API inaccesible sin autenticación correcta.

### F7. Laboratorio, editores y configuraciones

**Depende de:** F3, F4 y F6.  
**Resultado:** UI de gestión de elementos compartidos, revisiones y reglas.

- [ ] **F7.01** Editores completos de criaturas, armas, armaduras y escudos, con campos obligatorios, capacidades y tablas por modelo.
- [ ] **F7.02** Editor de módulos experimentales, efectos y tablas, activación individual, indicación de faltantes y validación contextual.
- [ ] **F7.03** Editor de IA: prioridades tácticas, objetivos, umbrales, orden de defensas y recuperación.
- [ ] **F7.04** Ficha del personaje predefinido: atributos, Entrenamientos, Dominios, equipamiento inicial y valores derivados; reset a fixture experimental.
- [ ] **F7.05** Configuración general versionada, overrides por escenario y estudio, herencia visible, cambios auditados.
- [ ] **F7.06** Importar/exportar JSON individual con versión de formato, validación y prevención de sobrescritura.
- [ ] **F7.07** Diffs legibles y restauración de versiones como nuevo cambio.
- [ ] **F7.08** Tests de edición, versiones, revisión vieja, compatibilidad de esquemas y valores experimentales explícitos.

**Aceptación:** se pueden editar todos los catálogos acordados; las revisiones históricas se preservan; un elemento incompleto no se confunde con configuración lista para ejecutar.

### F8. UI 8-bit, controles tácticos y replay

**Depende de:** F2–F4 y F6.  
**Resultado:** combate individual plenamente operable, reproducible y visualizable.

- [ ] **F8.01** Hexágonos narrativos centrales, sprites pixelados, combatientes compartiendo zona y visualización de distancias.
- [ ] **F8.02** Paneles Salud/Vigor/Energía/Durabilidad/lesiones, economía Mayor/Menor, fase de iniciativa y log.
- [ ] **F8.03** Panel de acciones + menú contextual, con acciones ilegales desactivadas y razones de bloqueo.
- [ ] **F8.04** Control manual de PJ y enemigos por actor, intercambio durante el combate, defensas manuales/automáticas y eventos de intervención.
- [ ] **F8.05** Selector 1×/2×/4×/instantáneo, pausa y avance de una acción por vez, manteniendo el motor aislado del reloj visual.
- [ ] **F8.06** Guardar/reanudar partida, incluso mientras se espera una defensa activa antes de daño.
- [ ] **F8.07** Replay paso a paso, solo lectura, con resultados de dados, justificación IA y deltas de estado.
- [ ] **F8.08** Accesibilidad y legibilidad: navegación por teclado en decisiones, contraste, indicadores textuales complementarios a colores, UI adaptable.
- [ ] **F8.09** Tests e2e de ataque, defensa, movimiento, retirada, pausa, reanudación y reproducción sin nuevas tiradas.

**Aceptación:** ninguna animación influye en RNG; replay no altera el registro; una defensa no permite inspeccionar el daño antes de decidir.

### F9. Escenarios, estudios, variantes y analítica avanzada

**Depende de:** F5–F8.  
**Resultado:** entorno de investigación utilizable por colaboradores.

- [ ] **F9.01** Crear, editar, guardar y versionar escenarios personalizados con criaturas, equipos, mapa, posiciones, luz y agresor; ejecutarlos en tres modos.
- [ ] **F9.02** Historial compartido filtrable: fecha, alias, escenario, run, estado, regla, arma, criatura, modo y versión.
- [ ] **F9.03** Estudios con nombre, descripción, etiquetas, referencia y vínculo a resultados existentes o nuevos.
- [ ] **F9.04** Variantes experimentales locales al estudio, overrides específicos, diferencias visibles y ejecución sin editar catálogos.
- [ ] **F9.05** Agregaciones de resultados con denominadores correctos, daños, defensas, recursos, lesiones, duración, supervivencia y desgaste.
- [ ] **F9.06** Distribuciones, medias, medianas, percentiles, intervalos de confianza de proporciones con método indicado y tamaño de muestra.
- [ ] **F9.07** Comparación con advertencia cuando cambian varias condiciones, se mezclan módulos distintos o hay datos censurados/incompletos.
- [ ] **F9.08** Objetivos y rangos de indicadores por estudio; alertas no normativas sobre desviaciones, no «veredictos de balance».
- [ ] **F9.09** Exportación CSV con metadatos de muestra, estado y versión.
- [ ] **F9.10** Tests de estadística contra datasets artificiales de valores conocidos, incluida incertidumbre y exclusión de fallos.

**Aceptación:** cada tasa muestra denominador; las cifras distinguen runs válidas, reducidas, censuradas, fallidas y parciales; variantes no modifican datos compartidos.

### F10. ZIP exportable/importable y conservación

**Depende de:** F6 y F9.  
**Resultado:** archivos reproducibles y portables sin sobrescritura.

- [ ] **F10.01** Especificar formato del ZIP y `manifest.json`: versión, hashes, formato, dependencias, snapshots, semillas y listado de archivos.
- [ ] **F10.02** Exportación de estudio o run incluyendo configuraciones, versiones de reglas/catálogos, resultados, CSV y **solo** registros individuales realmente almacenados.
- [ ] **F10.03** Importación con verificación de tamaño, integridad, esquema y rutas seguras; evitar ZIP bombs y path traversal.
- [ ] **F10.04** Crear nuevas identidades locales preservando IDs de origen/procedencia; evitar sobrescribir entidades existentes.
- [ ] **F10.05** Tests roundtrip: exportar/importar conserva datos semánticos y relaciones, mantiene hashes pertinentes y no ejecuta código incluido.

**Aceptación:** paquete exportado se puede importar sin afectar otros estudios; conservar reproducibilidad y trazabilidad; reconocer honestamente ausencia de logs no guardados.

### F11. Integración, despliegue y liberación v0

**Depende de:** F0–F10.  
**Resultado:** v0 desplegada con aceptación integral verificable.

- [ ] **F11.01** Configurar Vercel, PostgreSQL gestionado y secretos de producción; registrar procedimiento de despliegue/reversión.
- [ ] **F11.02** Ejecutar tests unitarios, de integración, golden tests de RNG y combate, escenarios automáticos y regresión.
- [ ] **F11.03** Probar simultaneidad real de dos colaboradores con alias distintos: cambios, conflictos de edición y partidas independientes.
- [ ] **F11.04** Ejecutar flujo completo: escenario → combate → defensa/huida → persistencia → derrota/límite → métricas → estudio/variante → ZIP → importación.
- [ ] **F11.05** Probar batches de 10, 100, 1.000 y 10.000 repeticiones en etapas, según capacidad real; documentar memoria, tiempos y límites, sin prometer cifras no medidas.
- [ ] **F11.06** Auditar secretos, sesiones, rutas privadas, CSRF, validadores, tablas JSON y seguridad de importación.
- [ ] **F11.07** Entregar README operativo, manual de uso mínimo, modelo de datos, API, limitaciones de CORE y procedimientos de diagnóstico.
- [ ] **F11.08** Completar matriz D01–D40 enlazando evidencia y tests; bloquear declaración «v0 lista» si alguna decisión aprobada carece de implementación comprobada.

**Aceptación:** todos los requisitos D01–D40 implementados y verificables, sin defectos críticos conocidos en las reglas ni estadísticas. Módulos de reglas todavía pendientes explícitamente identificados y no presentados como canon.

## 6. Matriz mínima de pruebas de aceptación del motor y producto

| Prueba | Caso | Resultado esperado |
|---|---|---|
| T01 | Objetivo 100, tirada 100 | Pifia, no éxito ordinario. |
| T02 | Tirada 01 | Éxito extremo y camino a crítico contextual. |
| T03 | Habilidad objetivo 63 | Umbrales normal 63, mitad 31, cuarto 15. |
| T04 | Ventaja y desventaja simultáneas | Se anulan, tirada normal; no se acumulan. |
| T05 | Destreza 50, Dominio 20, Vulnerabilidad objetivo 30 | Ataque 50, Parar 70: no sumar Destreza al ataque. |
| T06 | Protección 9, reducción directa 2 | Protección afecta probabilidad; solo reducción directa altera daño residual. |
| T07 | Fuerza 50, Voluntad 50 | Vigor máximo 9, sin tope a 8. |
| T08 | Vigor 0, arma ligera | Respirar Menor +1 y atacar Mayor por 1 es legal. |
| T09 | Tomar Aliento, recibe impacto confirmado de 0 daño | Recuperación total se divide por dos, redondeando abajo; sin reacciones durante espera. |
| T10 | Ataque fallado | No hay defensa ni gasto de Vigor defensivo. |
| T11 | Ataque acertado con defensa manual | Pausa antes de tirar/revelar daño. |
| T12 | Tres golpes, suficiente Vigor | Múltiples defensas en ronda, máximo una por golpe. |
| T13 | Parada exitosa con capacidad 6 y daño 10 | Se interceptan 6 y pasan 4 antes de reducción directa; tabla superada si se configuró. |
| T14 | Bloqueo absorbe todo y armadura no recibe daño efectivo | Puede desgastarse escudo según tabla; armadura no se degrada por esa regla. |
| T15 | Lanza larga y daga en misma zona | Oportunidad por alcance relativo, sin inventar rango adicional de hexágonos. |
| T16 | El mismo rival provoca dos oportunidades en una ronda | Solo una para cada combatiente contra ese rival. |
| T17 | Dos adversarios y PJ dentro de un hexágono | Ocupación compartida válida, distancias Cerca. |
| T18 | Defensor supera Alerta pero empata el umbral agresor | No anticipa. |
| T19 | Salud máxima 37, Salud 0 | Incapacitación, Agonía 1d4 y muerte en -10 si no estabiliza. |
| T20 | Natural 01 cortante sin tabla de lesiones completa | Daño de cuarto y diagnóstico explícito; no herida fabricada. |
| T21 | Huida desde Muy Lejos de todos | Acción Mayor, no victoria, cadena continúa. |
| T22 | Dos encuentros consecutivos | Vigor restaurado; Salud, lesiones y desgaste persistentes. |
| T23 | Energía finita e infinita del Diskos | Gasto/recarga coherente con módulo, separado de Vigor. |
| T24 | IA con mismo perfil y seed | Acción y explicación reproducibles y legales. |
| T25 | Dos especies obligatorias con total máximo 1 | Configuración rechazada antes de correr. |
| T26 | Distancia Muy Lejos en mapa sin separación posible | Error visible, no cambio silencioso de posiciones. |
| T27 | Iluminación on/off | Desactivada no altera resultados; activada aplica exclusivamente reglas declaradas. |
| T28 | Replay de combate individual | Idéntica secuencia y hash final, sin nuevas tiradas. |
| T29 | Velocidad 1× vs instantánea | Mismo estado final y lista de eventos. |
| T30 | Batch de 1.000 con chunks 10 y 100 | Mismo resultado por índice y mismos agregados. |
| T31 | Cancelación a mitad de batch | Solo runs confirmadas, estado parcial identificado. |
| T32 | Límite de rondas sin desenlace | Inconcluso/censurado, no victoria ni muerte. |
| T33 | Dos editores sobre misma revisión | Conflicto a segundo guardado, historial intacto. |
| T34 | Restaurar versión antigua | Nueva revisión sin eliminar versiones posteriores. |
| T35 | Variante local cambia daño en estudio | Catálogo compartido permanece idéntico. |
| T36 | ZIP exportado e importado | Equivalencia semántica y hashes verificables, IDs nuevos sin sobrescritura. |
| T37 | Petición a API sin sesión | Acceso denegado tanto para lectura como escritura. |
| T38 | Ataque imposible, Vigor negativo o regla faltante | Diagnóstico reproducible, ejecución no contabilizada como válida. |
| T39 | Guardar durante ventana de defensa | Restaurar decisión pendiente, seed y posición RNG sin repetir tiradas. |
| T40 | Auditoría final D01–D40 | Cada decisión cubierta por código, test y demostración. |

## 7. Estados de resultado, diagnóstico y calidad estadística

### 7.1 Estados que NO deben confundirse

- `completed_valid`: terminó conforme a todos los módulos explícitamente activos y sin fallos.
- `completed_reduced_model`: resultado válido **solo para el modelo experimental reducido declarado**, no para el CORE completo.
- `won_encounter`: enemigo o grupo fuera de combate según reglas vigentes.
- `escaped_encounter`: huida del combate que permite continuar, sin victoria.
- `incapacitated`: Salud no positiva, condición que puede ser terminal según configuración.
- `dead`: muerte verificable por umbral o regla explícita.
- `censored_round_limit`: combate sin desenlace por rondas máximas.
- `censored_encounter_limit`: cadena detenida al máximo de encuentros.
- `canceled`: interrupción del batch, con datos parciales confirmados separados.
- `failed_validation`: configuración inválida antes de iniciar.
- `failed_engine`: violación de invariante, datos irresolubles o error técnico durante ejecución.

Un encuentro y su cadena pueden poseer resultados distintos. Mantener campos separados y razones legibles. No convertir todos los estados en una única métrica «victoria/derrota».

### 7.2 Integridad, versiones y comparabilidad

- Resultados afectados por violaciones de reglas no integran los agregados de runs válidas.
- Un lote cancelado muestra tanto resultados confirmados como número solicitado, sin ocultar truncamiento de muestra.
- No comparar sin advertencia dos estudios con luz on/off, lesiones activas/desactivadas, energía ilimitada/finita o cambios simultáneos de múltiples elementos.
- Mostrar denominador, tamaño muestral y método de incertidumbre; muestras reducidas deben señalar incertidumbre alta.
- Los snapshots y eventos históricos no son editables; las notas editoriales son objetos anexos.
- Diferenciar «cero eventos» de «no se guardaron los eventos».
- Configuración experimental incompleta: fallar cuando el caso precise un resultado inexistente, o ejecutar un modelo reducido expresamente marcado desde antes del inicio.

## 8. Política de trabajo para Codex

1. Leer este `PLAN.md` y el CORE indicado antes de implementar cualquier subsistema mecánico.
2. Seleccionar la fase activa y confirmar que sus dependencias están completas.
3. Implementar tareas identificadas por ID; en cada una añadir tests y documentación del comportamiento, especialmente cuando se base en números experimentales.
4. Ante reglas faltantes, registrar un bloqueo en `docs/unresolved-rules.md`, implementar la ruta explícita de fallo/modelo reducido y **no sustituir la regla por intuición**.
5. Hacer typecheck, lint y tests antes de cerrar una fase; registrar resultados y evidencia real.
6. Mantener compatibilidad de snapshots, esquemas y replays históricos; si cambia contrato, versionarlo y proporcionar migración.
7. Registrar nuevas decisiones de ingeniería mediante ADR (`docs/decisions/ADR-###.md`). Las decisiones de diseño aprobadas D01–D40 no pueden alterarse sin aprobación expresa.
8. Cerrar cada fase con un resumen de tareas terminadas, tests, bloqueos, contratos modificados y siguiente fase habilitada.

**Plantilla de cierre de fase:**

```markdown
### Fase F# completada
- Tareas realizadas: ...
- Código y contratos cambiados: ...
- Tests ejecutados y resultado: ...
- Evidencia reproducible: ...
- Dependencias, riesgos y vacíos del CORE: ...
- Siguiente fase desbloqueada: ...
```

## 9. Criterio definitivo para declarar «v0 terminada»

La versión v0 está completa exclusivamente cuando:

1. **Las 40 decisiones aprobadas están implementadas** y cada una tiene prueba verificable o demostración funcional concreta.
2. Manual, automático y masivo comparten motor y son deterministas bajo semilla/snapshot/versión idénticos, salvo decisiones humanas explícitas registradas.
3. Los procedimientos confirmados del CORE tienen tests de bordes, integración y regresión.
4. Los experimentos pueden guardarse, reanudarse, reproducirse, versionarse, agruparse, compararse, exportarse e importarse sin alterar la historia.
5. La colaboración web en Vercel y DB compartida funciona con sesiones seguras, alias y protección de concurrencia.
6. Las simulaciones erróneas, inconclusas, censuradas, canceladas o de modelo reducido están identificadas, sin contaminar métricas de resultados completos.
7. Las mecánicas todavía pendientes siguen claramente identificadas, configurables o desactivables, sin ser presentadas como reglas definitivas.
8. El proyecto incluye instrucciones de instalación, configuración, despliegue, uso y diagnóstico, y los tests críticos están verdes.

**No es requisito** haber equilibrado de forma definitiva armas, criaturas, lesiones o Diskos. El propósito de la herramienta es precisamente investigar esos parámetros. **Sí es requisito** que ningún valor supuesto se confunda con una regla aprobada ni se generen estadísticas engañosas.

## 10. Inicio inmediato de implementación

- [ ] Colocar este archivo en la raíz del repositorio como `/PLAN.md`.
- [ ] Dar acceso de lectura a Codex a los seis documentos del CORE, en especial 01, 02 y 03.
- [ ] Abrir y completar F0.01–F0.06 como primer bloque de tareas.
- [ ] Cargar fixtures de armas y armaduras experimentales del CORE 03 **con campos pendientes explícitos**.
- [ ] Fijar PRNG, formato de eventos y versionado antes del primer combate.
- [ ] Implementar y probar un encuentro mínimo en el motor **antes** de desarrollar el tablero visual o los informes masivos.

**Fin de PLAN.md, The Night Land Combat Simulator v0.**
