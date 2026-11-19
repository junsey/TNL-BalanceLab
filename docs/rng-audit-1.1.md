# Etapa 1.1: dados, semillas y reproducción

Base de main: `ade2f70cb6cf1ccabebc5017b2f216c24d28385d`. El lote anterior ya estaba publicado. Alcance: etapa 1.1 del plan atómico; los cálculos de habilidades y la migración de fichas quedan para 1.2 y 1.3.

## Fuentes y recorrido inspeccionado

- [CORE 01](https://docs.google.com/document/d/1VStCBzbHJWPHsW_VRNJdnbKklWAmD8bzZrSTDDeskHY/edit), revisión consultada del 16/11/2026: percentiles, extremos y ventaja/desventaja.
- [CORE 03](https://docs.google.com/document/d/1sXRXLuB6rFQ8XTGH0BesdaFhgWm0mcIBm4Rtb8Y_ZsI/edit), revisión consultada del 16/11/2026: Resistencia, declaración de defensa y daño posterior.
- Motor: `rng.ts`, `dice.ts`, `state.ts`, `generator.ts`, `simulation.ts`, `tactical.ts`, `coliseum.ts`, `automation.ts` y consumidores de `exchange-roll.ts`.
- Pruebas existentes y nuevas: `packages/engine/tests/rng-audit.test.ts`; corrección de estrechamiento del tipo de evento en `apps/web/tests/immediate-fixes.test.ts`.

## Hallazgos y cambios

1. **No se encontró evidencia para sustituir Mulberry32.** Se conservan hash UTF-8, rechazo de módulo, algoritmo y `rngVersion: mulberry32-utf8-v1`.
2. **Entrada inválida aceptada:** el ancla `$` del parser admitía un salto de línea final. Ahora se exige coincidencia de la expresión completa y entrada de tipo string. Las expresiones válidas y su consumo de dados no cambian.
3. **Corriente reutilizada entre composición e iniciativa:** ambas reiniciaban el RNG con la misma semilla. Las configuraciones nuevas del generador de ensayo y Coliseo incorporan `rngStreams: isolated-streams-v2`; la semilla de combate se deriva de `[versión, "combat", semilla]`. La composición conserva su corriente. Se evita acoplar sus primeras palabras sin cambiar el generador numérico.
4. **Compatibilidad:** la ausencia de `rngStreams` conserva exactamente la semántica anterior. Los registros cargados no reciben una versión implícita. Las partidas nuevas del Coliseo sí seleccionan la versión aislada. El hash de configuración distingue ambos contextos. La calibración histórica se conserva y las futuras usan otro archivo.
5. **Ventaja y 00:** se selecciona la menor combinación porcentual, no simplemente el menor dígito bruto de decenas. Ejemplo decenas 0/1, unidad 0: combinaciones 100/10; ventaja 10 y desventaja 100. Se verificaron las 1.000 combinaciones, cancelación exacta y consumo de 2/3 palabras.
6. **Repetición explicable:** una misma semilla y las mismas decisiones deben repetir resultados. Tres semillas de ejemplo (`rng-audit-alpha`, `rng-audit-ñ`, `rng-audit-03`) trazan iniciativa, consumo, natural, modificación, grado, daño, evento y presentación almacenada. El replay y la presentación no vuelven a tirar dados. Ejecución manual, automática y lotes con distintos cortes conservan los hashes.
7. **Fallo previo:** el test de interfaz del lote anterior accedía a `resistance` sin estrechar la unión del evento, provocando un error de TypeScript. Se añadió la aserción de presencia; no cambia las reglas.

## Auditoría estadística reproducible

Ejecutar `npm run audit:rng -- 1000000 tnl-rng-audit-v1`. Salidas: `reports/rng-audit-v1.json` y `reports/rng-trace-v1.json`. El SHA del JSON es la base auditada; este informe y los cambios se publican juntos en el commit de etapa.

Se fijaron 16 contrastes y alfa familiar 0,001 antes de ejecutar: Bonferroni da 0,0000625 por contraste, sin exigir independencia entre ellos. Se usa Pearson con cola gamma para d2/d3/d4/d6/d8/d10/d12/d20/d100, percentiles, tabla conjunta de dígitos, 2d6 triangular, ventaja/desventaja enumeradas y pares consecutivos disjuntos; correlación mediante aproximación normal de Fisher. Un millón de observaciones por contraste; algunos contrastes comparten observaciones. Los intervalos Wilson del 95% por cara no son intervalos simultáneos.

**Resultado: 16/16 dentro del criterio.** d100: chi² 104,358 frente a límite 162,322 (p=0,33677). 2d6: 11,509 frente a 36,751 (p=0,31929). Pares consecutivos: 9806,520 frente a 10550,647. Correlación: 0,000874 (p=0,38208). No hubo colisiones en los 100.000 identificadores ensayados. Esto no garantiza ausencia de colisiones en un estado de 32 bits, ni demuestra seguridad criptográfica o ausencia universal de sesgo.

Los JSON contienen frecuencias, probabilidades esperadas, semillas, intervalos y trazas auditables. La calibración de 24.000 encuentros anterior queda **HISTORICO** respecto a las corrientes nuevas; no se presenta como balance actual ni se recalcula en esta etapa.

## Verificación y límites

La suite añade límites de caras, rechazo forzado, gramática, suma exacta, percentiles exhaustivos, aislamiento/compatibilidad, restauración, replay y cortes de lotes. No se rediseña la interfaz en esta etapa; se comprueba su función de presentación con los mismos eventos del motor. La auditoría de fórmulas y rutas históricas de Vulnerabilidad sigue pendiente en 1.2; estos resultados no certifican el motor completo.

Verificaciones ejecutadas sobre el código final: `npm test` (65/65), `npm run typecheck` (sin errores), `npm run lint` (sin errores), `npm run build` (compilación de producción y siete páginas completadas), `npm run audit:rng -- 1000000 tnl-rng-audit-v1` (16/16). No se ejecutó una sesión de navegador nueva ni una calibración de balance.
