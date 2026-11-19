# THE NIGHT LAND RPG — Modo Coliseo
## Especificación funcional para Cursor · v0.2 autosuficiente · 18/11/2026

### Objetivo
Agregar al simulador de combate existente un modo **Coliseo** para probar encuentros y supervivencia con **1 a 4 personajes humanos** frente a grupos de criaturas o adversarios humanos. Debe tener una secuencia inicial de oleadas definidas y, después, generación de oleadas **infinita y progresiva**. Es una herramienta mecánica de balance, no una mazmorra narrativa.

**Fuentes de verdad:** CORE 01 (resolución), CORE 02 (humanos), CORE 03 (combate), «The Night Land RPG - Materiales de simulación» (fichas de prueba) y la especificación vigente del simulador. **Este archivo incluye una copia operativa de los valores y reglas necesarios en sus anexos; Cursor debe inspeccionar el repositorio antes de cambiar interfaces o sobrescribir sistemas existentes.** NO duplicar el motor de combate ni inventar reglas generales en este modo. Los valores de las fichas y los coeficientes del generador son provisionales, versionables y configurables.

### 1. Economía de Vigor, obligatoria
- **Humanos:** conservar costes de armas, reacciones, Respirar, Tomar Aliento y consumibles del CORE vigente.
- **Criaturas:** cada acción define su propio coste; ataques naturales básicos pueden costar **0 Vigor**. Los poderes/ataques extraordinarios consumen Vigor según ficha. No hay maná u otra reserva universal.
- **Recuperación:** solamente si la ficha contiene una acción de recuperación y se cumplen sus condiciones. **No** implementar regeneración universal por turno, descanso genérico ni Respirar/Tomar Aliento humano para criaturas. Algunas no recuperan Vigor; otras pueden carecer de él por naturaleza.
- Si no puede pagar una acción, queda **no disponible**, pero conserva sus acciones gratuitas legales. El motor debe evitar que una criatura agotada quede inactiva cuando aún puede usar una acción natural de coste 0.
- Las reglas de duración, activación y limitaciones de cada poder se leen de la ficha; no se derivan del nombre del poder.

### 2. Catálogo de combatientes
Usar identificadores estables y las fichas completas incluidas en el ANEXO B de este mismo archivo para los siete perfiles:
1. `night_hound`: Sabueso de la Noche — ataque básico gratis y esfuerzo especial.
2. `humped_man`: Hombre Encorvado — armas improvisadas, consumo de Vigor, Parar.
3. `four_armed_yellow_man`: Hombre Amarillo de Cuatro Brazos — Sujetar/Estrangular, control de objetivo.
4. `fourteen_legged_beast`: Bestia de Catorce Patas — gran Resistencia y articulaciones vulnerables.
5. `yellow_thing`: Cosa Amarilla — emboscada, espinas venenosas y vulnerabilidad posicional.
6. `pale_raider`: Asaltante pálido saqueador — humano ligero, Esquivar.
7. `pale_spearman`: Asaltante pálido lancero — humano armado y con armadura media, alcance.

Las criaturas generan Atributos y reservas usando **valor fijo + dados** por instancia. Los dos humanos usan sus valores de prueba y las reglas de humanos, incluido Conocimiento, Dominios y recuperación humana. Resistencia sustituye completamente cualquier fórmula antigua de Vulnerabilidad.

**Reglas incompletas:** la condición Sujeta, venenos, combate sobre cuerpos gigantes, tablas de heridas, intercepción estructural y críticos definitivos aún requieren cierre. Implementar solo lo que el motor soporte legalmente. Si falta un subsistema, registrar advertencia visible de `mecánica provisional/no resuelta`, permitir desactivar el perfil o aplicar un modo de ensayo explícitamente versionado; nunca sustituirlo silenciosamente por otro efecto ni simular una precisión inexistente.

### 3. Flujo de Coliseo
1. Seleccionar 1, 2, 3 o 4 personajes; elegir presets de humanos o importar personajes existentes del simulador.
2. Seleccionar `Encuentro independiente` (reinicio de recursos antes de cada oleada, para medir dificultad) o `Supervivencia` (persisten Salud, Vigor, lesiones, Durabilidad, equipo y consumibles conforme al motor). No introducir curación ni reaprovisionamiento gratuitos. La recuperación entre oleadas solo ocurre si está habilitada y definida por una regla explícita/versionada.
3. Configurar semilla RNG reproducible, nivel inicial, autoejecución o ejecución manual, límite técnico opcional de oleadas para pruebas masivas.
4. Generar el pack, instanciar combatientes, ejecutar con el motor existente, registrar métricas, y al ganar avanzar a la siguiente oleada. Al perder, cerrar la carrera y presentar resultados.
5. Tras las oleadas iniciales, entrar en generación procedural indefinida. Una carrera termina únicamente por derrota o decisión del usuario; el contador de oleadas no tiene tope de diseño.

### 4. Progresión base: seis temas de prueba
Las primeras seis oleadas **introducen mecánicas** en secuencia: (1) humanos básicos, (2) sabuesos y presión de múltiples objetivos, (3) Hombres Encorvados y armas improvisadas, (4) cuatro brazos y control, (5) Cosa Amarilla con veneno/emboscada, (6) Bestia de Catorce Patas con alta Resistencia y puntos débiles. Son temas, **no packs fijos supuestamente equilibrados**.

Cada tema tiene variantes para grupos de 1 a 4 y restricciones: limitar control duro contra solitario; evitar varias criaturas enormes en escenarios que no admitan acceso a sus puntos débiles; no añadir personajes humanos asociados a monstruos como si fuesen aliados canónicos. Los grupos mixtos son posibles solo como **combinaciones de laboratorio**, marcadas como tales. Si una mecánica experimental no está implementada, omitir ese tema en modo `reglas cerradas` y dejar aviso de cobertura no probada.

### 5. Motor de amenaza para generación infinita
**No utilizar número de enemigos = número de jugadores** ni un multiplicador lineal simple. Implementar un `threat_score` preliminar por **perfil y contexto de la oleada**, configurable y calibrable por resultados observados.

Componentes sugeridos (sin constantes inamovibles):
- `offense`: probabilidad efectiva de impacto usando Atributo + valor de ataque y Resistencia de personajes de referencia; daño esperado por ronda **teniendo en cuenta gasto de Vigor, acciones básicas gratuitas, recuperación y IA**.
- `survivability`: Salud, Resistencia, reducciones directas y opciones de defensa.
- `action_pressure`: número de combatientes enemigos activos y capacidad de concentrar daño; penalizar especialmente grupos con demasiadas acciones frente a un único PJ.
- `control`: inmovilización y pérdida de acciones, ponderadas más fuertemente si el grupo es pequeño.
- `special`: veneno persistente, emboscada, alcance, ataque a distancia y vulnerabilidades situacionales; solo contar efectos implementados y accesibles en el escenario.
- `synergy`: interacciones entre enemigos, cobertura recíproca y saturación de defensas, calculadas a nivel de pack, no mediante suma simple.

Los pesos de estas dimensiones serán parámetros de Laboratorio. `threat_score` es un estimador para proponer packs, **no** un CR definitivo.

