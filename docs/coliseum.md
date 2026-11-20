# Coliseo · laboratorio v1

Elegir **Coliseo** en la barra superior. Seleccionar de uno a cuatro humanos de los presets o importar el personaje actual después de configurar su Resistencia. Las copias reciben identificadores propios. Las inyecciones son opcionales y solo se añaden a los presets si se habilitan expresamente.

**Encuentros independientes** parte del estado inicial seleccionado en cada oleada. **Supervivencia** conserva Salud, Vigor, condiciones, armas, armadura, durabilidad y consumibles. No hay recuperación ni reaprovisionamiento entre oleadas. El combate reutiliza el motor táctico existente; no hay un segundo sistema de resolución.

En manual se controlan todos los personajes del grupo y los adversarios actúan con IA. El mapa y las tarjetas permiten seleccionar blancos. Autoejecución controla ambos bandos; puede pausarse y cambiarse de velocidad. El avance entre oleadas es manual salvo que se habilite la casilla correspondiente. El límite de oleadas es técnico y opcional. La derrota de todo el grupo o la decisión de terminar cierran la carrera. Un límite de rondas/acciones se registra como censura técnica.

## Catálogo y cobertura

Versiones: `coliseum-lab-v1`, `coliseum-catalog-2026-11-18-v1`, RNG `mulberry32-utf8-v1`, resolución `resistance-experiment-v1`.

Disponibles: Sabueso de la Noche, Hombre Encorvado, Saqueador y Lancero. Cada instancia de criatura tira sus atributos y reservas mediante su semilla. Los ataques básicos naturales mantienen sus costes propios, incluso 0 Vigor. La recuperación de criaturas requiere su acción de ficha y ausencia de enemigos en la misma zona. El Hombre Encorvado se retira antes de recuperar si está agotado.

Cuatro Brazos, Cosa Amarilla y Bestia de Catorce Patas se muestran bloqueados: faltan decisiones sobre Sujeta/liberación, veneno/espinas, emboscada y posiciones sobre/debajo de gigantes. Los temas 4–6 generan alternativas y registran explícitamente la cobertura omitida. No se presentan esos encuentros alternativos como pruebas de las mecánicas pendientes. El anexo completo de datos queda conservado en `coliseum-specification.md`.

También siguen pendientes las tablas definitivas de críticos, intercepción estructural de Parar y desgaste por modelo. No se asignan valores estructurales ni pérdidas de durabilidad ficticios. La política provisional de 01 se selecciona antes de iniciar y se conserva en el informe.

## Generación y calibración

Las primeras seis composiciones de referencia están versionadas por tamaño de grupo. Los packs mixtos son combinaciones de laboratorio y se sustituyen por packs del mismo tipo cuando se deshabilitan. Los temas no disponibles generan una alternativa con advertencia visible. Desde la oleada 7 se utiliza presupuesto progresivo, semilla por oleada, límite de intentos, fallback registrado y límite simultáneo. No se aumentan Salud ni atributos de las especies para gastar presupuesto sobrante.

El estimador usa ofensiva sostenible, supervivencia, presión de acciones y sinergia. Los efectos de control y veneno no se ponderan mientras no estén implementados. Es un estimador provisional, no una dificultad oficial. Capacidades no lineales por tamaño de grupo, crecimiento, hitos, pesos y límites son parámetros de Laboratorio; se congelan al comenzar la carrera. No hay ajuste adaptativo oculto.

La sección de calibración ejecuta los 24 casos (1–4 PJs × temas 1–6) en un trabajador separado. Por defecto usa 1.000 semillas por caso. Los presets elegidos se repiten para completar los tamaños de grupo y quedan registrados. Los resultados muestran cobertura, victorias, incapacitación, rondas, pérdidas de Salud, consumo/recuperación de Vigor, ataques, daño y críticos. Desgaste permanece en cero por estar deshabilitado; control y veneno no se consideran probados.

Para generar una referencia con corrientes aisladas: `node scripts/calibrate-coliseum.ts 1000 --fresh`. Sin `--fresh` reanuda casos completos de la misma configuración en `reports/coliseum-core03-metrics-v2.json`. La referencia incluida `coliseum-baseline.json` conserva las corrientes históricas anteriores a la etapa 1.1 y no valida las nuevas. Estos resultados son una referencia del modelo reducido y no certifican balance del CORE ni supervivencia a largo plazo.

## Persistencia e informes

El autoguardado local conserva la carrera al cambiar de pestaña o recargar; siempre se recupera pausada. **Guardar carrera** mantiene una copia manual independiente. Se pueden exportar JSON y CSV. Si el navegador se queda sin espacio, exportar JSON.

El JSON incluye parámetros, versiones, semillas, tiradas de creación, composiciones, fichas iniciales y finales, eventos y métricas por oleada. La importación reconstruye cada oleada y verifica el historial y sus hashes. Rechaza versiones incompatibles y escenarios alterados. El CSV resume encuentros completos; un combate interrumpido se conserva en el JSON. Los historiales anteriores a Resistencia no se convierten silenciosamente.
