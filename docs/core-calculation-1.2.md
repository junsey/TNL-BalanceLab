# Etapa 1.2: una fuente de cálculo

Base publicada: `71f2d753b7a0ceed393c762ea1319304fc22f428`. Alcance inspeccionado: character, dice, resistance, attack, tactical, automation, playtest, coliseum, fixtures, schemas, catálogo, diagnósticos y presentación de combate.

## Fuentes y decisión

Se consultaron CORE 01 (16/11/2026 14:10 UTC), CORE 03 (16/11/2026 21:05 UTC) y Atributos y habilidades (12/11/2026 13:58 UTC), enlazados en `atomic-plan-v02.md`. La fórmula universal queda en `skillValue`: Atributo + Entrenamiento/Dominio/valor de acción, con máximo 100. Los límites humanos son 5–50 y 0–50. Las criaturas usan su Atributo propio, que puede superar 50. No se cambia el CORE.

`core03-sheet-v1` identifica la nueva ruta y `0.7.0-core03-sheet` sus estados. La interacción del 01 permanece **BANCO_DE_PRUEBAS**, con una única política `requiresImpact`; no se ofrece un selector de reglas. Los modelos de daño/equipo conservan su condición experimental.

## Mapa de llamadas

| Entrada | Cálculo compartido | Consumo |
| --- | --- | --- |
| Ficha humana | deriveCharacter / skillValue | Reservas, habilidades comunes y editor |
| Arma humana | attackSkill → skillValue | Atributo del catálogo + Dominio de ficha |
| Acción de criatura | attackSkill → skillValue | Atributo vivo por clave + valor propio de acción |
| previewAttack | attackSkill + coreResistance | Menú, probabilidades y declaración |
| declareAttack | previewAttack → compareResistanceAttack | Evento captura los componentes usados |
| compareResistanceAttack | skillValue → classifyModified | Impacto, grados y recomparación de escudo |
| classify | classifyModified | Pruebas comunes con extremos naturales |
| Blanco pasivo | previewAttack → compareResistanceAttack | Mismos umbrales, natural, modificación y grado |
| IA / estimador del Coliseo | previewAttack / attackSkill / bodyResistance | Sin capacidad ofensiva paralela autoritativa |
| Menú / ficha / intercambio | attackSkill, combatSkill, describeDefense / target del evento | Presentación de valores del motor |

Armas incorporan asociación de Atributo y Dominio; armaduras/escudos incorporan bonificación explícita; cuerpo incorpora Resistencia natural. Las acciones de criatura enlazan el Atributo por clave para no utilizar una copia numérica obsoleta. Son extensiones mínimas para habilitar la fuente única; la migración general de formatos corresponde a 1.3.

En el banco vigente, Espadas usa Fuerza, Dagas y Lanzas usan Destreza conforme al catálogo de habilidades. Vigía conserva 25+35=60 y daga 25+35=60; los Acechadores conservan Fuerza 25 + acción 20=45 y Resistencia natural 4, con los demás valores intactos. Saqueador calcula espada 25+25=50 y daga 35+20=55. No se guarda 45/50/55/60 como una estadística ofensiva independiente.

La Resistencia sale del cuerpo y de la armadura realmente equipada y utilizable. Un cambio o rotura altera la próxima vista previa. El escudo solo se suma en la reacción y reutiliza el dado atacante. La reducción directa sigue separada de la bonificación de Resistencia. Los valores numéricos de equipo y Resistencia de estos presets siguen siendo ensayos, no canon.

## Históricos

La ruta Vulnerabilidad queda explícita en `deriveHistoricalCharacter`, `attackTarget` y los auxiliares históricos. Los estados y eventos anteriores conservan su lectura/replay y no se reinterpretan. `startTacticalEncounter`, lotes y ensayo pasivo nuevos exigen la versión actual. Laboratorio y Coliseo bloquean actuar/automatizar registros históricos. Los auxiliares históricos se conservan para validar evidencia archivada y sus regresiones; no se exponen como elección de reglas al jugador.

Campos antiguos de Fighter y mapas resistance se conservan por compatibilidad del formato. En la ruta nueva no son autoritativos para ataque, Resistencia, habilidades humanas o Parar. Su limpieza y migración explícita se realiza en 1.3. La prueba de datos obsoletos cambia esas copias deliberadamente y confirma que no alteran el resultado actual.

## Verificación

Se añadieron seis pruebas de integración: propagación de Atributo y Dominio; equipo/rotura/escudo sin otro dado; criaturas con atributos vivos; habilidades comunes/Parar/Arrojar; equivalencia del blanco pasivo con vista previa y declaración; rechazo de partidas históricas nuevas y conservación del snapshot.

Prueba en navegador local: apertura del Laboratorio, menú de espada/daga al 60%, creación e inicio de oleada del Coliseo y menú del Saqueador con espada 50% y daga 55%. Se verificó el DOM visible; no se guardó una captura nueva. La unificación completa del contenedor visual del Coliseo sigue en su etapa correspondiente.

Pendientes de otras etapas: migración persistente 1.3, auditoría de toda la cadena 1.4, consistencia integral de métricas 1.5 y calibración nueva. La referencia histórica de 24.000 encuentros no certifica esta versión.

Verificaciones finales: `npm test` 71/71; `npm run typecheck`, `npm run lint` y `npm run build` correctos. `npm run test:web` verificó sesiones, CSRF, conflictos, restauración, importación de estudios y checkpoints con una base de pruebas temporal.