**Presupuesto por oleada:**
```
party = clamp(party_size, 1, 4)
wave = max(1, wave_number)
party_capacity = calibratedCapacity(party, party_presets, scenario_rules)
progression = 1 + growthRate * max(0, wave - 1) + milestoneBonus(wave)
target_threat = party_capacity * progression
```
`calibratedCapacity` NO debe ser `party * capacidad_individual` sin corregir economía de acciones. Calibrar mediante simulaciones reales; `growthRate`, hitos y presupuesto inicial se configuran en Laboratorio y se guardan con la versión.

**Algoritmo generador (pseudocódigo):**
```
function makeWave(wave, partySize, seed, rulesetVersion):
    rng = seededRng(seed, wave)
    phase = selectPhase(wave)          // inicial 1..6; luego ciclos con variedad
    budget = targetThreat(wave, partySize, referenceParty)
    legal = catalog.filter(entity => entity.mechanicsSupported && phase.allows(entity))
    legal = legal.filter(entity => encounterCanExpress(entity.requiredTerrainOrCondition))
    pack = []
    while remainingBudget(pack, budget) > minAddableThreat(legal):
        options = legal.filter(entity => withinCountCaps(pack, partySize, entity))
        options = options.filter(entity => synergyThreat(pack + entity, partySize) <= budget * tolerance)
        if options.length == 0: break
        pack.push(weightedPick(options, rng, phase.diversityWeights))
    if pack.length == 0: pack = safestLegalFallback(legal, partySize)
    return {pack, terrain: chooseValidArena(pack, rng), budget, actualThreat: synergyThreat(pack, partySize), seed}
```
- Prohibir bucles sin fin: `maxAttempts`, salida segura y fallback registrado. El modo es infinito por oleadas, no una generación que no termina.
- Distribuir el crecimiento entre cantidad, diversidad, perfiles avanzados y **composición táctica**, no incrementando artificialmente Salud o Atributos de cada especie. Los valores base de las fichas se mantienen.
- Introducir `soft caps` de enemigos simultáneos según tamaño de grupo y restricciones del mapa; si el presupuesto no cabe, utilizar enemigos más peligrosos o terreno táctico permitido, **no** crear decenas de combatientes por obligación.
- Cada cierto número configurable de oleadas puede haber un hito con combinación o criatura de gran tamaño. Después regresar a oleadas variadas con un presupuesto general mayor; no exigir que la dificultad efectiva aumente exactamente en cada encuentro individual.
- **Siempre ofrecer al menos un ataque legal** en cada criatura generada; si gasta todo su Vigor y no tiene acción básica gratuita, puede actuar solo según su ficha, no inventarle una recuperación.

### 6. Calibración y ajuste de dificultad
Para cada tamaño de grupo (1–4) y oleada base, correr al menos 1.000 iteraciones iniciales con semillas fijadas y múltiples instancias de enemigos generadas por dados. Registrar: victorias, incapacitados por equipo, rondas, Salud perdida, Vigor usado/recuperado, turnos sin acción legal, daño por acción, aplicaciones de control/veneno, críticos, desgaste de equipo, supervivencia acumulada y nivel máximo superado.

La dificultad no se valida únicamente por % de victorias: combinar supervivencia, incapacitación y recursos residuales. Guardar `target_threat`, `actual_threat`, errores de predicción y métricas por tamaño de grupo. Ajustar los pesos de la función amenaza **fuera de la carrera** usando resultados agregados; no hacer «rubber-banding» oculto ni alterar las fichas durante una ejecución. Permitir una opción experimental de ajuste adaptativo únicamente si se habilita expresamente y queda anotada en el historial.

### 7. Interfaz y persistencia
- Entrada «Coliseo» en menú principal del simulador; pantalla de configuración con 1–4 PJs, modo independiente/supervivencia, semilla, estado de mecánicas experimentales.
- Pantalla entre oleadas: número, enemigos que aparecerán, presupuesto estimado, estado del grupo, continuar/salir. En modo de ensayo se puede activar una vista técnica de costes y probabilidades, sin mostrar cifras inventadas como dificultad oficial.
- Informe final y exportación reproducible JSON/CSV con ficha/versión de reglas, semilla, composición de oleadas, estadísticas por encuentro y condiciones iniciales. No mezclar historiales viejos de Vulnerabilidad con simulaciones nuevas basadas en Resistencia.
- Las composiciones, límites, pesos, multiplicadores y condiciones deben ser configurables en Laboratorio sin modificar el CORE.

### 8. Criterios de aceptación
1. Coliseo inicia y resuelve encuentros de 1, 2, 3 y 4 PJs reutilizando el motor vigente, con Resistencia.
2. Un sabueso con 0 Vigor puede usar Mordisco de coste 0; Arremetida de coste 2 queda deshabilitada. Recupera solo mediante su acción propia y en condiciones legales.
3. Un enemigo sin acción de recuperación no recupera Vigor por el paso de rondas; una entidad sin Vigor puede usar únicamente las acciones habilitadas por su propia ficha.
4. Humanos conservan Respirar/Tomar Aliento y los costes de su equipo; enemigos con armas no obtienen ataques gratuitos solo por ser criaturas.
5. La misma semilla, perfiles y versiones generan la misma secuencia y resultados bajo condiciones deterministas.
6. Dos carreras con distinto número de PJs generan packs ajustados por amenaza, no simplemente multiplicando el conteo de enemigos.
7. Tras la oleada 6 se generan oleadas 7, 8, 9... sin límite predeterminado, con incremento tendencial de la amenaza y límites de rendimiento.
8. Una mecánica aún no implementada queda visible como pendiente, nunca sustituida silenciosamente.
9. Los cambios de balance no reescriben historiales ni se aplican a mitad de una carrera.

### Referencias internas para Cursor
- CORE 01 — Resolución de acciones: https://docs.google.com/document/d/1VStCBzbHJWPHsW_VRNJdnbKklWAmD8bzZrSTDDeskHY/edit
- CORE 02 — Creación de personajes: https://docs.google.com/document/d/15D3CWXjoYmwbRMJFsUhT0F7Le5_idJLIfMG-GFGoSdo/edit
- CORE 03 — Combate: https://docs.google.com/document/d/1sXRXLuB6rFQ8XTGH0BesdaFhgWm0mcIBm4Rtb8Y_ZsI/edit
- Materiales de simulación: https://docs.google.com/document/d/1Po3WRP41rWiKd-_gqN6124zhvx7EMTYGSAPii0Jxvzg/edit
- Plan previo del simulador: https://docs.google.com/document/d/1WYa5VO4pH6w5VpJImpQKe-vbIQeU2L-nHUuDD1sogS0/edit

---

# ANEXO A. Reglas y convenciones suficientes para implementar los perfiles

> **Prioridad:** El motor existente y sus reglas CORE vigentes son fuente de verdad. Este anexo reproduce lo necesario para poblar el Coliseo sin depender de Google Drive. No reemplaza mecánicas de CORE en evolución. Si el motor discrepa, reportar conflicto y resolverlo explícitamente; no modificar datos silenciosamente. `CONFIRMADO` significa reglas acordadas del CORE; `ENSAYO` identifica cifras o subsistemas aún no cerrados; `PENDIENTE` no debe inventarse.

