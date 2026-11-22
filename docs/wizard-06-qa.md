# WIZ-06: cierre del creador de personajes

Base: `3c3a3605fb18b7b39c01a8205be325c896475ed2`. Publicación final: el commit que incorpora este informe, identificable con `git log -- docs/wizard-06-qa.md`. Las seis etapas WIZ están implementadas; las limitaciones reglamentarias que siguen abiertas se conservan explícitas.

Se corrigió la estructura `dt/dd` de las reservas, el nombre accesible del grupo de modos y el contraste de los bordes. El borrador se recupera automáticamente en el mismo paso, sin insertar una entrada adicional al historial ni consumir azar. También se conserva una edición anterior a «Empezar». Si storage falla, la salida a otro modo pide conservar el borrador o salir expresamente; cerrar/recargar el navegador usa su aviso nativo. Un storage bloqueado durante la lectura no derriba la pantalla.

## Evidencia reproducible

`npm run test:creation-accessibility` ejecuta axe-core 4.14 con reglas WCAG A/AA 2.0/2.1/2.2, sin exclusiones ni reglas desactivadas: 49 estados, ocho pasos, tres paneles de entrenamiento y cuatro anchos (390, 900, 1280 y 1600). Comprueba Enter sin avance accidental, Tab, flechas de pestañas, Escape del modal, reanudación y storage lleno/bloqueado. Resultado y capturas de viewport: `reports/creation-wizard/qa/`. Las capturas se revisaron visualmente en los cuatro tamaños; el pie ocupa espacio propio y el contenido tiene desplazamiento dentro del panel.

El informe conserva comprobaciones incompletas de axe: símbolos de estado y texto parcialmente fuera de la región desplazable. Los símbolos repiten estados escritos y tienen el mismo color que su etiqueta. Se inspeccionó el contraste y la disposición; no se eliminan esos avisos del informe. Una sesión con lector de pantalla real sigue siendo parte del QA humano: las pruebas automáticas no certifican conformidad WCAG completa. Referencia: [WCAG 2.2 de W3C](https://www.w3.org/TR/WCAG22/).

Validación local: 149 pruebas aprobadas (incluye 10000 personajes y sus repeticiones y 600 propuestas), typecheck, lint, formato, compilación de producción, test:web, seis recorridos creation-ui y las suites shell/route/training/review. Se ejecuta además la regresión de interfaz de combate compartida. CI incorpora accesibilidad para repetirla con cada push. El JSON congelado de WIZ-01 permanece sin cambios.

## Matriz de los 26 casos

| Caso | Evidencia ejecutable / resultado |
| --- | --- |
| UX-01 | accessibility: inicio limpio, CTA visible y captura en cuatro tamaños. |
| UX-02 | wizard-shell-ui: cancelar/confirmar/deshacer cambio; creation-route-ui: descendientes válidos. |
| UX-03 | creation-route-ui: ambas tablas High Aerie; ausencia de tercera opción. |
| UX-04 | creation.test: 10000 semillas, Lectura táctil 2d10+20 y ceguera según 01–05; catálogo valida tabla 20/80. |
| UX-05 | creation.test: dos Facultades 2d20+10 distintas; creation-training-ui: selección con contador. |
| UX-06 | creation.test: ambas procedencias veteranas observadas, sustitución por máximo y topes. |
| UX-07 | creation.test: Monstruwacan Seer y no Seer observados, resultado 01–50 cuando corresponde, sin Facultades duplicadas. |
| UX-08 | creation.test: Foreteller siempre Seer con una Facultad propia. |
| UX-09 | creation-training-ui y propuestas sobre 600 rutas: cantidad exacta, exclusiones y especializaciones. |
| UX-10 | creation-training-ui y creation-wizard.test: presupuesto, mínimo dos, tope 50, mejora especializada permitida y rechazo de origen exclusivo. |
| UX-11 | creation.test: seis atributos válidos y Normal/½/¼; training-ui: fórmula, categoría y error de edición. |
| UX-12 | review-ui: reservas y Resistencia null; generación conserva fórmulas y etiquetas provisionales. |
| UX-13 | creation-record.test y review-ui: posesiones separadas del equipo; creation.test: Censor con/sin jerarquía. |
| UX-14 | shell/training/accessibility: recuperar mismo paso, cantidades inválidas editables, decisiones y seed. |
| UX-15 | review-ui y test:web: revisión, exportación nativa y biblioteca persistente. |
| UX-16 | wizard-compatibility.test y review-ui: JSON previo byte a byte, equipo y cronología íntegros. |
| UX-17 | creation.test: 10000 repeticiones exactas; tres hashes históricos congelados. |
| UX-18 | route-ui/shell-ui: nueva generación con confirmación y revisión recuperable; la biblioteca guarda copias por ID. |
| UX-19 | creation-ui/review-ui: equipo y perfil de ensayo explícitos, uso en Laboratorio/Coliseo, resistencia oficial null. |
| UX-20 | shell-ui + accessibility: foco del paso, labels, nombres accesibles, errores, teclado y axe; lector real pendiente de QA humano. |
| UX-21 | accessibility: cuatro resoluciones sin desborde global, capturas verificadas; tabla móvil en tarjetas. |
| UX-22 | training-ui: casillas, búsqueda y chips; sin select multiple. |
| UX-23 | review-ui: editar identidad y volver a revisión sin cambiar atributos, habilidades ni tiradas. |
| UX-24 | route-ui: ruta mundial pendiente sin renormalizar; localidades no disponibles señaladas. |
| UX-25 | route/training/review-ui: rutas, elecciones y errores específicos con acciones para resolverlos. |
| UX-26 | accessibility: storage lleno/bloqueado y salida protegida; review-ui: JSON corrupto conserva ficha; test:web: mismo nombre produce IDs distintos. |

## Cambios y límites

Archivos de esta etapa: `character-creator.tsx`, `lab.tsx`, `creation-review.tsx`, `creation-wizard.css`, `scripts/test-creation-accessibility.ts`, `scripts/test-web.ts`, regresión de creación y CI. No cambia el generador, sus tablas, RNG, esquema nativo ni fixtures históricos; no hay migración de base de datos nueva. La prueba web usa base efímera local; no se modificó una base de producción.

Seguimiento: el borrador de edición admite temporalmente atributos decimales inválidos y especializaciones vacías para recuperarlos y corregirlos. El resultado aplicado conserva su esquema estricto, hash y regeneración; esos valores no se convierten en una ficha legal ni se exportan como personaje confirmado.

Permanecen tres localidades completas, cobertura mundial parcial sin reroll oculto, Resistencia natural sin regla y salud/mental provisionales. Ficino conserva el orden secuencial previo: la tirada condicional se presenta cuando está resuelta la rama de arquetipo. La ceguera no recibe una regla de combate inventada. El equipo de ensayo continúa separado de las posesiones. Las ampliaciones de combate pendientes de definición siguen registradas en `docs/queued-combat-additions.md`; no se declaran completas por terminar el wizard.
