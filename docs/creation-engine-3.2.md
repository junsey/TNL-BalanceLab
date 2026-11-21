# Etapa 3.2 — Generación reproducible

Base: be54ca2d45017563277fff97216484793cc24588 (CI correcto). Inspección: catálogo de 3.1, CORE 02, Nacionalidades/Arquetipos, habilidades, RNG y dados auditados. Catálogo v2 agrega elecciones adicionales como cantidad y fórmula declarativas; el motor no obtiene sus números interpretando prosa.

`generateCharacter` es una función pura: entrada y decisiones + catálogo → ficha, solicitudes pendientes e historial de cada dado. Usa el RNG auditado con una semilla de creación separada. Registra fórmula, caras, sustitución del dado por máximo y consumo del RNG. Repetir la entrada reproduce exactamente los bytes canónicos.

- Mundial: conserva las probabilidades originales y se detiene ante una rama sin tablas. No reintenta para ocultar vacíos.
- Asistida: localidad elegida explícitamente; origen y arquetipo se sortean. Se identifica como muestra condicionada.
- Manual: valida área/localidad/origen/arquetipo y atributos contra las categorías documentadas. Los valores introducidos quedan en la entrada como decisiones manuales.

Las especializaciones abiertas, Facultades, adicionales y puntos libres requieren decisiones explícitas. Las Facultades sociales y de arquetipo son distintas. Adicionales no especializados, sin duplicación; 20 puntos entre al menos dos habilidades, sin superar 50, sin adquirir especializaciones ni mejorar las concedidas solo por origen. Los veteranos sustituyen un dado de cada fórmula de entrenamiento de arquetipo por su máximo, sin aumentar el máximo posible. Se aplican Seer en Servicio/Veterano, Ficino, High Aerie, Monstruwacan, Foreteller, Praetorian Watchman, Investigator Judge y Chaperone de Seers.

Se calculan Salud, Salud Mental y Vigor (hasta 9), así como cada habilidad y sus tres umbrales. Las posesiones conservan texto, condición y dados monetarios, incluyendo multiplicador. No se añaden talentos iniciales sin concesión reglamentaria. La ceguera se registra como rasgo; no se inventan modificadores de combate.

La ficha puede estar completa para creación y seguir `resistencia_sin_regla` para combate: `naturalResistance: null`. La elección técnica separada se integrará en 3.4; nunca se rellena la ficha canónica con una constante de ensayo.

`npm run audit:creation` guarda `reports/creation-audit-v1.json`: 10000 semillas asistidas, las tres localidades, ambos sexos declarados como entradas, decisiones de ensayo explícitas y 10000 repeticiones byte a byte. No es un estudio de frecuencias del mundo: no se confunde la muestra condicionada con la tabla mundial. Las pruebas verifican además categorías, ramas pendientes, veteranos, límites, Facultades, rechazo de rutas ajenas y restricciones de puntos libres.