## A1. Entidades, aleatoriedad y valores

- `actorType`: `human` o `creature`; `profileId`; `instanceId`; `team`; `stats`; `skills`; `actions`; `traits`; `weaknesses`; `equipment`; `currentHealth`; `currentMentalHealth`; `currentVigor` o `null` si no existe; `position`; `statuses`; `rulesVersion` y `catalogVersion`.
- Humanos: Fuerza, Destreza, Percepción, Voluntad, **Conocimiento**, Presencia. Criaturas: mismos cinco atributos físicos/psicosociales, pero **Inteligencia** en lugar de Conocimiento; **Instinto** opcional sin sustituir Inteligencia. No generar Instinto para humanoides sin ficha que lo disponga.
- Para criaturas, cada atributo y reserva se genera tirando **sus dados por cada instancia**. Las cifras `ejemplo` en el anexo B sirven para casos reproducibles de regresión, no para forzar todas las instancias a esos valores.
- Todas las tiradas y decisiones aleatorias, incluida la IA cuando desempata, deben usar RNG semillado versionado. `NdM+K` significa N dados uniformes independientes de 1 a M más K; `floor` es redondeo hacia abajo.
- Capacidad común = Atributo asociado + Entrenamiento/valor propio (0–50), máximo 100. Un ataque de **criatura** usa `Atributo + valor de la acción`, sin Dominio extra; uno de **humano armado** usa `Atributo asociado + Dominio de Arma` según el perfil. El valor de ataque de una criatura ya sustituye la habilidad en la fórmula.
- Los valores de **Resistencia de humanos** en las fichas son provisionales porque su generación en CORE 02 aún está pendiente. La Resistencia natural de una criatura es `base + dados`; la de una armadura equipada se añade sin restarse otra vez del daño. Reducción directa es una propiedad distinta.

## A2. Pruebas y combate (CORE 01/03)

1. Prueba común: d100 ≤ capacidad; umbrales normal = capacidad, mitad = floor(capacidad/2), cuarto = floor(capacidad/4). Valor 01 natural: éxito extremo; 100 natural: pifia. Resolución final de lesiones/pifias, e interacción del 01 con Resistencia, pendiente. Registrar eventos especiales y no producir una tabla inventada.
2. Ataque: `resultado_d100 + resistencia_total_objetivo <= capacidad_ataque`. El **resultado final** (d100 + Resistencia, según CORE 03) determina normal/mitad/cuarto. `01` natural causa daño de cuarto y crítica con interacción todavía por cerrar. Resolver defensas activas tras impacto potencial y **antes** de lanzar daño.
3. Daño: dados base + extras propios de la acción por grado; se aplica reducción directa de daño si corresponde, mínimo 0; el daño efectivo reduce **Salud** o **Salud Mental** conforme a ficha. No hay multiplicador genérico de crítico ni daño de media jornada inventado.
4. En enfrentadas: tira primero la capacidad más alta; empatada, el iniciador. Si el primero tiene éxito, el segundo vence con éxito y resultado **estrictamente menor**; si falla el primero, basta éxito del segundo. Si ambos fallan, nadie vence. 01 y 100 tienen las prioridades de CORE 01. Si el motor tiene utilitario de enfrentadas, reutilizarlo.
5. Ventaja/desventaja: dos decenas y una unidad, elegir el d100 más bajo/más alto. No se acumulan; se cancelan entre sí. El CORE actual **no utiliza modificadores porcentuales generales por circunstancias**: no añadir +10 narrativos fuera de lo explícito en la ficha.
6. Cada humano tiene 1 Acción Mayor y 1 Menor por ronda; el sistema de criaturas registra las acciones con `Mayor`, `Menor` o `Reacción` según ficha, reutilizando turnos del motor. Una reacción defensiva ocurre fuera del turno y no consume Mayor/Menor; solo una defensa por ataque confirmado potencial, pero tantas por ronda como permita Vigor. Nunca crear acciones extra por número de brazos/patas sin regla expresa.
7. Iniciativa: cada agresor lanza 1d100 sin habilidad; el menor es umbral del bando. Cada defensor tira Alerta, se anticipa con éxito y resultado estrictamente menor al umbral. Grupos de orden: anticipados, agresores y defensores restantes; orden interno flexible. No sustituir por iniciativa de Destreza inventada.
8. Zonas: Cerca = misma zona, Lejos = contigua, Muy Lejos = dos o más; zonas narrativas, no metros. Una Menor mueve una zona y Correr (Mayor) hasta dos. Alcance relativo `corto/medio/largo` se usa **dentro de Cerca** para control entre armas; no equivale a Lejos/Muy Lejos. Cuando una ficha dice `Cerca y Lejos`, se refiere a zonas, no al alcance relativo del arma.
9. Oportunidad: un arma de mayor alcance relativo puede anticipar el ataque cuerpo a cuerpo de arma más corta. También al abandonar una zona compartida Cerca hacia Lejos. El ataque cuesta Vigor normal del arma, no acción, máximo una vez por adversario/ronda. No se activa entre armas iguales ni por reposicionarse dentro de la misma zona. Un impacto no cancela automáticamente el movimiento/ataque desencadenante.
10. Esquivar humano: reacción, 2 Vigor, Destreza + Entrenamiento de Esquivar; éxito anula daño. Parar humano: reacción, 1 Vigor con ligera/media y 2 pesada; Destreza + Dominio; éxito intercepta hasta la **capacidad estructural del arma**, aún sin cifras. **Si este subsistema no existe, mostrar la limitación; no adjudicar absorción infinita.** Escudo: reacción provisional 1/2 Vigor según ligero/pesado, suma Resistencia temporal a la tirada original sin nueva tirada; absorción extra de ciertos escudos pendiente.
11. Con Salud ≤0: humano incapacitado y en Agonía conforme al motor; el daño común que cruza un umbral de Salud **no** genera heridas específicas. Con Salud Mental ≤0 un humano pierde el control del personaje conforme CORE 02, no muere físicamente por esa causa.
12. Visibilidad provisional CORE 03: luz suficiente hasta Muy Lejos; poca luz hasta Lejos; penumbra solo Cerca; oscuridad total sin visión útil. Olfato de cazador permite operar sin contacto visual según rasgo, pero no introduce una tasa porcentual nueva de detección.

## A3. Vigor y recuperación: reglas que no deben confundirse

**Humanos:** Vigor máximo `4+floor((Fuerza+Voluntad)/20)`; ataques ligeros 1, medios 2, pesados 3. Respirar: Acción Menor, +1 Vigor inmediato. Tomar Aliento: Mayor, finaliza turno y prohíbe reacciones hasta el próximo; al inicio del turno siguiente recupera `2 + dado de Aguante`: Aguante 0–24 → 1d2; 25–49 → 1d4; 50–74 → 1d6; 75–100 → 1d8. Aguante = Fuerza + Entrenamiento. Si recibió al menos un impacto confirmado durante Tomar Aliento, la recuperación se divide por dos (floor). Con 0 Vigor no pueden pagar acciones de coste positivo hasta recuperarlo; sí pueden Respirar si conservan Menor.

