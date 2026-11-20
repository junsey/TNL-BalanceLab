# Etapa 1.4: auditoría de la cadena de combate

Base de main: `64debb7c81a7231e095ba929e4d3efb5ab6ee82a`. Archivos inspeccionados: tactical, attack, combat-math, effects, schemas, skills, coliseum, fixtures y pruebas de reglas. Fuentes: CORE 01, CORE 02 y CORE 03 consultados en las etapas anteriores y conservados como referencia del plan.

## Correcciones verificadas

- Los ataques alternativos de criaturas y armas en reserva se resuelven por la selección real de equipo/acción. Antes se validaban como si toda alternativa fuera una daga y podían cancelarse con `ACTION_INTERRUPTED`.
- Arrojar funciona a Cerca/Lejos (0/1), excluye Muy Lejos y utiliza Destreza + Dominio Arrojadizas de la ficha. Ya no requiere un mapa paralelo de Resistencia ni datos de la antigua ruta para ejecutarse.
- Preparar usa la acción reactiva actual, consume Mayor y termina el turno; no ofrece preparar Respirar/Tomar Aliento ni el antiguo disparador de salir de Cerca. Se paga Vigor al activar, solo una vez; con Vigor insuficiente no se ejecuta.
- Patear impide tanto la oportunidad por alcance como la de retirada durante el turno pertinente. No hace daño ni tira dados.
- Los ataques de oportunidad a Vigor 0 quedan prohibidos también para una criatura cuyo ataque básico sea gratuito. El ataque básico de esa criatura continúa siendo legal en su turno.
- Las habilidades Entrenadas de arma requieren Dominio positivo para atacar/Parar. Un arma no entrenada puede seguir en el inventario sin impedir empezar el encuentro; el ataque correspondiente queda indisponible.
- Primeros Auxilios usa la habilidad derivada desde la ficha humana, sin exigir una copia numérica auxiliar. Las criaturas no heredan las maniobras humanas.
- Escudos con bonificación definida pueden bloquear sin una absorción definida. No se activan las antiguas tablas de Bloqueo superado ni se inventa absorción adicional.
- Los costes de las maniobras actuales se validan contra los valores del ensayo CORE 03. Coliseo habilita preparación, maniobras humanas y estabilización mediante el mismo motor.

La nueva semántica queda identificada por `combatVersion: core03-combat-v1` y estados `0.8.0-core03-combat`. Los estados anteriores siguen admitiendo consulta/replay; no se continúa una simulación nueva con su versión anterior. No se cambió el RNG.

## Matriz de evidencia

Las 21 regresiones de `packages/engine/tests/core-combat.test.ts` verifican también el hash de restauración y replay después de **cada** acción.

| Regla / caso | Funciones | Evidencia |
| --- | --- | --- |
| Iniciativa mínima, Alerta estricta y tres grupos | rollInitiative, anticipates, advance | engine.test T09/T18; intercalación actual entre dos PJ |
| 09 + 4 = 13 contra 60, grado cuarto | previewAttack, declareAttack, compareResistanceAttack | Evento natural/modificado/umbral; Salud intacta antes de defensa |
| 76 + 5 = 81 contra 60, fallo | declareAttack | Sin daño ni defensa pendiente |
| Esquivar usa prueba separada, paga 2 | describeDefense, resolveImpact | Dos palabras RNG adicionales y cero daño; habilidad viva 55 pese a copia antigua 0 |
| Escudo reutiliza dado, paga 1 | coreResistance, resolveImpact | RNG sin cambio, daño ausente, Vigor 6→5 |
| Parar intercepta, luego reducción directa | resolveImpact, applyDamage, wear | Intercepción 6 y reducción 2 una sola vez; desgaste de prueba por daño |
| Mayor + Menor, Respirar con Vigor 0 | getLegalActions, stepTacticalAction | Respirar habilita ataque ligero y consume Menor |
| Tomar Aliento / interrupción | advance, recoverVigor | Termina turno, impide reacciones; impacto con daño efectivo 0 reduce recuperación |
| Criatura, ataque alternativo y coste propio | equippedAttacks, finishTrigger, executeAttack | Modelo secundario, capacidad 55 y coste 2 correctos |
| Criatura agotada con ataque gratuito | canAttack, opportunityCandidates | Ataca a coste 0 en turno; no obtiene oportunidad ni recuperación humana |
| Alcance/retirada comparten límite | previewOpportunityActors, opportunityCandidates | Una aceptación gasta el coste normal; la retirada posterior no repite oportunidad |
| Patear | stepTacticalAction | Sin consumo RNG/Salud, suprime oportunidad por alcance |
| Escabullirse | finishTrigger, combatSkill | Éxito evita oportunidad; fracaso permite reacción pero completa movimiento |
| Arrojar, arma en suelo | getLegalActions, declareAttack | Distancias 0/1/2, Dominio propio y zona de caída; recogida cubierta por regresión táctica |
| Barrido | sweepTargets, resolveImpact | Un natural 09 para ambos blancos, grados cuarto/mitad separados, división antes de reducción |
| Preparación única y caducidad | preparedCandidates, advance | Un disparo; caduca al turno siguiente; sin ataque gratuito a Vigor 0 |
| Manos, daga y cambio de equipo | handLoadout, legalDefenses, equipHands | Daga guardada ataca sin equiparse; Parar requiere sostenerla; confirmar gasta solo Menor |
| Explorar/cancelar menús | getLegalActions | Consultar opciones conserva hash y RNG; sin acción no se paga coste |
| Inyecciones | stepTacticalAction inject | Médico 2d6+4 consume stock y no devuelve acciones; no revive muertos |
| Estabilización | combatSkill, stabilize | Detiene Agonía sin curar ni devolver acciones |
| Agonía y muerte provisional | advance, dead | 1d4 por ronda hasta −ceil(Salud máxima/4) |
| Tabla crítica ausente | applyConsequence, reportUnresolved | UNRESOLVED_RULE explícito; no se inventa lesión ni se clasifica como éxito de simulación |

## Estados y límites

Los números de armas/armaduras y los umbrales de Agonía/muerte continúan **BANCO_DE_PRUEBAS**. Las capacidades estructurales y tablas de desgaste utilizadas en tests son modelos de prueba explícitos, no nuevas cifras del catálogo. Las defensas heredadas de Acechador conservan los valores de ensayo existentes; no se inventan Atributos o Entrenamientos para convertir esos valores provisionales en datos canónicos.

Siguen pendientes en el CORE: interacción definitiva del 01, lesiones/pifias, valores estructurales de Parar, absorción adicional y tablas de deterioro no definidas. Si se habilita un módulo sin su contenido, se registra `UNRESOLVED_RULE`; no se fabrica una tabla. La auditoría de presentación, métricas y comparación de versiones se cierra en 1.5.

Prueba local de navegador: inicio directo y capa «Preparar acción» con Ataque, sin preparar recuperaciones. Se observó un rótulo visual antiguo al no existir el mapa paralelo de Resistencia; su corrección corresponde a la revisión de presentación de 1.5.

Verificación final: `npm test` 97/97; `npm run typecheck`, `npm run lint`, `npm run build` y `npm run test:web` correctos. Un arranque web previo agotó su espera con el servidor de desarrollo concurrente; tanto la repetición sin ese servidor como la serie final completa pasaron.
