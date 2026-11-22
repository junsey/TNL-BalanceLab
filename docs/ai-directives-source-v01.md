> Fuente técnica histórica v0.1: https://drive.google.com/file/d/1wmYCwA9joWguOlUWTmp-QA-JMAVbzWcX/view
>
> PRECEDENCIA OBLIGATORIA PARA ESTA IMPLEMENTACIÓN: la decisión definitiva posterior del usuario reemplaza sección 3.7, AI-14 y sección 9. Dos directivas obligatorias incompatibles de igual prioridad se sortean con RNG reproducible y candidatos ordenados establemente, igual que preferencias empatadas. No se rechazan por conflicto ni se desempatan por ID fijo. Punto 5 (objetivos/entorno) está pospuesto; no es dependencia de IA. El usuario autorizó ejecutar las etapas y publicarlas en main sin pausas de aprobación.

# The Night Land BalanceLab — Motor común de IA enemiga y directivas declarativas

**Especificación técnica para Codex | v0.1 | 20 de noviembre de 2026**  
**Repositorio:** `junsey/TNL-BalanceLab`  
**Estado:** Plan de implementación para revisión. No ejecutar antes de autorizar la etapa correspondiente y de completar las tareas previas incompatibles del plan atómico general.  
**Fuentes:** CORE 03 (reglas de acciones, criaturas, recuperación y distancias), documento vivo «The Night Land | Diseño incremental de combate y notas para Codex» y revisión del código actual del repositorio.

## 0. Objetivo

Desarrollar una **única IA táctica común**, compartida por Laboratorio, Coliseo, simulaciones automáticas y cualquier otro consumidor del motor. Debe funcionar correctamente **sin directivas propias** y permitir **directivas declarativas opcionales en las fichas de criaturas**, que alteran su conducta sin introducir acciones ilegales ni sustituir las reglas de combate. Las directivas pueden ser obligatorias o preferencias, tener prioridad, responder al estado, coordinar aliados y desempatar preferencias de igual prioridad mediante azar reproducible.

**No crear una IA distinta para cada especie, ni duplicar un decisor en la UI del Coliseo.** Una directiva no otorga capacidades: únicamente selecciona acciones, objetivos o destinos ya legales y accesibles para esa criatura.

### Decisiones de diseño aprobadas

1. IA base funcional para toda criatura, aunque no tenga directivas.
2. Directivas **obligatorias condicionadas** y directivas de **preferencia**.
3. **Prioridades** entre directivas; elegir al azar entre **preferencias válidas de igual prioridad**.
4. Condiciones **dinámicas**: Salud, Vigor, aliados, enemigos, zonas, alcance, estados, objetivos, etc., solo si son datos efectivamente disponibles y verificables.
5. **Coordinación opcional** entre aliados mediante directivas y datos compartidos del estado; no dar telepatía ni organización universal a todas las especies.
6. Decisiones y aleatoriedad **reproducibles** mediante semilla; registrar la decisión para auditoría y replay.
7. Las reglas del CORE se imponen sobre cualquier directiva. Ni una orden «obligatoria» puede ejecutar una acción ilegal.
8. Preservar el enfoque de acciones y costes ya existente, y no agregar nuevas reglas del CORE bajo pretexto de mejorar IA.

### Aspectos que Codex NO debe inventar

- Umbrales de Salud o Vigor propios de una especie y prioridades concretas de las criaturas reales.
- Reglas de comunicación, capacidades sensoriales, Talentos o Dones que todavía no estén presentes en su ficha.
- Efectos de estados, condiciones o objetivos del escenario no definidos por la implementación vigente.
- Bonificaciones, penalizadores, daño, Resistencia o recuperación automática.
- Escala editorial definitiva de prioridades. El contrato técnico puede admitir un entero ordenable; **los valores de cada ficha deberán aprobarse**.
- Conflictos semánticos entre dos órdenes obligatorias equivalentes: cubrir por validación y un criterio técnico explícito en este plan, no con azar arbitrario que pueda violar una orden.