**Criaturas:** no obtienen Respirar/Tomar Aliento por defecto, no recuperan Vigor por ronda y no poseen maná universal. Sus acciones **habituales** pueden costar 0 Vigor y siguen funcionando a Vigor 0. Cada criatura puede tener una acción propia de recuperación; algunas futuras no recuperarán Vigor o carecerán de él. Los ataques con **armas improvisadas** del Hombre Encorvado tienen los costes consignados en su ficha, no son gratuitos por ser criatura. Evitar que IA spammee un especial si no puede pagarlo. El gasto y recuperación se registran como eventos con nombre de acción.

**Humanos de ensayo:** dos inyecciones de estamina y dos médicas por personaje por carrera **solo si el preset de laboratorio las habilita**, como en la especificación anterior del simulador. Aplicar inyección: Menor, objetivo propio o aliado Cerca; estamina restaura todo Vigor; médica restaura `2d6+4` Salud hasta máximo, no cura lesiones. Recursos consumidos persisten en modo Supervivencia. No repartir automáticamente esas inyecciones a criaturas ni inventar suministros entre oleadas.

## A4. Propiedades editoriales, estados y mecánicas pendientes

- `trait`: capacidad innata o efecto pasivo **narrativo o numérico**; una capacidad de rastrear sin vista es válida aunque no dé bonificación. No traducir cada rasgo a +X.
- `weakness`: vulnerabilidad genuina, como un tipo de daño aumentado o un punto anatómico específico explotable. **No** convertir dificultades corrientes de rastreo, reacción ante peligro o falta de Vigor en una vulnerabilidad. Las fichas que dicen `ninguna conocida` no reciben debilidades por generación.
- `status: sujeta`: **ENSAYO**. Tras un ataque exitoso de Sujetar/Aferrar, impide desplazamiento voluntario, habilita Estrangular/Aplastar y se rompe mediante acción de liberación enfrentada. Pendiente: qué prueba usa la víctima, intervención de aliados, interrupciones por lesiones, duración detallada y defensas durante el agarre. Habilitarlo solamente en perfil experimental identificado; si faltan decisiones, bloquear/etiquetar el caso.
- `status: poison_spines`: **ENSAYO**. Solo cuando las espinas producen efectivamente herida penetrante, no por mera cercanía; 1d4 a Salud al final de las dos rondas siguientes. La protección que evita la herida también evita el veneno. No extenderlo indiscriminadamente a todos los ataques de la Cosa Amarilla.
- `positionalWeakness`: **ENSAYO**. Bestia de Catorce Patas: solo articulaciones del lomo alcanzables desde encima → Resistencia efectiva 4. Cosa Amarilla: solo cuerpo alcanzado desde debajo de las extremidades → Resistencia efectiva 5. No sustituir siempre la Resistencia natural, no sumar bonificadores arbitrarios para acceder; registrar una condición/posición verificable y pruebas existentes si proceden.
- `damageOnDefensiveRoll`: Rodar sobre el cuerpo de la Bestia de Catorce Patas tiene 4d8 contundente si gana la enfrentada contra quien está sujeto al lomo. **ENSAYO** y sujeto a que exista estado de aferrarse/escalar sobre gigante; si no existe, no simular daño garantizado.
- Críticos y heridas: registrar 01, 100, tipo de daño y eventos; pendiente tablas específicas de armas/especies, paradas superadas y daños del equipo por tramos. No sumar un efecto universal ad hoc ni producir falsas estimaciones.
- **Fallo importante para Cursor:** no interpretar «valores de ejemplo» como parte de una fórmula. `roll` es la especificación; `example` es una instancia fija solo para regresión.

# ANEXO B. Catálogo íntegro de prueba (datos para crear presets)

Todos los valores y descripciones siguientes proceden del documento **Materiales de simulación** verificado el 18/11/2026. **Son propuestas de balance, no cifras canónicas de Hodgson.** Ninguna entrada con valores pendientes recibe parámetros inventados por el generador.

## B1. Armamento humano

**Convención:** daño = `[normal | mitad | cuarto]`; los extras se añaden a base ya expresada. Los Dominios y Atributos corresponden al **portador humano**; las armas no tienen una capacidad % universal. Durabilidad, intercepción estructural de Parar y reparación faltan por modelo. `ligera=1`, `media=2`, `pesada=3` Vigor por ataque. Las propiedades expresamente pendientes no se activan todavía.

| ID | Arma | Clase | Alcance relativo | Daño y tipo; reserva Salud | Propiedades/estado |
|---|---|---|---|---|---|
| `dagger` | Daga | Ligera, 1 Vigor | Corto | `1d3 \| 1d3+2d4 \| 1d3+4d4`, perforante | Ocultable; efecto específico pendiente |
| `short_sword` | Espada corta | Ligera, 1 Vigor | Corto | `1d6+1 \| 1d6+1+1d4 \| 1d6+1+2d4`, cortante | Ágil: pendiente |
| `broad_sword` | Espada ancha | Media, 2 Vigor | Medio | `1d8+1 \| 1d8+1+1d6 \| 1d8+1+2d6`, cortante | Versátil: 1 o 2 manos, sin bono |
| `axe` | Hacha | Media, 2 Vigor | Medio | `1d8+2 \| 1d8+2+1d6 \| 1d8+2+2d6`, cortante | Impacto concentrado: pendiente |
| `great_sword` | Espadón | Pesada, 3 Vigor | Medio | `2d8 \| 2d8+1d8 \| 2d8+2d8`, cortante | Dos manos |
| `long_spear` | Lanza larga | Pesada, 3 Vigor | Largo | `1d10+1 \| 1d10+1+1d6 \| 1d10+1+2d6`, perforante | Dos manos; control por alcance relativo según CORE |
| `diskos` | Diskos | Pesada, 3 Vigor | Medio (retraído), largo (extendido) | Apagado `2d8 \| 2d8+1d8 \| 2d8+2d8`; encendido `4d8+4 \| 4d8+4+1d8 \| 4d8+4+2d8`, cortante | Encendido gasta +1 Energía/ataque; capacidad/recarga/activación pendientes; mango extendido habilita control de alcance |

**Diskos:** la «Energía ilimitada» de una simulación histórica no es regla del arma. Crear un parámetro de laboratorio expresamente etiquetado y nunca aplicarlo como comportamiento canónico. Un arma con capacidad estructural sin definir no gana Parada ilimitada.

**Armas improvisadas del Hombre Encorvado:** son **acciones de su criatura**, no armas humanas de catálogo genérico. `sharp_stone`: arma media, 2 Vigor, cortante, Cerca/corto, daños `2d6 | 3d6 | 4d6`; `large_rock`: arma pesada, 3 Vigor, contundente, Cerca/medio, daños `3d8 | 4d8 | 5d8`. Su Durabilidad y valor de Parada siguen pendientes.

## B2. Armaduras

