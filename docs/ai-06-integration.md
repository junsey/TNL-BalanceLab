# IA-06: integración, inspección y regresión

Laboratorio, Coliseo, tandas, worker y ejecución manual/asistida comparten `chooseTacticalAction` y transportan el registro de azar a `resolveAction`/`stepTacticalAction`. `aiDecisionFromDetails` permite reejecutar una acción registrada sin volver a sortear. Los formatos históricos conservan sus datos y replay; para iniciar IA ampliada se requiere el flujo versionado de un encuentro nuevo.

En Biblioteca → Perfiles de IA hay una plantilla editable de ensayo. No asigna automáticamente tácticas al bestiario. Al expandir una acción en el registro aparecen directiva, tipo, prioridad, razón y cantidad de desempates. Otro desplegable muestra candidatos, sorteos y acción seleccionada.

`npm run audit:ai` conserva los seis contrastes de IA-04 y agrega 1000 encuentros comparables: 500 semillas por política con idénticas fichas, límite de ocho rondas y calentamiento previo. `reports/ai-integration-v1.json` registra rondas, Salud perdida, Vigor, acciones, proporción de terminar turno, repetición consecutiva y resultados censurados. Doce comprobaciones adicionales igualan hash y métricas entre consumidores, reejecución y replay. No se retocaron estadísticas para favorecer resultados.

Medición local inicial: política clásica 2243 ms y ampliada 3249 ms por 500 encuentros (1,45×, aproximadamente 4,5/6,5 ms por encuentro). Hay coste adicional observable por trazabilidad, validación y sorteo; no se afirma rendimiento idéntico. Ambas procesan cientos de encuentros por segundo sin ciclos vacíos ni alcanzar el límite de acciones. El escenario provisional sigue mayormente censurado por límite de rondas: 489/500 en ambas políticas; no se oculta su falta de recuperación de Vigor.

Verificación en Chrome real: importar sesión con IA, abrir sus decisiones y editar plantilla; capturas `reports/ai-ui/`. Las comprobaciones estadísticas, integración y UI quedan conectadas a CI. Se conservan snapshots anteriores; no hay migración de DB en esta etapa.

La IA no implementa reglas de estados o maniobras aún pendientes, ni resuelve la incidencia de coste/recuperación del Acechador cambiando su ficha. Los objetivos ambientales continúan pospuestos según la fuente.
