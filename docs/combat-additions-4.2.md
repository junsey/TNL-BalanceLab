# Lote adicional 4.2 — Ataque de daga secundaria

Base: 0f2abba09da7d4f3b97972a428764713fe57c69c. Se aplica la propiedad aprobada por CORE 03 y la adenda de Daga: una daga realmente equipada en la mano secundaria (slot izquierdo de la interfaz actual) habilita un ataque mediante la Menor disponible. No requiere Talento, no concede acciones adicionales y conserva su coste normal de 1 Vigor.

La acción lleva `actionCost: minor`; los ataques anteriores sin ese campo siguen consumiendo Mayor. Se preserva el ataque de daga guardada con mano libre: no equivale a equiparla en la izquierda y no habilita esta Menor. La generación de acciones comprueba arma, recursos, entrenamiento, objetivo vivo, misma zona y visibilidad. La acción sigue el mismo circuito de oportunidades, defensas, resolución y registro del motor.

El menú común presenta ataques de Mayor y Menor con sus iconos; Laboratorio y Coliseo conservan la selección del coste al elegir el objetivo en mapa o panel. El impacto pendiente conserva ese coste para validar y reproducir una defensa sin exigir erróneamente que la Mayor esté consumida.

Versión nueva de motor: `0.9.0-secondary-dagger`, incluida en informes y simulación pasiva para no mezclar resultados con 0.8. Los formatos anteriores permanecen reconocibles; no se recalculan informes históricos.

Verificación: 118 pruebas, tipos, lint, formato, build y web. Pruebas específicas de coste, conservación de Mayor, ausencia de Menor para daga guardada, falta de Vigor y replay exacto. `test:secondary-ui` comprueba en navegador que el ataque Menor se muestra habilitado y se puede seleccionar; captura en `reports/secondary-dagger-ui/command.png`. Se añade al CI.

El Talento de dos dagas todavía no se ejecuta en esta etapa. Corrección directa posterior del usuario: su coste será **1 Vigor por pareja de golpes**, no por golpe. Esta decisión está registrada para la siguiente integración; no se confunde con el ataque secundario individual de esta etapa.