| ID | Tipo | Bonificación a Resistencia equipada | Durabilidad | Reducción de daño | Estado |
|---|---|---:|---:|---:|---|
| `armor_light` | Ligera | +3 | 8 | 0 | ENSAYO |
| `armor_medium` | Media | +6 | 12 | 0 | ENSAYO |
| `armor_advanced_heavy` | Avanzada pesada | +9 | 16 | 2 | ENSAYO |

No existe fórmula universal de pérdida de Durabilidad por cada impacto. Los umbrales de desgaste y reparación se establecen por modelo y están pendientes. Los escudos carecen aún de modelos con valores y no deben añadirse como catálogo inventado. La protección natural de criaturas está incluida en su Resistencia propia.

## B3. Criaturas (cinco perfiles distintos)

### `night_hound` — Sabueso de la Noche

**Identificación:** física, grande, cuadrúpedo aproximadamente del tamaño de un caballo robusto, Tierras exteriores y Valle de los Sabuesos; depredador que persigue por olor, puede cazar solo o en manada. Su fuerza y olfato están respaldados en la novela, las cifras son de simulación.

| Atributo | Roll | Ejemplo | Atributo | Roll | Ejemplo |
|---|---|---:|---|---|---:|
| Fuerza | `30+2d10` | 41 | Destreza | `20+2d10` | 31 |
| Percepción | `25+2d10` | 36 | Voluntad | `20+2d10` | 31 |
| Inteligencia | `5+1d6` | 8 | Presencia | `20+2d10` | 31 |
| Instinto | `25+2d10` | 36 | | | |

Reservas: Salud `35+2d10+floor(Fuerza/2)` (ej. 66); Salud Mental `10+1d6+floor(Voluntad/2)` (ej. 28); Vigor `2+1d4+floor((Fuerza+Voluntad)/20)` (ej. 7); Resistencia natural `7+1d4` (ej. 9). Sin armadura ni reducción directa.

Habilidades: Rastrear por olor `Instinto+25` (ej. 61); Alerta `Percepción+20` (56); Acechar `Destreza+10` (41).

| Acción | Tipo, prueba y alcance | Vigor | Daño por grado / efecto |
|---|---|---:|---|
| Mordisco | Mayor; Fuerza+30 (ej. 71%); Cerca | 0 | `2d8 | 3d8 | 4d8`, perforante a Salud |
| Arremetida | Mayor; Fuerza+20 (61%); Cerca | 2 | `3d8 | 4d8 | 5d8`, contundente a Salud; derribo no definido |
| Esquivar | Reacción; Destreza+20 (51%) | 2 | Éxito evita impacto, conforme CORE |
| Retirada y recuperación | Mayor, sin tirada; inicia sin enemigos en misma zona | 0 | +1d4 Vigor, máximo actual; no ataca con esa Mayor |

**Rasgos:** Olfato de cazador: localiza y sigue presas por olor incluso sin verlas, si rastro reconocible; no implica ceguera ni detección automática. Fuerza monstruosa: puede derribar obstáculos ligeros, atravesar vegetación y mover objetos más allá de lo humano ordinario; prueba solo si riesgo/oposición significativa.

**Conducta/tácticas:** sigue olor y busca rastro perdido; usa Mordisco sostenido, Arremetida para esfuerzo mayor. En manada coopera narrativamente, sin bono porcentual gratuito. **Debilidades conocidas:** ninguna; agua corriente puede interrumpir rastro, pero no es vulnerabilidad al agua. **Críticos:** general por tipo hasta tabla propia eventual. **Testing:** 1-2 enemigos y manada, comparar Mordisco gratis versus Arremetida.

### `humped_man` — Hombre Encorvado

**Identificación:** física, humanoide grande, cuello y hombros muy gruesos, vello, musculatura extraordinaria; trepa, acecha, usa rocas y piedras. Se describen emboscadas coordinadas. Hábitat: tierras boscosas/riscos del exterior.

| Atributo | Roll | Ejemplo | Atributo | Roll | Ejemplo |
|---|---|---:|---|---|---:|
| Fuerza | `28+2d10` | 38 | Destreza | `25+2d10` | 36 |
| Percepción | `20+2d10` | 31 | Voluntad | `20+2d10` | 30 |
| Inteligencia | `10+2d10` | 20 | Presencia | `20+2d10` | 31 |
| Instinto | `20+2d10` | 32 | | | |

Reservas: Salud `25+2d10+floor(Fuerza/2)` (ej. 55); Salud Mental `15+1d6+floor(Voluntad/2)` (34); Vigor `2+1d4+floor((Fuerza+Voluntad)/20)` (7); Resistencia natural `4+1d4` (6); sin armadura.

Habilidades: Acechar `Destreza+25` (61); Trepar `Destreza+25` (61); Rastrear por olor `Instinto+15` (47); Alerta `Percepción+15` (46).

| Acción | Tipo, prueba y alcance | Vigor | Daño por grado / efecto |
|---|---|---:|---|
| Golpe con piedra afilada | Mayor; Fuerza+25 (ej. 63%); Cerca, corto | 2 | `2d6 | 3d6 | 4d6`, cortante a Salud; requiere piedra |
| Aplastamiento con roca grande | Mayor; Fuerza+20 (58%); Cerca, medio | 3 | `3d8 | 4d8 | 5d8`, contundente a Salud; requiere roca adecuada, no derribo automático |
| Parar con objeto apto | Reacción, usando capacidad del objeto/acción correspondiente | 1 arma media; 2 pesada | Parada de CORE; valor de intercepción y desgaste del objeto pendientes. **NO** existe acción «Interponer roca» con +Resistencia inventada |
| Esquivar | Reacción; Destreza+20 (56%) | 2 | Éxito evita impacto |
| Recuperar fuerzas | Mayor; sin enemigos en misma zona | 0 | +1d4 Vigor; sin tirada |

**Rasgos:** Olfato desarrollado (detección sin visión mediante rastro); Fuerza descomunal (escala física para rocas/obstáculos); Trepa poderosa (puede trepar árboles y riscos y portar piedras, tirar habilidad en peligro); Uso rudimentario de herramientas (rocas como armas/barreras sin bonos adicionales).

**Comportamiento:** emboscadas, señuelos, ventajas de altura, objetos. Si queda desarmado, no otorgar ataque natural nuevo automáticamente: su acción de golpe natural aún no está definida. **Debilidades:** ninguna conocida. **Críticos:** generales humanoides por tipo. **Testing:** Parar improvisado vs Esquivar, economía de Vigor 2/3, emboscada y coordinación.

### `four_armed_yellow_man` — Hombre Amarillo de Cuatro Brazos

**Identificación:** física, humanoide de piel amarillenta, cuatro brazos, hábitat no precisado. Sujeta con dos y estrangula con otros dos. No posee Instinto adicional en ficha.

| Atributo | Roll | Ejemplo | Atributo | Roll | Ejemplo |
|---|---|---:|---|---|---:|
| Fuerza | `25+2d10` | 36 | Destreza | `15+2d10` | 26 |
| Percepción | `15+2d10` | 26 | Voluntad | `20+2d10` | 31 |
| Inteligencia | `8+1d10` | 13 | Presencia | `20+2d10` | 31 |

