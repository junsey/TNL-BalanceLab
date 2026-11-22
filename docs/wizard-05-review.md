# WIZ-05: revisión, posesiones y persistencia

La revisión agrupa identidad/procedencia, atributos, reservas, habilidades filtrables, rasgos/capacidades y posesiones. Cada sección tiene estado y acceso a Editar. Una edición que sigue siendo completa vuelve a revisión; dependencias pendientes siguen su recorrido causal. Confirmar exige estado completo y sin cambios pendientes. Resistencia pendiente se explica como limitación del reglamento y no como error del jugador.

La tabla final muestra Atributo, Entrenamiento y Normal/½/¼ del resultado aplicado, con fuente y tiradas desplegables. En móvil se presenta por filas/tarjetas sin desborde. Posesiones usan únicamente resultados de la tabla del arquetipo; el equipo de ensayo queda separado. El historial tiene filtros por etapa y conserva semilla, fórmulas, caras, máximos sustituidos y versiones.

El registro de equipo ahora está controlado por el wizard: navegar, abrir archivos y recargar no reinicia manos, armas, armadura ni perfil experimental. La creación aplicada sigue siendo la fuente de verdad. Una configuración experimental previa se mantiene como borrador separado mientras una nueva rama necesita decisiones; se combina y valida al completar la ficha. Reiniciar un personaje no transfiere ese equipo al nuevo borrador.

La pantalla final da prioridad a guardar copia compartida o conservar en sesión según disponibilidad. Exportar JSON/ficha legible, copiar semilla y crear otro personaje son secundarios. Preparar combate está desplegado aparte y requiere elección explícita del perfil de ensayo. Los nombres repetidos se guardan como copias con ID, sin sobrescribir revisiones anteriores.

Se puede descargar/reabrir el borrador con paso, subpaso, decisiones, cronología y equipo. Importar un personaje completo mantiene sus datos y no obliga a regenerarlo. Se comprueba el borrador y su historial antes de modificar la pantalla; un archivo corrupto no cambia la ficha vigente. Importar sobre un borrador iniciado conserva revisión; Deshacer informa errores sin cerrar la interfaz.

La cabecera agrupa acciones en «Archivo y borrador». El pie ocupa una fila propia siempre visible, sin tapar campos. En desktop el panel central desplaza su contenido conservando navegación/resumen; en móvil el contenido fluye en una sola columna con desplazamiento propio. No se reduce la funcionalidad de archivo para hacer caber la pantalla.

Prueba específica en Chrome: importar JSON congelado de WIZ-01, editar nombre y volver a revisión sin cambiar seed/atributos/habilidades/tiradas; filtrar habilidad/historial; confirmar, equipar y navegar; recargar y recuperar; exportar/reimportar el mismo JSON y borrador; rechazar corrupción; conservar Resistencia oficial `null`. Capturas `reports/creation-wizard/review`. Se mantienen las seis rutas de creación y uso en Laboratorio/Coliseo. Sin cambios al esquema nativo ni migraciones de base de datos.
