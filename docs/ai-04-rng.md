# IA-04: desempates reproducibles

El motor `0.12.0-ai-directives` persiste un subflujo `ai-decisions-v1`, derivado de la semilla del encuentro. Solo avanza ante dos o más opciones distintas. Los perfiles antiguos conservan su selector y no consumen este flujo. Los snapshots anteriores siguen siendo históricos; para usar directivas requieren un encuentro nuevo.

Los empates entre órdenes obligatorias también se sortean según la corrección posterior del documento de diseño. Se ordenan IDs y acciones antes del sorteo; cambiar el orden textual no cambia la elección ni su huella normalizada. Primero se resuelve la directiva y después, si corresponde, sus acciones equivalentes. Defensa y oportunidades conservan precedencia urgente.

Laboratorio, Coliseo y ejecución automática transportan la decisión al resolver la acción. El resolver valida actor, acción, secuencia y sorteos antes de mutar el estado. Eventos y snapshots incluyen el RNG actualizado, sin sobrescribir los dados de combate. El log presenta una línea compacta y mantiene la traza técnica.

En perfiles nuevos el fallback compara opciones legales con `previewAttack`, distancia y un estimador explícito de daño base menos reducción/coste. Es una heurística de IA: no cambia fórmulas, no asigna valor a efectos pendientes y no calcula daños definitivos. Sin conocimiento explícito no selecciona por Salud oculta.

Validación: 137 pruebas; reproducción entre ejecución registrada, rápida, replay y snapshot; manipulación rechazada; orden invertido; consumo nulo con opción única; perfiles históricos conservados. `node scripts/audit-ai.ts` ejecutó 360000 desempates: 120000 por cardinalidad 2/3/4. Seis contrastes de Pearson (frecuencias y pares sucesivos no solapados), alfa familiar 0,01 con Bonferroni, semillas prefijadas. Todos aprobados; evidencia en `reports/ai-ties-v1.json`. Esto detecta los sesgos ensayados, no constituye una demostración de independencia absoluta.