## 1. Auditoría del código actual y puntos de integración

Archivos revisados en la rama por defecto del repositorio:

| Archivo | Situación observada | Acción requerida |
|---|---|---|
| `packages/engine/src/automation.ts` | `chooseTacticalAction` recorre `profile.priorities` secuencialmente y toma la primera acción que cumple; usa `getLegalActions`; ya calcula conveniencia aproximada de ataques de criatura. | **Evolucionar** este decisor, conservando una sola vía de selección. |
| `packages/engine/src/profiles.ts` | `TacticalProfile` contiene `priorities`, `defenses`, `objective`, `recoverAt`, `fleeAt`, `takeOpportunity`. | Versionar/extender esquema y migrar perfiles anteriores, sin romper históricos. |
| `packages/engine/src/tactical.ts` | Genera las acciones legales, resuelve las acciones y mantiene el RNG del combate en su estado. | Reutilizar su autoridad sobre legalidad y estado. No recrear reglas en IA. |
| `packages/engine/src/rng.ts` | RNG determinista basado en semilla, con `rollDie` y estado explícito; existen flujos aislados. | Tomar todas las decisiones aleatorias con el RNG autorizado y registrar su evolución. |
| `packages/engine/src/state.ts` | Provee `canonicalJson` y `stateHash` para reproducibilidad. | Mantener los hashes/replays coherentes. |
| `packages/fixtures/src/coliseum.ts` | Las criaturas reciben `ai` con prioridades fijas, típicamente `attack`, `approach`, `recover`, `end`. | Migrar las fichas a esquemas declarativos opcionales. |
| `packages/engine/src/coliseum.ts` | Usa `runAutomaticEncounter` y genera simulaciones por semilla. | Mantener único motor para el Coliseo y las tandas estadísticas. |

**Hallazgo principal:** el problema de monotonía se explica en parte por el algoritmo de «primera prioridad válida», los perfiles casi idénticos y las opciones reales de las fichas. No prometer resolverlo mediante probabilidades cosméticas si el encuentro solo tiene una acción útil.

**Dependencia:** esta especificación debe incorporarse al plan de etapas existente sin saltar la auditoría de dados, la corrección del sistema de ataque basado en Resistencia, el bug de Acechadores y las regresiones previas. Codex debe inspeccionar primero el SHA actualizado de `main` y adaptar rutas si otro lote ya modificó archivos.

## 2. Arquitectura de referencia

```text
TacticalState + ficha del actor + entorno + RNG del encuentro
       |
       v
getLegalActions(state, actorId)   ← única autoridad sobre legalidad
       |
       v
Generador común de candidatos  ← acción, objetivo, destino y motivo
       |
       v
Motor base (siempre disponible)
       |
       +── Directivas de ficha [opcionales]
       |     • condiciones de activación
       |     • obligación / preferencia
       |     • prioridad
       |     • selector de acción / objetivo / destino
       |     • coordinación / contexto verificable
       v
Filtro legal + reglas de precedencia
       |
       +── Múltiples preferencias válidas de igual prioridad
       |     → sorteo reproducible y registrado
       v
Decision { action, explanation, rngNext, trace }
       |
       v
ÚNICO resolvedor existente: resolveAction / stepTacticalAction
```

**Invariantes:** nunca elegir una acción que no devuelva `getLegalActions`; nunca modificar el estado para examinar candidatos; nunca utilizar `Math.random`; nunca introducir efectos de juego desde el módulo de IA; no exigir directivas para funcionar.

### 2.1 Contrato conceptual de datos (no copiar literalmente sin comprobar los tipos reales)

```ts
// Pseudotipo orientativo: la implementación final debe ajustarse a los
// discriminantes y esquemas versionados existentes, con Zod estricto.
type AIDirective = {
  id: string;                // único y estable en la ficha
  mode: 'mandatory' | 'preference';
  priority: number;          // entero ordenable, sin valores editoriales inventados
  when: AICondition;         // DSL declarativo validado, no JS ejecutable
  choose: AIIntent;          // ataque, retirada, protección, defensa, etc.
};

type AIDecision = {
  action: LegalTacticalAction;
  reason: string;
  directiveId?: string;
  consideredDirectiveIds: string[];
  rngNext: Rng;
  trace: DecisionTrace;
};
```

