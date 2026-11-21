# Lote adicional 4.1 — Contrato de Talentos y Dones

Base: 0e0c890dd62ab4d8675e92e493408876aa6facba; CI correcto. Fuente: decisiones aprobadas del [documento incremental](https://docs.google.com/document/d/1QpgUeEetTz-pwUjCPF_BtMsHabOL0YNBADHbZxgNkHs/edit), 20/11/2026, y adenda de Dos Dagas. El usuario autorizó continuar este lote después del plan original.

Se agrega un contrato opcional versionado al actor para Talentos y Dones, con procedencia obligatoria (arquetipo, lugar natal, progresión o fixture), documento, sección y estado reglamentario. Riposta y Contraataque Ágil tienen un único otorgamiento de nivel I o II; Dos Dagas no recibe niveles inventados. Se rechazan duplicados, niveles inválidos y capacidades en la categoría equivocada. Los actores existentes permanecen sin capacidades si su ficha no las concede.

Audición Nocturna se registra conceptualmente como Don pendiente de mapeo. No se elimina la habilidad existente ni se convierten las Facultades del Seer. La importación de un actor que duplique Audición Nocturna como Don y habilidad se rechaza sin borrar entrenamiento. Las cinco Facultades conservan sus reglas, valores y condición de Entrenada/Memoria.

El catálogo declarativo conserva las decisiones cerradas: Riposta solo Parar, incluso parcial; escudo no dispara grados; Contraataque Ágil solo Esquivar; umbrales por nivel, coste normal del arma tras defensa, sin tope fijo por ronda. Todavía no ejecuta esas reacciones: su integración táctica es una etapa posterior. Tampoco activa Dos Dagas mientras su coste e interrupciones sigan sin cierre. No se inventan adquisición, precios, progresión ni talentos iniciales del creador.

Pruebas: validación, roundtrip del actor, conservación íntegra de la ficha, ausencia de concesiones universales y rechazo de duplicación. Se ejecutan además la suite completa, tipos, lint, formato, build y web. Esta etapa es de datos; no modifica la presentación ni consume RNG.

Siguientes dependencias: propiedad secundaria de Daga; reacciones de Talentos; estados y efectos aprobados con sus pendientes explícitos; motor común de IA y plan técnico vinculado; maniobras con separación de propuestas editoriales. Punto 5 (objetivos/entorno) excluido por decisión expresa. Acechador a coste 0 sigue siendo propuesta pendiente: no se activa como si estuviera aprobado.
