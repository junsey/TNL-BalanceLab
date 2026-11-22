# WIZ-04: atributos y entrenamientos

Seis tarjetas muestran valor aplicado, categoría, fórmula exacta del catálogo, dado concreto y origen. Las ediciones manuales se limitan a los valores de la categoría, con errores asociados al campo. Un cambio legal que puede alterar entrenamientos/posesiones requiere confirmación, conserva revisión y deja los puntos anteriores como borrador para revisar, sin truncarlos.

El generador secuencial no ofrece un RNG independiente de atributos: «Volver a tirar · nueva generación» lo explica antes de cambiar semilla y archiva la revisión. No se finge una tirada aislada ni se cambia el dominio para obtenerla.

Entrenamientos tiene 6A Concesiones, 6B Elecciones (solo cuando corresponde) y 6C Puntos. Las concesiones muestran fórmula, caras, sustitución por máximo para veteranos, procedencia y capacidad desplegable. Los controles ya no usan ningún `select[multiple]`: cada elección tiene búsqueda, contador exacto, casillas y chips que permanecen visibles al filtrar. Las Facultades seleccionadas en un grupo se excluyen del otro; las especializaciones abiertas son controles separados.

El asignador muestra presupuesto restante, entrenamiento base/final y tope por fila; permite sumar, restar, quitar y buscar habilidades nuevas permitidas. No compra especializadas ni mejora las concedidas solo por origen. Rechaza duplicados, reparto distinto de 20, menos de dos habilidades y entrenamiento mayor de 50. La propuesta automática se etiqueta y se puede editar; no pierde puntos por truncamiento. La validación definitiva sigue en el generador.

Las opciones editables, incluso al importar un personaje completo, se consultan al mismo generador con copias del input. No se altera el resultado aplicado ni su cronología. El entrenamiento base descuenta los puntos ya aplicados para evitar sumarlos dos veces en la previsualización. Un borrador puede conservar cantidades inválidas para corregirlas al recuperar; la ficha confirmada mantiene validación estricta.

Verificación: seis recorridos completos en Chrome, archivo nativo, combate, pruebas de selección/búsqueda con Seer en Servicio, mejora de especialización de arquetipo, error del tope 50, recuperación del borrador inválido y propuesta legal a 390/1440. Capturas en `reports/creation-wizard/training`. Las 600 propuestas y las pruebas congeladas de WIZ-01 permanecen válidas; no se cambian generador, tablas ni serialización nativa.