Reservas: Salud `20+2d10+floor(Fuerza/2)` (ej. 50); Salud Mental `10+1d6+floor(Voluntad/2)` (29); Vigor `2+1d4+floor((Fuerza+Voluntad)/20)` (7); Resistencia natural `4+1d4` (6). Habilidad: Alerta `Percepción+15` (41).

| Acción | Tipo, prueba y alcance | Vigor | Daño por grado / efecto |
|---|---|---:|---|
| Sujetar | Mayor; Fuerza+25 (61%); Cerca | 0 | Control: ataque contra Resistencia; si impacta aplica condición experimental `Sujeta` (no desplazamiento voluntario). Liberarse = Acción Mayor y prueba enfrentada; habilidad de víctima y otros detalles pendientes |
| Estrangular | Mayor; Fuerza+20 (56%); Cerca; necesita víctima `Sujeta` | 1 | `1d6+2 | 2d6+2 | 3d6+2`, contundente a Salud; no automático; asfixia adicional pendiente |
| Golpe | Mayor; Fuerza+15 (51%); Cerca, corto | 0 | `1d6 | 2d6 | 3d6`, contundente a Salud |
| Recuperar fuerzas | Mayor; sin enemigos en misma zona | 0 | +1d4 Vigor, máximo; sin tirada |

**Rasgos:** Anatomía de cuatro brazos: sujeta con dos y estrangula con dos; mantener agarre no consume acción adicional, provisionalmente 1 víctima sujeta a la vez. Tenacidad del captor: no suelta de forma voluntaria por daño común, pero lesiones incapacitantes de brazos pueden interrumpirlo. **Comportamiento:** se acerca, sujeta y estrangula; no inventar manada ni armas. **Debilidades:** ninguna conocida. **Críticos:** tablas generales humanoides. **Testing:** probabilidad de agarre, dificultad de liberación, intervención de aliados, daño de control; todo bajo etiqueta experimental hasta cerrar `Sujeta`.

### `fourteen_legged_beast` — Bestia de Catorce Patas

**Identificación:** física, enorme; siete patas por costado, vientre bajo, espalda endurecida con protuberancias córneas; hábitat boscoso del País del Fuego y el Agua. Gran resistencia y articulaciones del lomo susceptibles de ataque localizado.

Atributos: Fuerza `35+2d10`, Destreza `10+2d10`, Percepción `15+2d10`, Voluntad `20+2d10`, Inteligencia `5+1d6`, Presencia `25+2d10`, Instinto `20+2d10`.

Reservas: Salud `65+3d10+floor(Fuerza/2)`; Salud Mental `10+1d6+floor(Voluntad/2)`; Vigor `2+1d4+floor((Fuerza+Voluntad)/20)`; Resistencia natural `15+1d6`. Habilidades: Alerta `Percepción+10`; Orientarse `Instinto+10`. Se lanzan dados por instancia; **no** hay un único valor de ejemplo establecido para esta especie.

| Acción | Tipo, prueba y alcance | Vigor | Daño por grado / efecto |
|---|---|---:|---|
| Embestida | Mayor; Fuerza+20; Cerca | 0 | `3d8 | 4d8 | 5d8`, contundente a Salud |
| Rodar sobre el cuerpo | Reacción especial, Fuerza+15, contra atacante **aferrado al lomo** | 2 | Enfrentada contra mantenerse sujeto; si vence, víctima cae y recibe `4d8` contundente a Salud; si falla conserva posición. Reemplaza la defensa ante ese ataque. Experimental hasta definir estado de aferrarse |
| Recuperar fuerzas | Mayor; sin enemigos misma zona | 0 | +1d4 Vigor hasta máximo |

**Rasgos:** Espalda acorazada (Resistencia natural y puntos de apoyo para trepar); Cuerpo descomunal (escala física, obstáculos, restricciones espaciales); Catorce patas (movimiento razonable según descripción, sin penalizador artificial adicional).

**Debilidad:** Articulaciones dorsales expuestas: únicamente ataques que efectivamente alcanzan las articulaciones desde **encima del lomo** usan Resistencia **efectiva 4**, en vez de natural. Es un valor de prueba, no reducción universal. **Conducta:** empuje con el cuerpo y rodar para expulsar atacantes del lomo. **Críticos:** tabla propia pendiente; registrar evento sin inventar lesiones anatómicas. **Testing:** contrastar combate frontal y situado sobre lomo; no suponer que la vulnerabilidad siempre está accesible.

### `yellow_thing` — La Cosa Amarilla

**Identificación:** física, enorme, masa amarillenta oculta bajo arena, apéndices espinosos, veneno aparente y garras peligrosas; región arenosa exterior. Emboscada y captura de presa.

| Atributo | Roll | Ejemplo | Atributo | Roll | Ejemplo |
|---|---|---:|---|---|---:|
| Fuerza | `35+2d10` | 46 | Destreza | `20+2d10` | 31 |
| Percepción | `15+2d10` | 26 | Voluntad | `20+2d10` | 31 |
| Inteligencia | `5+1d6` | 8 | Presencia | `25+2d10` | 36 |
| Instinto | `25+2d10` | 36 | | | |

Reservas: Salud `50+3d10+floor(Fuerza/2)` (ej. 90); Salud Mental `10+1d6+floor(Voluntad/2)` (29); Vigor `2+1d4+floor((Fuerza+Voluntad)/20)` (7); Resistencia natural `9+1d6` (13). Habilidades: Acechar `Destreza+25` (56); Alerta `Percepción+15` (41).

| Acción | Tipo, prueba y alcance | Vigor | Daño por grado / efecto |
|---|---|---:|---|
| Azote de apéndice | Mayor; Fuerza+25 (71%); Cerca | 0 | `2d6 | 3d6 | 4d6`, cortante a Salud |
| Azote de apéndice (variación por zona) | **La misma Mayor** y capacidad, si objetivo Lejos | 0 | `1d6 | 2d6 | 3d6`, cortante a Salud; no es una segunda acción |
| Aferrar | Mayor; Fuerza+20 (66%); Cerca | 1 | Si impacta, aplica `Sujeta` experimental. No inflige daño de forma automática |
| Aplastar | Mayor; Fuerza+20 (66%); Cerca, contra sujeto | 2 | `3d8 | 4d8 | 5d8`, contundente a Salud |
| Recuperar fuerzas | Mayor; sin enemigos misma zona | 0 | +1d4 Vigor hasta máximo |

**Rasgos:** Camuflaje arenoso, inmóvil y parcialmente enterrada parece un montículo; Percepción según CORE, sin inventar porcentaje adicional. Espinas venenosas: si una espina causa herida penetrante, aplica estado experimental de toxina: `1d4` de daño a Salud al final de **cada una de las dos rondas siguientes**; no se activa por estar cerca y una armadura que evita la herida impide exposición.

**Debilidad:** Vientre expuesto. Solamente el ataque que alcance el cuerpo desde **debajo de sus miembros** usa Resistencia efectiva **5**, en vez de su Resistencia normal. **Comportamiento:** espera oculta, intenta sorprender y atrapar; se reorienta ante incursiones bajo el cuerpo. **Críticos:** tabla propia pendiente. **Testing:** emboscada, veneno, alcance Cerca/Lejos, acceso a zona vulnerable, coste de inmovilización.