**Compatibilidad:** el campo `fighter.ai` actual acepta perfiles tradicionales; el motor ha de admitirlos o migrarlos explícitamente. Cualquier ruptura de esquema exige versión, migración de JSON y tests para importar encuentros viejos. La ficha conserva sus acciones, alcance, Vigor, defensas y otras mecánicas **separadas** de las directivas.

### 2.2 Condiciones soportadas (primera propuesta técnica)

Un catálogo cerrado, comprobable y ampliable, con operadores seguros y referencias explícitas:

- Actor: Salud% actual, Vigor disponible, estados existentes, acción mayor/menor disponible, equipamiento o acción especial realmente poseída.
- Oponentes: visible/no visible, alcance legal, Salud% si existe conocimiento de ese dato, estado alterado, amenaza/posición.
- Aliados: Salud/condiciones conocidas, posición relativa, necesidad de retirada o protección.
- Entorno: zona, distancia narrativa, posición defendida, objetivo del encuentro **solo cuando la misión lo haya declarado**.
- Contexto: inicio o progreso del combate, posibilidad de ataque de oportunidad, objetivo vigente de una coordinación explícita.

No inventar omnisciencia: usar información observada o autorizada por el encuentro. No introducir un sistema universal de detección o cobertura que CORE no haya aprobado.

### 2.3 Intenciones disponibles (primera propuesta técnica)

Expresar **intenciones**; el motor las traduce en acciones que ya devuelva `getLegalActions`:

- `attack`: priorizar un ataque legal; selector de objetivo si corresponde.
- `approach`: acortar distancia sin suponer geometría métrica del hexágono.
- `withdraw`: aumentar distancia / perseguir huida si es legal.
- `defend`: elegir defensa entre las disponibles.
- `recover`: acción de recuperación **solo si la ficha o CORE permiten esa recuperación**.
- `holdPosition`: mantener posición; preparar acción **solo si la preparación está disponible**.
- `protectAlly`: priorizar acciones legales que protejan a un aliado; sin teleportar ni conceder acciones extra.
- `focusTarget`: conservar o adoptar objetivo compartido cuando pueda observarse y alcanzarse.
- `useAbility`: privilegiar una acción especial existente por su ID, sin crearla.
- `useEnvironment`: interactuar con objetivos del encuentro ya implementados.

No todos estos intents tienen que activarse en v1 si todavía no existen acciones legales que los realicen. En ese caso, la directiva queda declarada como **no ejecutable** y el motor retrocede; no simular acciones fantasma.

## 3. Resolución de directivas

1. Obtener **una sola vez por decisión** las acciones legales actuales; reevaluar el estado después de **cada** acción ejecutada.
2. Resolver primero reacciones urgentes (defensa, oportunidad) mediante las mismas reglas existentes: no perder ventanas de reacción por perseguir objetivos de largo plazo.
3. Evaluar condiciones de directivas; descartar las falsas y las que no produzcan ninguna acción legal.
4. Ordenar niveles de prioridad de mayor a menor y elegir el nivel con candidatas ejecutables.
5. Dentro del nivel elegido, atender las órdenes obligatorias aplicables antes que preferencias del mismo nivel. **Prioridad y obligatoriedad son dimensiones distintas**: una orden de prioridad menor no desplaza automáticamente una orden de prioridad mayor. Definir y probar precedencia exactamente como se escribe aquí.
6. Si compiten **varias preferencias** de la prioridad elegida, elegir una aleatoriamente con RNG del combate, sin favorecer por posición en el array. Ordenar previamente por ID estable para que cambios de orden en la ficha no alteren el sorteo con igual semilla.
7. Si varias directivas obligatorias de la **misma prioridad** exigen acciones incompatibles, aplicar **validación de ficha** que lo señale en el diseño, con resolución técnica estable para el runtime (ID ordenado como desempate). Esta es una **propuesta de desempate técnico**, no una nueva regla de comportamiento aprobada: revisar con el usuario antes de codificar el runtime final. No silenciar conflictos ni convertirlos a azar de preferencias.
8. Si ninguna directiva se puede ejecutar, usar IA base; si la IA base no dispone de acción útil, terminar turno legalmente explicando por qué. No realizar acciones ilegales para aparentar actividad.
9. La elección emite traza: estado/actor, directivas aplicables, candidatos legales, prioridad, tipo, empate y RNG consumido, acción/objetivo elegidos y razón.

