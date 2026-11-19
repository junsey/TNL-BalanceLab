# Etapa 1.3: fichas y migración sin pérdida

Base de main: `c3eaf605d93638a4c115d5c9d16ac6ea37f25411`. Se inspeccionaron esquemas, Fighter, character, generator, simulation, tactical, catálogo, persistencia, biblioteca y presets.

Fuentes: CORE 02 (revisión del 16/11/2026 14:11 UTC), CORE 03 y Atributos y habilidades, enlazados en el plan. Se conserva la generación general de Resistencia como **PENDIENTE_DE_REGLAS**; no se asigna un valor por defecto a una ficha importada.

## Formatos

- Personaje V2: nombre, Atributos, Entrenamientos y Dominios separados, referencias de equipo, Resistencia natural opcional y metadatos de reglas, catálogo y fuente/estado. Resistencia ausente produce `resistencia_sin_regla`; permite conservar el borrador, no iniciar combate.
- Criatura V2: Atributos propios y lista de acciones con modelo, clave de Atributo y valor 0–50. Cada modelo explicita daño y coste. Se valida la existencia del Atributo, coste de Vigor y coherencia de una criatura sin reserva. No se agrega recuperación humana.
- Fighter actual admite formato V2 y fuentes, sin exigir Vulnerabilidad. La lectura de los estados anteriores conserva sus campos tal cual, sin introducir valores ni versiones por defecto.
- Los presets actuales ya no guardan Vulnerabilidad ni la copia numérica del Atributo en cada acción de criatura. Tampoco incluyen una configuración ofensiva paralela en `rules.resistance`. Conservan las reservas y cifras aprobadas; la autoridad del cálculo sigue siendo la ficha/catálogo de 1.2.
- El catálogo del Coliseo pasa a `coliseum-catalog-2026-11-19-v2`; las carreras v1 siguen admitiendo consulta/replay, pero no se mezclan oleadas de otro catálogo al continuarlas. Los ataques naturales ya no heredan propiedades humanas de una daga usada como plantilla técnica.

## Migración y persistencia

`inspectCombatDocument` identifica V1 como **HISTORICO** y conserva el documento original. No hay una transformación general segura de Vulnerabilidad a Resistencia ni de las antiguas capacidades de criatura a Atributo + acción; por eso no se inventa esa conversión.

`migrateCombatScenario` normaliza únicamente escenarios que ya cuentan con todos los datos actuales. Elimina copias antiguas, conserva el original completo con su hash y verifica su integridad. Es explícita e idempotente; no opera sobre snapshots ni eventos de replay. En Biblioteca, «Normalizar escenario» prepara el resultado para guardarlo como revisión nueva, sin sobrescribir el registro anterior.

El servidor admite documentos V1 y V2, escenarios históricos y reportes históricos para archivo. Aplicar una ficha al encuentro exige V2 y datos completos; nunca conserva la Resistencia de la ficha reemplazada para disimular un dato faltante. Las nuevas plantillas de Biblioteca son V2. Su editor actualiza el Dominio asociado por el catálogo, no un campo ofensivo calculado.

## Evidencia

Cinco regresiones nuevas: ida/vuelta exacta V2 y ausencia de Vulnerabilidad; Resistencia pendiente sin valor automático; conservación íntegra de V1; migración con original/hash, repetición idempotente y rechazo de corrupción; acciones de criaturas y reserva coherentes.

La prueba web añade guardado y lectura de personaje/criatura V2 con igualdad completa. En navegador local se verificó la nueva ficha, Resistencia de ensayo y cambio de Dominio 35→40: Parar se actualiza 60→65 y el JSON modifica `mastery.swords`, manteniendo Resistencia 4. No se guardó una captura nueva.

La creación reglamentaria completa y la selección explícita de perfiles de ensayo para personajes generados corresponden a la fase III. Esta etapa no resuelve tablas ni parámetros pendientes del CORE.

Verificaciones: `npm test` 76/76; tipos, lint y build correctos; prueba web completa correcta, incluyendo ida/vuelta persistente de documentos V2. Las verificaciones de navegador fueron locales, sin transmitir fichas a un servicio externo.