## B4. Humanos de prueba (dos perfiles sin reglas extraordinarias)

Ambos son **variantes originales de humanos pálidos del exterior** para simulación; su aspecto y equipo no se presentan como cultura documentada por Hodgson. Usan Conocimiento, no Inteligencia/Instinto; sus Atributos son fijos en estos presets (NO tirar atributos por especie). Sus capacidades son `Atributo + Entrenamiento/Dominio`; no tienen ataques gratuitos por ser perfiles de enemigo. Salud `25+floor(Fuerza/2)`; Salud Mental `25+floor(Voluntad/2)`; Vigor `4+floor((Fuerza+Voluntad)/20)`; Resistencia base de ensayo fijada por ficha.

### `pale_raider` — Asaltante pálido / Saqueador

**Rol:** humano ligero, evasión y movilidad; espada corta, daga, armadura ligera; busca presas aisladas y evita combates desfavorables.

Atributos **fijos**: Fuerza 25; Destreza 35; Percepción 30; Voluntad 25; Conocimiento 15; Presencia 20.

Reservas: Salud **37**; Salud Mental **37**; Vigor **6**; Resistencia base **8** (ENSAYO) + armadura ligera **3** = Resistencia total **11**; Durabilidad armadura **8**, reducción directa **0**.

| Habilidad/dominio | Cálculo | Capacidad |
|---|---|---:|
| Espada corta | Destreza 35 + Dominio 25 | 60% |
| Daga | Destreza 35 + Dominio 20 | 55% |
| Esquivar | Destreza 35 + Entrenamiento 25 | 60% |
| Alerta | Percepción 30 + Entrenamiento 15 | 45% |
| Acechar | Destreza 35 + Entrenamiento 20 | 55% |
| Aguante | Fuerza 25 + Entrenamiento 15 | 40% |

Acciones y objetos: espada corta `short_sword` (Mayor, ataque, 1 Vigor, daño cortante `1d6+1 | 1d6+1+1d4 | 1d6+1+2d4`); daga `dagger` (Mayor, ataque, 1 Vigor, perforante `1d3 | 1d3+2d4 | 1d3+4d4`); Esquivar (Reacción, 2 Vigor, 60%); Parar con arma apta, regla general, capacidad estructural pendiente; movimiento, Respirar, Tomar Aliento. No hay debilidades ni rasgos adicionales. **Testing:** ritmo de ataque, esquivas y protección ligera.

### `pale_spearman` — Asaltante pálido / Lancero

**Rol:** humano de alcance, control y armadura media; cubre posiciones y a un compañero.

Atributos **fijos**: Fuerza 35; Destreza 25; Percepción 25; Voluntad 30; Conocimiento 15; Presencia 20.

Reservas: Salud **42**; Salud Mental **40**; Vigor **7**; Resistencia base **9** (ENSAYO) + armadura media **6** = Resistencia total **15**; Durabilidad armadura **12**; reducción directa **0**.

| Habilidad/dominio | Cálculo | Capacidad |
|---|---|---:|
| Lanza larga | Destreza 25 + Dominio 30 | 55% |
| Esquivar | Destreza 25 + Entrenamiento 10 | 35% |
| Parar con lanza | Destreza 25 + Dominio 30 | 55% |
| Alerta | Percepción 25 + Entrenamiento 20 | 45% |
| Aguante | Fuerza 35 + Entrenamiento 20 | 55% |

Acciones y objetos: lanza `long_spear` (Mayor, ataque, 3 Vigor; daño perforante `1d10+1 | 1d10+1+1d6 | 1d10+1+2d6`; alcance relativo largo, dos manos); Parar con lanza (Reacción, 2 Vigor, 55%, capacidad estructural pendiente); Esquivar (Reacción, 2 Vigor, 35%), oportunidad por alcance, movimiento, Respirar y Tomar Aliento. Sin habilidades/poderes adicionales. **Testing:** coste de arma pesada, defensa, control de alcance, comparación con saqueador.

# ANEXO C. Oleadas iniciales: matriz de 1 a 4 personajes

> Estas **son propuestas de laboratorio**, no packs aprobados o calibrados. Su complejidad mecánica crece por tema y no debe atribuirse automáticamente una categoría de dificultad a partir del orden. El modo debe ofrecer una alternativa si una mecánica experimental está desactivada. Los cruces de humanos con bestias son combinaciones de ensayo **sin cooperación canónica**; configurar como `mixedLaboratoryPack` y permitir sustituirlos por packs de un solo tipo. Valores fijos de personajes no proporcionados por el usuario: usar humanos seleccionados/importados del simulador, no crear un grupo estándar oculto.

| Ola | Enfoque | 1 PJ | 2 PJs | 3 PJs | 4 PJs |
|---:|---|---|---|---|---|
| 1 | Humanos y equipo | 1 `pale_raider` | 1 `pale_raider` | 1 `pale_raider` + 1 `pale_spearman` | 2 `pale_raider` + 1 `pale_spearman` |
| 2 | Ataque natural y número | 1 `night_hound` | 1 `night_hound` + 1 `pale_raider` | 2 `night_hound` + 1 `pale_raider` | 2 `night_hound` + 2 `pale_raider` |
| 3 | Improvisación y coordinación | 1 `humped_man` | 1 `humped_man` + 1 `pale_raider` | 2 `humped_man` + 1 `pale_raider` | 2 `humped_man` + 1 `pale_raider` + 1 `pale_spearman` |
| 4 | Agarre | 1 `four_armed_yellow_man` | 1 `four_armed_yellow_man` + 1 `pale_raider` | 1 `four_armed_yellow_man` + 1 `pale_raider` + 1 `pale_spearman` | 2 `four_armed_yellow_man` + 1 `pale_raider` + 1 `pale_spearman` |
| 5 | Veneno y emboscada | 1 `yellow_thing` | 1 `yellow_thing` | 1 `yellow_thing` + 1 `pale_raider` | 1 `yellow_thing` + 2 `pale_raider` |
| 6 | Gran Resistencia | 1 `fourteen_legged_beast` | 1 `fourteen_legged_beast` | 1 `fourteen_legged_beast` + 1 `pale_raider` | 1 `fourteen_legged_beast` + 2 `pale_raider` |

**Pautas obligatorias del generador:**

- Instanciar cantidades **por perfil**, no una cantidad de enemigos igual a PJs. En ola 4 con 1 PJ, el agarre puede bloquearlo por completo: advertir que es `alto riesgo de control`, pero **no** borrar mecánica en silencio.
- Oleadas 5–6 con 1 PJ pueden ser injustas debido a la combinación de Salud/Resistencia enemiga y acceso a vulnerabilidades. Deben quedar **sujetas a calibración**, y no recibirse como encuentros equilibrados de base.
- En las oleadas de encuentros independientes, reiniciar estados por caso **sin regeneraciones gratuitas durante el combate**. En supervivencia, persistir recursos. La recuperación entre olas permanece sin valor definitivo salvo que se trate de acciones legales dentro del motor.
- Las primeras seis filas sirven como `initialWavePresetMatrix`; las oleadas 7+ usan el generador procedural del cuerpo principal de este documento, no reutilizan la misma composición con PV artificialmente aumentados.
- Para pruebas masivas, medir variantes con y sin `Sujeta`, `poison_spines` y `positionalWeakness`, sin presentar resultados experimentales como balance final del CORE.