**Punto delicado:** la prioridad debe evaluarse **antes de comparar acciones**, no simplemente recorrer `profile.priorities` como ahora. La IA base no debe elegir siempre el mismo ataque por orden de catálogo cuando hay alternativas igualmente viables.

## 4. Aleatoriedad y replay: condición no negociable

- El decisor no puede consultar `Math.random`, hora ni datos externos.
- El RNG avanza **solo cuando efectivamente ocurre un desempate aleatorio**. No consumir un dado para una única opción.
- Usar estado funcional `{ decision, rngNext }`. Las ejecuciones manuales y automáticas deben persistir el RNG actualizado **antes** de ejecutar la acción sin sobrescribir la secuencia de dados de combate.
- El código actual mantiene `state.rng` para el combate. Implementar una integración que **no reintroduzca ni sobrescriba** el RNG anterior al resolver acciones. Evaluar si usar un subflujo de IA aislado y versionado, derivado de la misma semilla de encuentro, para no alterar los dados de ataques cuando cambia el número de empates. Si se utiliza, deberá persistirse en snapshot/replay y versionarse; no crear una segunda aleatoriedad opaca.
- Tests: misma semilla y mismo estado → mismas decisiones, consumo RNG, eventos, estadísticas y hash; variación de semillas sobre dos opciones válidas → ambas alternativas son alcanzables; reorganizar directivas equivalentes → no introducir ventaja artificial de orden; serializar/reanudar → misma continuación.
- No afirmar «distribución equilibrada» por intuición: auditar al menos los sorteos de 2, 3 y 4 candidatas, el sesgo y la independencia práctica mediante pruebas estadísticas documentadas.

## 5. Motor base: comportamiento mínimo y evaluación

El motor base debe actuar sin ninguna directiva específica. Toda decisión se limita a las acciones reales del sistema:

- Defenderse apropiadamente ante un ataque, considerando Vigor y las opciones realmente disponibles.
- Elegir entre ataques legales según alcance, probabilidad de impacto basada en el CORE actual, efecto y coste. Aprovechar `previewAttack` sin duplicar fórmulas; si una mecánica aún está pendiente, no inventar su valor esperado.
- Acercarse o reposicionarse si todavía no tiene alcance útil, respetando las zonas narrativas, oportunidades de ataque y gasto de acciones.
- Considerar recuperación solo cuando la especie/actor **tenga una acción de recuperación legal**. No aplicar Respirar humano ni +1 por ronda a criaturas por defecto.
- Evitar elegir repetidamente acciones imposibles; no intentar recuperar Vigor que no puede recuperarse.
- Permitir retirada cuando la ficha y las reglas lo justifiquen; no convertir a todas las criaturas en huidizas por defecto.
- No dar coordinación ni conocimientos de objetivos no observados por defecto.

**Acechadores:** hay una incidencia separada sobre la ficha provisional que consume Vigor atacando y carece de recuperación. El motor no debe ocultarla ni «solucionarla» regalando Vigor. Una vez aprobada la ficha correspondiente, probar el ataque natural básico a 0 Vigor como decisión independiente. No confundir bug de ficha con bug de IA.

## 6. Plan atómico para Codex

