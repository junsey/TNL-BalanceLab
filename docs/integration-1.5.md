# Etapa 1.5 — Integración y auditoría de regresión

Base: e181215e4f2038119acfc8ca6c0d1f9148e4ea26. Fuentes y límites: CORE 01/02/03 citados en el plan y auditoría preliminar del 19/11. Esta etapa no constituye una calibración de balance.

## Resultado

UI, automático, lotes, estudios y Coliseo utilizan las mismas resoluciones. `npm run audit:integration` compara seis encuentros (tres semillas UTF-8, dos contextos) por eventos, estado, consumo de dados, métricas y presentación; incluye tres contrastes con blanco pasivo. Evidencia reproducible: `reports/integration-v1.json`. El blanco pasivo conserva su modelo explícito y no se agrega como si fuera combate táctico.

Cada lote, checkpoint e informe nuevo registra esquema, motor, reglas, catálogo, RNG, métricas y política experimental del 01. Se rechaza agregar resultados incompatibles. Los registros sin versiones quedan históricos. Cargar una carrera antigua conserva sus métricas: no se recalculan ni se regeneran sus criaturas con el catálogo actual; tampoco se permite continuarla como carrera actual.

Los costes de maniobras, recuperaciones e inyecciones se contabilizan por separado, evitando perder gasto/recuperación simultáneos. Cambiar slots no causa desgaste ficticio. Coliseo reutiliza el ejecutor automático y el recolector de métricas. Preparar ataque indica que el Vigor se paga al activarse. Se eliminó el formulario de reglas obsoleto sin consumidores.

## Reevaluación H01–H12

| Hallazgo | Estado de implementación | Evidencia |
| --- | --- | --- |
| H01 motores ofensivos divergentes | Resuelto en simulaciones nuevas | Cálculo compartido; acceso histórico separado; etapas 1.2/1.4 |
| H02 demo incompleta y formulario obligatorio | Resuelto | Inicio directo; Resistencia 4 del ensayo aprobado; captura de menú sobre encuentro iniciado |
| H03 Vulnerabilidad requerida | Resuelto | Esquemas V2 y migración explícita; pruebas de documentos 1.3 |
| H04 copias de capacidad ofensiva | Resuelto | Atributo y entrenamiento de la ficha; pruebas contra cachés obsoletas |
| H05 opciones de regla presentadas como configuración | Resuelto en UI; decisión definitiva del CORE pendiente | Política de ensayo fija y versionada; formulario eliminado |
| H06 regresiones históricas tratadas como reglas actuales | Resuelto | Pruebas históricas identificadas; suites CORE y documentación histórica señalizada |
| H07 blanco pasivo divergente | Resuelto | Cálculo compartido y tres contrastes del informe de integración |
| H08 natural como resultado principal | Resuelto | Captura 03: 42 principal, 38 natural; helper de presentación probado |
| H09 criaturas heredan reglas humanas | Resuelto en acciones actuales; contenido especial pendiente | Pruebas de ataque gratis, agotamiento, recuperación propia y acciones alternativas |
| H10 iniciativa y libertad de intercalación | Resuelto en motor | Pruebas CORE 1.4; convergencia visual del Coliseo pendiente de 2.4 |
| H11 cadena de daño, defensa e intercepción | Resuelto para reglas definidas | Matriz y 21 regresiones CORE 1.4; tablas no publicadas permanecen pendientes |
| H12 estadísticas de versiones diferentes | Resuelto | Metadatos, rechazo de mezclas/checkpoints alterados; importación histórica sin recalcular |

No se afirma que estén definidas las tablas pendientes ni que los ensayos antiguos certifiquen balance actual. El muestreo de 1000+ por composición pertenece a 2.3.

## Verificaciones

101 pruebas; tipos, lint, build y pruebas web de sesiones, CSRF, persistencia, restauración y checkpoints correctos. Auditoría de integración correcta. Revisión visual en Chrome del inicio, navegación de armas/preparación, movimiento, ataque y defensa de IA: costes dentro de los cuadros, resultado modificado principal, natural secundario y log cerrado. Capturas: `reports/integration-ui/01-cambio-arma.png`, `02-preparar-ataque.png`, `03-tirada-modificada.png`.

La unificación estructural Lab/Coliseo y la validación de cuatro PJ/15 criaturas siguen en 2.4; no se declaran terminadas aquí.
