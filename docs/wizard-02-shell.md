# WIZ-02: ocho pasos y borrador persistente

El creador muestra una pantalla activa, navegación, resumen compacto y pie persistente. En desktop usa tres zonas, en tablet dos y en móvil navegación compacta con desplazamiento propio. Se conserva la identidad visual del proyecto con tokens locales. Entrada directa disponible en `/?mode=creation` sin iniciar combate.

Los datos y sus tiradas siguen en `CreationInput`/`CreationResult`, mediante el mismo generador. Atrás, Adelante y el historial del navegador cambian únicamente la pantalla: no cambian la semilla ni vuelven a tirar. El progreso usa datos efectivamente resueltos y confirmación, no scroll. Las etapas futuras sin antecedentes válidos no son accesibles para confirmar una ficha incompleta.

El borrador de sesión guarda paso, input aplicado y pendiente, resultado/cronología con hash, solicitudes y puntos, ficha importada y hasta diez revisiones. Recuperar verifica el resultado contra motor/semilla/versiones antes de mostrarlo. Los borradores del formato anterior se conservan como entrada compatible. Límites y errores de storage se anuncian; un fallo de guardado activa protección al salir. No se confunde guardar localmente con biblioteca de servidor.

Cambiar procedencia, modo o rama requiere confirmación, conserva revisión y permite Deshacer. Las selecciones sin cambio no provocan invalidación. La importación es una copia y mantiene el JSON nativo; equipo y perfil de ensayo continúan separados. Archivo/biblioteca se pueden abrir desde la cabecera sin repetir sus controles en la pantalla activa.

Los controles específicos de origen/arquetipo y entrenamiento todavía conservan su forma anterior dentro de sus pasos: tarjetas dependientes corresponden a WIZ-03 y el reemplazo de multiselect/asignador a WIZ-04. Revisión y acabado de persistencia corresponden a WIZ-05. Esta etapa no declara terminado el rediseño completo.

Verificaciones: seis recorridos de creación (tres localidades × asistido/manual), atributos fuera de categoría y puntos inválidos rechazados, especializaciones/Facultades, guardar/recuperar mismo paso, equipo de dos manos, archivo exacto, corrupción rechazada, traslado a Laboratorio y Coliseo. Prueba adicional de shell a 1440/390 px: foco en título, atrás/adelante sin reroll, cancelar/confirmar/deshacer dependencias y cero desborde horizontal. Capturas en `reports/creation-wizard/{shell,routes}`. Las pruebas congeladas de WIZ-01 siguen sin cambios.
