# IA-01 — Inventario y contrato de directivas

Base: 012f641de35ab43041b4da7a65c6cad17eca1f8c. Se leyó el plan técnico vinculado, guardado como fuente en `ai-directives-source-v01.md` con la corrección posterior del usuario en su encabezado. Los empates obligatorios deberán sortearse; quedan descartados el error de conflicto y el ID fijo de la propuesta antigua. No se modifica el documento de Drive.

Autoridad única: `tactical.ts/getLegalActions`, `resolveAction` y `stepTacticalAction`. Decisor: `automation.ts/chooseTacticalAction`, usado por `chooseEnemyAction` y `runAutomaticEncounter`. Consumidores directos: Laboratorio (`nextAuto`), Coliseo (`chooseTacticalAction`), `coliseum.ts`, `coliseum-worker.ts`, simulación/batch/estudios mediante automatización y scripts de auditoría/balance. El replay se compone de cambios y hashes; el RNG actual del encuentro reside en `state.rng`. No hay segundo motor de IA en UI.

El perfil tradicional se mantiene sin nuevos valores predeterminados. El campo opcional `directives` tiene versión 1, IDs únicos, prioridad entera y modalidad mandatory/preference. Su DSL valida condiciones cerradas con AND/OR plano y límites de tamaño, sin JavaScript ni funciones. Los intents solo referencian tipos del catálogo real de acciones. Coordinación requiere objetivo explícito; lecturas de otros actores se limitarán a conocimiento declarado y visibilidad. No se asignan umbrales ni directivas a especies canónicas.

Esta etapa solo incorpora el contrato. Su evaluación y consumo de RNG vienen después. Los perfiles sin campo nuevo conservan exactamente su serialización y decisiones. Tres semillas de caracterización fijan actor, movimiento y motivo; consultar el decisor no cambia estado ni RNG. Se rechazan duplicados, prioridades fraccionarias, referencias a acciones inexistentes, código y entorno pospuesto.

Verificación: suite completa (128 pruebas), tipos, lint, formato, build y web. No cambia ninguna pantalla ni fórmula. No requiere migrar perfiles históricos ni recalcular informes.