**Regla operacional para TODAS las etapas:** partir de `origin/main` actualizado; modificar solo el alcance especificado; ejecutar typecheck, lint, tests unitarios y regresiones relevantes; guardar evidencia de la ejecución; commit con mensaje descriptivo; push a `origin/main`; confirmar SHA remoto. No iniciar la etapa siguiente si la actual falla. Nunca `force-push`, ni borrar resultados históricos para hacer pasar las pruebas. Si `main` cambia mientras trabaja, conciliar antes de publicar. No ejecutar estas etapas simultáneamente con otro lote Codex sobre el mismo motor.

### IA-01 — Auditoría y contrato versionado (sin cambiar comportamiento)

- Inventariar todos los consumidores de `chooseTacticalAction`, `chooseEnemyAction` y `runAutomaticEncounter`, incluyendo la UI manual y el Coliseo.
- Describir el perfil existente, fuentes de acciones, estado RNG y formato de snapshots/replay.
- Definir y validar estructuras de directivas y condiciones con esquema estricto/versionado; agregar ejemplos **técnicos ficticios de ensayo**, no perfiles canónicos.
- Escribir pruebas de compatibilidad del formato antiguo y errores claros de directivas mal construidas.
- **Aceptación:** todos los encuentros y fixtures existentes obtienen exactamente las decisiones actuales cuando carecen del nuevo formato; ninguna nueva directiva puede inyectar acciones fuera del catálogo.

### IA-02 — Decisor base único y verificable

- Refactorizar `chooseTacticalAction` sin duplicarlo: separar lectura de estado, generación de opciones legales, selección y emisión de motivos.
- Consumidores existentes deben usar la misma implementación.
- Conservar retrocompatibilidad y fijar los casos base en tests y snapshots.
- **Aceptación:** un adversario sin directivas ataca, se acerca, se defiende o espera según acciones legales; jamás elige `breathe` si es criatura sin ese permiso; no entra en bucles con acciones inutilizables.

### IA-03 — Intérprete de condiciones, prioridades y directivas

- Evaluar DSL de condiciones por estado actual y devolver cero o más candidatas legales.
- Implementar `mandatory` y `preference`, prioridad, descarte por ilegalidad y fallback a IA base.
- No ejecutar código arbitrario dentro de fichas.
- Controlar conflictos entre órdenes obligatorias mediante validación y una política documentada, sin decidir por azar salvo autorización posterior.
- **Aceptación:** las preferencias no crean acciones; mayor prioridad prevalece sobre menor; la directiva imposible cae al siguiente nivel; una criatura sin directivas conserva IA base.

### IA-04 — Desempate aleatorio reproducible y trazabilidad

- Sortear entre **preferencias válidas de igual prioridad**, no entre todas las acciones sin distinguir órdenes.
- Integrar RNG versionado en decisión + serialización + replay; registrar cada empate y selección.
- Auditar distribución, consumo RNG, reanudación de partida y hashes.
- **Aceptación:** mismas semillas → mismo resultado; distintas semillas producen variedad; ausencia de empates → ningún consumo RNG extra; las estadísticas y partidas reanudadas son reproducibles.

### IA-05 — Condiciones reactivas, coordinación y fixtures experimentales

- Añadir evaluadores para condiciones dinámicas observables y capacidades de coordinación basadas en acciones legales.
- Usar **fixtures de ensayo**, no imponer tácticas inventadas a Sabueso, Acechador, Hombre Encorvado ni a todo el bestiario.
- Probar dos aliados que se enfocan en un objetivo conocido, uno que protege a otro y un actor que cambia de plan ante un nuevo estado, sin predicción omnisciente.
- **Aceptación:** las directivas se reevalúan después de cada acción; la coordinación desaparece si no es factible; no hay acciones ilegales ni duplicación de turnos; el motor base continúa operativo.

### IA-06 — Integración completa, rendimiento y pruebas de regresión

