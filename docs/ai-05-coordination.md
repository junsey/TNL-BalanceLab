# IA-05: condiciones reactivas y coordinación observable

`packages/fixtures/src/ai-coordination.ts` construye un encuentro técnico con dos aliados y dos adversarios, perfiles de concentración/protección y retirada condicionada. Declara expresamente sus actores conocidos. No modifica estadísticas ni concede tácticas universales al bestiario.

El intérprete de IA-03 y el transporte de IA-04 ya cubren estas intenciones sin un segundo decisor. Esta etapa verifica su comportamiento integrado: dos aliados eligen el mismo blanco conocido; protección ataca amenazas alcanzables; desconocer al aliado o invalidar el objetivo hace caer al comportamiento base; una pérdida de Salud cambia el plan; gastar Vigor y resolver la defensa cambia la directiva inmediatamente antes de la próxima acción. Una defensa urgente conserva la política defensiva existente.

La coordinación no añade turnos, acciones ni conocimiento. Cada selección se filtra por las acciones legales actuales. Una ejecución completa registrada y una rápida producen métricas y hash idénticos; el replay reproduce la misma secuencia. No se habilitan objetivos ambientales del punto 5, expresamente pospuestos.

Validación: cuatro casos integrados nuevos, 141 pruebas totales, typecheck y lint. La interfaz no cambia en esta etapa; las capturas y recorridos de IA-04 permanecen vigentes.
