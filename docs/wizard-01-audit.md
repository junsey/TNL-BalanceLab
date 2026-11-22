# WIZ-01: inventario real y compatibilidad

Base de trabajo: `84f5192`. Especificación: `C:/Users/Hell-/Downloads/TNL_BalanceLab_Wizard_Creacion_Personajes_Codex_v1.md` (v1, 21/11). Las ocho pantallas son etapas de interfaz; no agregan fases reglamentarias.

| Responsabilidad actual | Archivo / fuente |
| --- | --- |
| Entrada, navegación y traslado al combate | `apps/web/app/page.tsx`, `lab.tsx`; modo `creation`, `onUse` |
| Formulario, input, resultado, decisiones y puntos | `apps/web/app/character-creator.tsx` |
| Archivos, biblioteca, sesión y equipo de ensayo | `apps/web/app/created-character-storage.tsx`, `loadout-editor.tsx` |
| Dominio determinista y decisiones legales | `packages/engine/src/creation.ts`, `creation-catalog.ts` |
| Tablas, fórmulas, habilidades y posesiones | `packages/fixtures/src/creation-catalog.ts` |
| Registro nativo, integridad, exportación e importación | `packages/engine/src/creation-record.ts` |
| Biblioteca persistente | `apps/web/app/api/records/route.ts`; kind `creation`, migración 004 existente |
| Regresión | `creation.test.ts`, `creation-record.test.ts`, `scripts/test-creation-ui.ts`, nueva `wizard-compatibility.test.ts` |

Mapeo de campos: nombre/semilla/modo → `CreationInput`; área/localidad/origen/arquetipo → IDs de tablas; sexo → rama técnica High Aerie; atributos → categorías y restricciones de `attributeGeneration`; especializaciones/Facultades/adicionales/puntos → `choices` y solicitudes del generador. Los resultados derivados usan exclusivamente `CreationResult`: atributos, habilidades y sus procedencias, reservas, rasgos, posesiones y cronología. El perfil experimental se conserva fuera de `creation`, en `benchProfile`/`loadout` del registro.

La dependencia real alcanza el RNG secuencial: cambiar arquetipo puede alterar tiradas condicionales Seer anteriores a los atributos. No se promete conservar atributos de otra rama sin comprobar igualdad del resultado. Volver entre pantallas conserva la misma semilla y decisiones. El nuevo borrador deberá guardar estado de navegación y revisiones sin cambiar el JSON nativo ni el generador.

Capturas previas: `reports/creation-wizard/before/{1600,900,390}.png`. Alturas observadas: 2374, 2581 y 3805 px; una selección múltiple nativa en cada viewport. No hubo desborde horizontal global en estas referencias. Sí conviven formulario, decisiones, ficha, equipo, archivo e historial en una página extensa; faltan advertencias al cambiar dependencias y la navegación no guarda una etapa.

Se congeló `packages/engine/tests/fixtures/wizard-legacy-v1.json`: JSON nativo completo con especializaciones, puntos y tiradas, más hashes de tres rutas asistidas. Las pruebas exigen importación/exportación byte a byte y resultados idénticos; futuros cambios de interfaz no podrán reescribirlos para aprobar. Se mantienen las seis rutas e2e anteriores y sus pruebas de preparación/archivos.

Tokens locales preparados en `creation-wizard.css`, todavía sin aplicar a la pantalla actual. Estructura prevista: shell de ocho pasos + navegación + panel activo + resumen compacto; selector de procedencia/arquetipo desde catálogo; controles de entrenamiento y revisión; persistencia reutilizada. Sin framework nuevo ni imágenes generadas.

Limitaciones existentes: cobertura completa en tres localidades, resto explícitamente pendiente; Resistencia natural sin regla; ceguera sin interacción de combate aprobada; biblioteca del servidor requiere la DB ya configurada. No se ejecutó una migración de producción durante esta auditoría.
