# Etapa 2.2 — Equipo por PJ del Coliseo

Base: 79dbf8d397a230a70c3981a417a69e66a5c4509d (CI correcto). Fuente: CORE 03 vigente, sección de banco de pruebas de armas, armaduras, objetos y modos tecnológicos, consultado el 20/11/2026.

El editor por personaje expone las ocho armas y tres armaduras existentes, principal/reserva, manos, consumibles y escudo importado si cuenta con ficha. No inventa modelos de escudo, capacidades estructurales ni propiedad Arrojadiza. Los modelos originales con IDs diferentes permanecen disponibles e identificados como equipo actual.

Los cambios se aplican a una copia del combatiente, sin modificar Atributos, entrenamientos, Salud ni Vigor. Las capacidades se derivan del Atributo/Dominio de cada arma. Elegir un arma no concede entrenamiento; el editor avisa cuando su Dominio es 0 y el motor mantiene el bloqueo correspondiente. Las armaduras suman su bonificación a Resistencia natural. Las dos manos se validan con el mismo motor del combate.

Diskos apagado/encendido conserva daño y costes del catálogo. Encendido exige una reserva finita elegida expresamente como ensayo; no hay capacidad automática, Energía ilimitada, activación o recarga nuevas. Un Diskos importado que conserva el mismo modelo y reserva conserva sus datos tecnológicos. La reserva del editor admite modelos físicos; el modo encendido se configura como principal porque la reserva de Energía del estado es específica del arma principal. La activación reglamentaria definitiva sigue pendiente.

## Guardado y separación

`loadout.ts` define `coliseum-loadout-v1`, fuente `configuracion_de_laboratorio`, versión del catálogo y hash. Guardar/cargar utiliza almacenamiento del navegador. Exportar/importar JSON usa el mismo esquema y comprueba integridad antes de reemplazar la configuración. Restaurar equipo original descarta el ensayo. Las carreras guardan la copia equipada y sus existencias, manteniendo la supervivencia y los recursos independientes. Esto no afirma que los objetos de ensayo sean posesiones iniciales concedidas por un Arquetipo; esa integración corresponde a 3.4.

No se introducen presupuestos, pesos ni capacidades de carga. Los límites de formulario son técnicos, no reglas de inventario.

## Verificación

106 pruebas correctas, tipos, lint, build y pruebas web. Pruebas nuevas cubren los 24 pares de arma/armadura, manos ilegales, Energía finita y agotamiento, rechazo de IDs desconocidos y archivos alterados, stock y simulación idéntica tras exportar/importar.

Chrome: cambio a Espada ancha (50%, 1d8+1, coste 2), armadura media (8 natural +6), tres inyecciones, guardar, restaurar original y cargar; bloqueo del Diskos sin Energía, reserva explícita y preparación de oleada. Capturas en `reports/equipment-ui/`. La importación de archivo se verifica en la prueba del mismo módulo usado por la interfaz; no se declara una prueba visual del diálogo nativo de archivos.
