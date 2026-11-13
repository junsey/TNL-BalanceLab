# Encuentro táctico reducido

`startTacticalEncounter` valida la configuración y devuelve el estado inicial y las tiradas de iniciativa. El formato de guardado incluye versiones de motor y RNG, configuración efectiva, orden de iniciativa, ronda, fase, combatientes, resultado y decisión de defensa pendiente.

1. Consultar las acciones con `getLegalActions(state, actorId)`.
2. Aplicar una acción con `resolveAction(state, action)` y conservar el nuevo estado y su evento.
3. Cuando hay un impacto pendiente, consultar las acciones del defensor. El daño se tira únicamente después de resolver su decisión, salvo que Esquivar anule el golpe.
4. Guardar el estado como JSON y cargarlo con `restoreTacticalEncounter`. Para un replay, aplicar cada evento sobre el estado inicial con `replayTacticalEvent`.

El replay aplica los cambios registrados y verifica la secuencia y los hashes de estado. La persistencia del JSON y de los eventos queda a cargo del consumidor. Los hashes verifican consistencia y no autentican quién produjo un registro.

## Configuración de ensayo

El encuentro requiere un PJ, uno o más rivales y un mapa conectado. Se admite ocupación compartida y se calcula distancia por el camino más corto entre hexágonos adyacentes. La iniciativa ordena el consumo de RNG por ID de combatiente y deja que las acciones legales se intercalen dentro del grupo.

Las oportunidades, los ataques preparados y la estabilización se habilitan en el escenario. Una oportunidad puede abrir su propia ventana de defensa antes de continuar con la acción original. La preparación admite un ataque entrante o la salida de un rival observable de la zona compartida. Los dos disparadores usan el mismo orden determinista por ID. Primeros Auxilios requiere habilidad explícita y una Acción Mayor.

Las fichas con Energía declaran capacidad, recarga y modo inicial. Una capacidad nula representa Energía infinita. Si se agota la carga, se usa el modelo de reserva si fue configurado. El impacto guarda el ID exacto del arma que generó la tirada. Esquivar sin desplazamiento requiere desactivar esa consecuencia. Un arma con capacidad de parada pendiente no ofrece Parar. El escudo equipado exige absorción explícita.

El escenario puede habilitar `energy.controls.powerOn`, `powerOff`, `extend` y `retract` de forma independiente. Cada control declara `action` (`major`, `minor` o `none`), `vigor` y `energy`. La operación aparece en **Ajustar arma** si se pueden pagar todos sus costes. `energy.extended` indica la posición del mango y el modelo debe declarar `extendedReach` para usar ese alcance en Cerca. Los costes se toman del escenario de ensayo. CORE todavía tiene pendiente fijar los costes definitivos del Diskos.

Las prioridades opcionales `powerOn` y `extend` permiten que un perfil de IA use esos controles cuando sean legales.

El módulo experimental de Esquivar acepta `rules.dodgeRoutes`, un objeto de zonas de origen a destino. Si se habilita `dodgeDisplacement`, una Esquiva exitosa aplica la ruta declarada para la zona del defensor antes de continuar. Las rutas pueden incluir permanencia en la misma zona y el desplazamiento del módulo no abre oportunidades propias. El motor registra el desplazamiento sin tirar daño ni dados adicionales. Si la regla está activa y falta la ruta necesaria, emite `UNRESOLVED_RULE`. En el catálogo de módulos, el mismo mapa de rutas se declara como `parameters.routes` para `dodge-displacement`.

Las tablas experimentales aceptan pérdidas declaradas de Salud o Vigor y condiciones con duración por turno, ronda, encuentro o persistente. Una condición puede bloquear acciones o reacciones y causar pérdida de Salud al final de la ronda. El apilamiento se declara como `stack`, `refresh` o `ignore`. Las claves de tabla incluyen `fumble-consequences`, `critical-injury-piercing`, `critical-injury-slashing`, `critical-injury-blunt`, `parry-overflow` y `block-overflow`.

Para el desgaste, cada fila define un mínimo inclusivo de daño. Se aplica la pérdida de la fila con el mayor mínimo alcanzado. Una lista vacía expresa que el modelo no se desgasta por esa tabla. Un valor nulo indica que falta definirla. Si se necesita una regla activa que carece de contenido, se registra `UNRESOLVED_RULE` y el encuentro termina como `failed_engine`.

Las terminaciones normales del encuentro se clasifican como `completed_reduced_model`. La huida conserva su resultado propio y el límite de rondas se clasifica como censura.

## Evidencia

**Preparar Respirar** reserva la Acción Menor. Se activa antes del ataque entrante del rival elegido o antes de que ese rival salga de la zona compartida, si el actor puede observarlo y reaccionar. Aplica el mismo punto de Vigor que Respirar. La preparación expira con el mismo criterio que un ataque preparado.

Las condiciones de ensayo pueden declarar `turnVigorLoss` para descontar Vigor al final del turno antes de que expire la condición. El registro muestra la pérdida efectiva.

`npm test` incluye encuentros deterministas con impacto, bloqueo, parada, desgaste, guardado en la ventana de defensa, replay, recuperación interrumpida, huida, Agonía y censura.

En una ejecución local de `npm run benchmark`, un escenario de ensayo con un encuentro por partida y bloques de 100 completó 10, 100, 1.000 y 10.000 partidas en aproximadamente 0,05 s, 0,29 s, 2,81 s y 29,09 s. El RSS observado al cierre de bloque llegó a 145 MiB en la corrida de 10.000. Son mediciones del proceso Node local con ese escenario.