# ANEXO D. Contrato de implementación y esquema de datos sugerido

No es necesario que Cursor adopte estos nombres de propiedades si el simulador ya posee modelos equivalentes. **Mapear al modelo existente** preservando semántica y conservando importación/exportación. Evitar crear un segundo motor de acciones y estadísticas solo para Coliseo.

```ts
// Pseudotipos orientativos, NO interfaz obligatoria si ya existe otra compatible.
type DiceExpr = string;           // p.ej. "35+2d10+floor(Fuerza/2)"
type Check = { attribute: string; value: number; checkKind: 'skill'|'action'|'domain' };
type ActionData = {
  id: string;
  name: string;
  actionType: 'major'|'minor'|'reaction';
  vigorCost: number | null;       // null = no aplica, no equivale a 0
  check?: Check;                 // omitido cuando no se hace tirada
  rangeZones?: ('near'|'far'|'very_far')[];
  relativeReach?: 'short'|'medium'|'long';
  damageByRange?: Record<string, { pool: 'health'|'mental_health'; kind: string; normal: DiceExpr; half: DiceExpr; quarter: DiceExpr }>;
  prerequisites?: string[];
  effects?: string[];
  mechanicalStatus?: 'closed'|'experimental'|'pending';
};
type CreatureProfile = {
  id: string; kind: 'creature'; nature: string;
  attributeRolls: Record<string, DiceExpr>;
  reserveRolls: { health: DiceExpr; mentalHealth?: DiceExpr; vigor?: DiceExpr; resistance: DiceExpr };
  skills: Record<string, Check>; actions: ActionData[];
  traits: { name:string; narrativeOrMechanicalEffect:string }[];
  weaknesses: { name:string; condition:string; effect:string }[];
};
type HumanPreset = {
  id: string; kind:'human'; attributes: Record<string, number>;
  resistanceBase: number; equippedWeaponIds: string[]; armorId: string;
  domains: Record<string, number>; skillTraining: Record<string, number>;
};
```

**Datos de partida:** identificadores estables de perfil, versión de catálogo, versión CORE, versión de simulador, parámetros de Laboratorio y semilla; instancias con tiradas originales; equipamiento inicial; estado final de cada ola; detalle de acciones elegidas y consumo de Vigor; daños por fuente; motivos de limitaciones experimentales; métricas reproducibles.

## D1. Reglas de IA y consumo de Vigor

- Antes de enumerar opciones, filtrar por recursos suficientes, acción disponible, alcance, equipo y precondiciones reales. Si un ataque tiene coste 0 y está legal, **puede** elegirse aun a Vigor 0.
- Para criatura con ataque básico gratis y especial caro, puntuar el especial por efecto incremental **y coste de oportunidad de Vigor**; no elegirlo de manera fija por ser el daño mayor. Si un ataque especial no tiene objetivo válido, seleccionar otra acción legal.
- Recuperación propia solo cuando sus condiciones sean ciertas (ejemplo: sin enemigos en misma zona). La criatura puede necesitar **alejarse previamente**: desplazamiento y recuperación son acciones diferentes; no teletransportarse ni recuperar en una zona compartida.
- Humanos usan sus propias acciones de recuperación y armas; la IA decide entre atacar, Esquivar, Parar, Respirar y Tomar Aliento según estados. Las criaturas no heredan menú humano por defecto.
- Las entidades sin Vigor y las criaturas con ausencia de recuperación deben soportarse como **casos futuros** aunque ninguno de estos cinco ejemplos las represente todavía. Evitar asumir que todo actor tiene `vigor: number`.

## D2. Tests de aceptación específicos del contenido

1. `night_hound` generado al azar puede tener atributos distintos entre instancias; para el ejemplar fijo, Mordisco usa Fuerza 41 + 30 = **71** y daño normal **2d8** con Vigor 0; Arremetida usa 61, daño **3d8**, cuesta 2.
2. `humped_man` con Fuerza 38 usa Golpe con piedra de **63**, cuesta 2 Vigor, y roca grande de **58**, cuesta 3. Ninguna acción «Interponer roca» ni bono ficticio a Resistencia.
3. `four_armed_yellow_man` no tiene Instinto; Sujetar cuesta 0 y habilita Estrangular solo si está Sujeta la víctima. Al no existir subsistema terminado, registrar estado experimental en resultados.
4. `fourteen_legged_beast`: Resistencia se genera `15+1d6`, pero en una articulación accesible sobre el lomo pasa **a 4** solo para ese ataque; el cambio no se aplica a todo el combate.
5. `yellow_thing`: Azote tiene **una** acción con daño dependiente de Cerca/Lejos; toxina no se aplica por golpe normal si no existe evento de espina penetrante válido.
6. `pale_raider` Resistencia 8+3=**11**; Salud 37, Mental 37, Vigor 6. `pale_spearman` Resistencia 9+6=**15**; Salud 42, Mental 40, Vigor 7. Ambos tienen Conocimiento y recuperación humana.
7. Un ataque con daño `2d8` no debe convertirse en `4d8` salvo que su grado específico lo indique. Los valores de dados se lanzan, no se usan promedios para daño en combate.
8. Las variantes 1–4 PJs de las seis oleadas iniciales producen el conteo correcto y el mismo RNG semillado reproduce las instancias y resultados.
9. Las versiones de Laboratorio pueden desactivar subsistemas en ensayo sin borrar sus datos. Si faltan reglas esenciales para resolver una oleada, mostrar `bloqueada por mecánica pendiente` o `modo experimental`, sin completar silenciosamente con reglas inventadas.
10. Prueba de regresión del simulador: el Coliseo no altera el combate normal, no restaura Vulnerabilidad en vez de Resistencia y conserva los informes anteriores identificados con su ruleset.

## D3. Pendientes explícitos que NO se deben completar automáticamente

- Generación humana definitiva de Resistencia; capacidad estructural y Durabilidad por arma; desgaste detallado y reparación; modelos de escudo; relación de críticos 01 con Resistencia/defensa y tablas de lesión/pifia.
- Conjunto universal de maniobras Sujetar, liberación, auxilio de terceros y sus efectos; asfixia; espinas y envenenamiento más allá de los números provisionales aquí registrados; posición sobre/debajo de enemigos enormes.
- Regla definitiva de cómo aplicar el daño adicional de veneno contra reducción de armadura, si procede; circunstancias exactas que causan herida de espina; distancias narrativas para ataques a objetivos de tamaño extraordinario.
- Recuperación entre oleadas y oportunidades de curación en supervivencia. No introducir descanso obligado entre oleadas ni recargas gratuitas.
- Costes computacionales y parámetros de calibración de `threat_score`. El documento prescribe **cómo** calibrarlos, no presenta coeficientes ficticiamente verificados.

