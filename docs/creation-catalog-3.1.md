# Etapa 3.1 — Catálogo de creación

Base publicada: 8019acf98e0076c2300ac56463ef95c1e376e185. Inspección: CORE 02, Atributos y habilidades, Nacionalidades y Arquetipos; `character.ts`, `state.ts`, esquemas y transporte existentes. El catálogo es una transcripción declarativa de las fuentes, no una ampliación del reglamento.

`packages/fixtures/src/creation-catalog.ts` registra seis áreas, catorce localidades de Upper Cities, diez ramas sociales y sus diez tablas de arquetipos, los 23 arquetipos generales y 57 habilidades. Conserva las fórmulas exactas, reglas especiales y posesiones de cada arquetipo, incluyendo propiedad de la Watch. Cada entrada cita documento, sección, estado y versión. Los modificadores de atributos y condiciones de sexo son datos explícitos. La generación y la pantalla se implementan en 3.2 y 3.3.

Solo Augyre Siege, Ficino y High Aerie disponen de tablas completas. Su probabilidad mundial conjunta es 0,038: 10 % de Upper Cities × 38 % de las localidades de esa área. Las demás áreas/localidades siguen consultables y pendientes. El encabezado antiguo de Augyre «01–09» contradice la tabla general; se aplica el rango vigente 01–17. Rogue permanece consultable, sin agregarlo artificialmente a tablas de arquetipos.

El validador comprueba esquemas estrictos, IDs únicos, rangos 1–100 sin huecos ni superposición, referencias entre tablas, condiciones y cobertura calculada. Las localidades se relacionan por `areaId`, permitiendo agregar tablas de otras áreas como datos. Exportación/importación canónica con SHA-256 rechaza cambios o corrupción sin sobrescribir el catálogo.

Pruebas: límites de tablas, rutas de High Aerie por sexo, asociación de armas arrojadizas a Percepción en el catálogo general, cinco Facultades Entrenadas/Memoria, máximos de fórmulas de entrenamiento, posesiones de servicio y roundtrip idéntico. No se asigna Resistencia natural ni se inventa una distribución de sexo. Las fórmulas de atributos cubren las siete categorías documentadas.
