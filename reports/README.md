# Referencia de calibración de Coliseo

`coliseum-baseline.json` contiene 24 casos con 1.000 semillas por caso: grupos de 1–4 humanos y temas iniciales 1–6. La configuración, el catálogo, la revisión de calibración y las fichas de referencia están incluidas en el archivo. La ejecución solo está completa cuando `complete` es `true`.

Los humanos se alternan desde los presets Saqueador/Lancero para completar cada tamaño de grupo. No hay inyecciones, curación entre rondas ni ajuste adaptativo. Son encuentros independientes, no una medición de supervivencia acumulada. Las fichas de criaturas vuelven a tirar sus atributos y reservas en cada instancia.

Los temas 4–6 están omitidos por reglas pendientes y se sustituyen por encuentros legales. Sus filas llevan `coverage: "Tema pendiente omitido; alternativa de reglas disponibles"`; no son pruebas de agarres, veneno, emboscada ni puntos débiles. Control y veneno se registran como no evaluados, no como efectos que hayan tenido cero éxito.

Las métricas son sumas sobre las iteraciones. `healthLost` se refiere al grupo jugador; Vigor, ataques y daño total incluyen ambos bandos. Para porcentajes de victoria usar `wins / (iterations - censored)`, mostrando la censura aparte. Los límites técnicos no equivalen a derrotas. La interfaz usa ese mismo denominador.

El estimador de amenaza sigue siendo provisional. Los resultados no certifican que las seis oleadas sean equilibradas ni establecen una dificultad oficial. Sirven para comparar composiciones y ajustar parámetros fuera de las carreras sin modificar fichas durante el combate.

Repetir con `node scripts/calibrate-coliseum.ts 1000 --fresh`. Sin `--fresh`, la herramienta reanuda los casos completos de la misma revisión y configuración; ejecuta hasta cuatro casos en paralelo, manteniendo sus semillas independientes del orden de ejecución.

## Auditoría RNG 1.1

rng-audit-v1.json contiene los 16 contrastes reproducibles; rng-trace-v1.json contiene trazas hasta presentación/replay. Ver docs/rng-audit-1.1.md.

La referencia coliseum-baseline.json queda HISTORICO tras separar corrientes de composición y combate. Las futuras calibraciones escriben coliseum-core03-metrics-v2.json; no se ha ejecutado una nueva calibración de balance en esta etapa.