- Conectar Laboratorio, Coliseo, simulación manual/asistida, tandas automáticas, métricas y replay a la misma IA.
- Añadir reporte compacto de decisiones (tipo de directiva, candidato, acción, razón, empate), visible al inspeccionar una simulación sin saturar la interfaz principal.
- Comparar encuentros antes/después en rondas, Salud perdida, Vigor, proporción de `end`, diversidad de acciones, repetición de patrones y resultados censurados. Registrar cambios de balance; no ajustar estadísticas para «mejorar» el resultado.
- Conservar trazas y snapshots de versiones anteriores; documentar cualquier migración.
- **Aceptación:** pruebas completas, rendimiento de lotes sin regresión significativa, cero acciones inválidas, replays idénticos con misma semilla/versiones y decisiones de IA observables.

## 7. Matriz de pruebas obligatorias

| Código | Escenario | Resultado esperado |
|---|---|---|
| AI-01 | Criatura sin directivas | Motor base decide con opciones legales y no falla. |
| AI-02 | Directiva activa, acción legal | La selecciona conforme prioridad y tipo. |
| AI-03 | Directiva activa, acción ilegal | Fallback sin violar CORE. |
| AI-04 | Dos preferencias de igual prioridad | Sorteo reproducible y traza del empate. |
| AI-05 | Preferencias de prioridad diferente | La mayor prioridad elegible prevalece. |
| AI-06 | Cambia Salud/Vigor durante combate | Cambia la elegibilidad de directivas inmediatamente. |
| AI-07 | Aliados coordinados | Concentración/protección solo con datos y acciones legales. |
| AI-08 | Criatura con 0 Vigor y ataque natural de coste 0 | Ataca si su ficha lo permite y hay blanco legal. |
| AI-09 | Criatura con 0 Vigor y solo ataque costoso | No ataca ni recupera Vigor mágicamente; registra razón. |
| AI-10 | Defensa, parada, ataque de oportunidad, reacción | Las ventanas actuales siguen siendo legales; IA no las ignora. |
| AI-11 | Mismo seed, replay e importación | Mismas decisiones, hash final y eventos. |
| AI-12 | Estado serializado en un desempate | Resume con el RNG correcto, sin repetir sorteo. |
| AI-13 | Directivas reordenadas, IDs estables | Ninguna prioridad artificial por orden textual. |
| AI-14 | Dos directivas obligatorias incompatibles | Error de validación o resolución documentada, nunca silenciosa. |
| AI-15 | Coliseo/Laboratorio/batch | El mismo escenario y perfil usa idéntico motor de IA. |
| AI-16 | Cien o miles de encuentros de ensayo | No aparecen ciclos vacíos ni explosiones de tiempo; medir variedad sin imponer porcentajes de resultado. |

## 8. Criterios de aceptación global

- **Un solo motor**, **un solo catálogo de acciones legales**, **una sola semántica de directivas**.
- Extensible: incorporar criatura = agregar datos de ficha/directivas, no escribir otro decisor.
- Cada etapa termina con commit, push a `main` y SHA verificable.
- Sin modificación no autorizada a CORE, probabilidades, Vigor, Resistencia o reglas de daños.
- Todas las decisiones susceptibles de azar son reproducibles, inspeccionables y capaces de reanudarse.
- Respetar historia del proyecto y plan atómico general, especialmente auditoría del RNG y la interfaz compartida de Coliseo.

## 9. Punto técnico pendiente para cerrar antes de ejecutar IA-03

El usuario aprobó sorteo aleatorio **entre preferencias empatadas**, pero **no** definió expresamente cómo resolver dos órdenes obligatorias incompatibles de **igual prioridad**. Propuesta: las fichas deben evitar ese caso mediante validación; para partidas importadas que lo contengan, fallback determinista trazable por ID estable y aviso de inconsistencia. **Requiere aprobación antes de consolidar la implementación.**

En cualquier caso, no equivale a que una orden obligatoria se ejecute si no existe acción legal.

---

**Relación con el documento de diseño:** este archivo desarrolla exclusivamente el **punto 4/6: motor de IA enemiga**. No implementa los puntos 5 (objetivos y entorno) o 6 (maniobras universales), ni activa Talentos/Dones que todavía no estén programados. 

