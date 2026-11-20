# Etapa 2.1 — Fauna menor de ensayo

Base publicada: 355bc4732db134b65fd2beb72064a2c0146714d3 (CI completo correcto). Catálogo nuevo: `coliseum-catalog-2026-11-20-v3`; v1/v2 permanecen importables como históricos, sin regenerarlos con v3.

## Fuentes y alcance

El enlace de [Project Gutenberg](https://www.gutenberg.org/cache/epub/10662/pg10662.html.utf8) respondió mantenimiento (503) el 20/11/2026. Se verificó el texto primario en su [transcripción del capítulo VII en Wikisource](https://en.wikisource.org/wiki/The_Night_Land/Chapter_7): seres semejantes a escorpiones, del tamaño de una cabeza, compactos, junto a un pozo de fuego; menciones de seres punzantes sin especie descrita. Esta segunda entrada es una denominación descriptiva de ensayo, no una especie identificada por Hodgson. No se asigna veneno, parálisis ni otra condición a ninguna.

Las cifras y los nombres españoles son BANCO_DE_PRUEBAS conforme al plan 2.1. Todos los atributos adicionales son propuestas de ensayo registradas en la definición; no son CORE.

| Dato | Escorpión de los Pozos de Fuego | Pequeña criatura punzante |
| --- | --- | --- |
| ID | fire_pit_scorpion | small_stinging_creature |
| Fuerza | 10+1d6 | 5+1d4 |
| Salud | 3+1d3+floor(Fuerza/2): 9–14 | 1+1d3+floor(Fuerza/2): 5–8 |
| Resistencia natural | 1+1d2: 2–3 | 1d2: 1–2 |
| Destreza / Percepción | 5+1d6 cada una | 5+1d4 cada una |
| Voluntad | 5+1d4 | 1d4 |
| Inteligencia / Presencia | 1d2 cada una | 1d2 cada una |
| Instinto | 5+1d6 | 5+1d4 |
| Alerta | Percepción+5 | Percepción+5 |
| Acción | Fuerza+valor 10; Picadura | Fuerza+valor 10; Picar |
| Daño perforante | 1d4 / +1d2 / +2d2 | 1d3 / +1d2 / +2d2 |
| Vigor y reacción | Ataque 0; sin reserva, recuperación ni Esquivar | Ataque 0; sin reserva, recuperación ni Esquivar |

Salud Mental técnica: 1+1d6+floor(Voluntad/2), sin acciones mentales implementadas. Los ejemplos normalizados V2 usan `vigor: null`; el estado del motor representa la ausencia mediante 0/0, sin recuperación. No heredan daga, reserva ni propiedades de arma humana.

## Implementación y evidencia

Selector Composición inicial + Cantidad; respeta perfiles habilitados y límite técnico explícito (hasta 20). La selección queda guardada/exportada con la configuración, sin alterar el presupuesto ni elevar atributos para forzar dificultad. La matriz por defecto se revisa en 2.3. La arena dispone de 35 zonas para dar posición inicial distinta a hasta 20 enemigos y cuatro PJ; compartir una zona después sigue la semántica Cerca del motor y no se convierte en una regla nueva de ocupación exclusiva.

`minor-fauna.test.ts` prueba 6000 fichas, extremos completos, traza determinista, cálculo atributo+valor, amenaza inferior a Saqueador y ausencia de acciones humanas. Ocho encuentros reproducibles (dos especies × 1/5/10/15) con límite de 400 acciones/3 rondas verifican replay de todos los eventos y ausencia de fallo del motor. Son pruebas técnicas, no una calibración estadística de dificultad.

103 pruebas correctas; tipos, lint, build y pruebas web correctos. Chrome: selección de criatura/cantidad, previsualización, inicio y movimiento autónomo observados. Captura `reports/minor-fauna-ui/01-cinco-criaturas.png`. La estructura visual antigua del Coliseo que aparece allí se reemplaza en 2.4, según el orden autorizado.
