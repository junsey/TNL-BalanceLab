# Etapa 3.3 — Pantalla de creación

Base publicada: aa58523b01cbc31ce57f6b552a3d6a20ef8095f1; CI correcto. Inspección: generador 3.2, navegación de Laboratorio, formularios, estilos y pruebas UI.

«Crear personaje» es una sección principal independiente del combate y Coliseo. Expone sorteo mundial con cobertura parcial, aleatorio asistido con localidad elegida y selección manual de resultados legales. La elección de área/localidad/origen condiciona el arquetipo disponible; cambiarla reinicia las decisiones dependientes. High Aerie requiere declarar sexo para consultar sus tablas, sin inventar una tirada para ello.

El modo manual admite valores de atributos válidos según su fórmula, o campos vacíos para tirar. Las Facultades y adicionales usan opciones elegibles; las especializaciones abiertas requieren texto; los 20 puntos tienen reparto editable entre dos o más habilidades. Se conservan semilla y decisiones. Solo se ofrece regeneración completa, evitando repetición selectiva que conserve resultados dependientes inválidos.

La ficha presenta procedencia, atributos, entrenamientos y tres umbrales, reservas con sus fórmulas, rasgos, talentos sin concesiones inventadas y posesiones con dados monetarios visibles. Incluye cronología de caras/fórmulas, sustituciones de veterano y consumo de RNG, fuentes y versiones. Los cambios sin aplicar, decisiones pendientes y rutas sin tablas bloquean confirmación. Confirmar creación no habilita automáticamente combate con Resistencia desconocida.

El borrador se guarda/recupera en sessionStorage mediante acción explícita; no se escribe al servidor. La persistencia nativa y preparación del encuentro corresponden a 3.4. La normalización del generador elimina claves opcionales indefinidas que produce la navegación, manteniendo JSON reproducible; prueba de regresión añadida.

Validación: 113 pruebas, tipos, lint, formato, build y pruebas web. `npm run test:creation-ui` recorre seis combinaciones (tres localidades × asistida/manual), resuelve decisiones legales, rechaza atributos fuera de categoría y más de 20 puntos, comprueba confirmación y recuperación de borrador, y mide ausencia de desborde a 390 px. Capturas y resultado en `reports/creation-ui/`; una captura móvil fue inspeccionada. El CI ejecuta ambas suites UI y conserva sus artifacts.
