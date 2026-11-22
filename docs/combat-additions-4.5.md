# 4.5: efectos de grado con definición cerrada

Motor `0.13.0-grade-effects`; módulo opcional `approved-grade-effects-v1`, incluido en nuevos encuentros del demo y Coliseo. La versión de reglas del informe identifica el módulo. Los snapshots anteriores sin él mantienen sus cálculos; los JSON de personajes y el catálogo de equipamiento no cambian. Coliseo identifica sus nuevos encuentros como catálogo v5.

Una definición compartida y con fuente aplica: Hacha a mitad o mejor → Derribado; Arremetida del Sabueso a cuarto o mejor → Derribado; Roca grande del Hombre Encorvado a cuarto o mejor → Aturdido; Lanza larga a cuarto o mejor → ignora reducción directa de armadura. Las acciones naturales exigen su perfil de especie, sin conceder el efecto a ataques homónimos de otras fichas.

Derribado es único y persistente hasta Levantarse: una Menor, sin dado ni Vigor. No bloquea ataques o defensas ni añade penalizadores. La acción aparece en Movimiento solo cuando está disponible, comparte el menú de Laboratorio/Coliseo y lo reinicia al ejecutarse. La IA base puede levantarse con esa misma acción legal.

Aturdido consume una única Menor disponible y termina. Si ya estaba gastada, el estado espera a la siguiente reposición, consume esa Menor y termina; los ticks no vuelven a quitarla. No altera Mayor, defensas, Vigor ni tiradas. Se registra explícitamente la pérdida de acción.

La lanza conserva Resistencia de impacto, defensa, dados y RNG; únicamente sustituye por cero la reducción directa de armadura para ese daño. Los dados extras mantienen el cálculo existente, sin reinterpretarlos como acumulación adicional. Una defensa que anula el impacto evita los efectos; la intercepción completa evita contacto. La armadura puede absorber la pérdida de Salud sin cancelar el contacto residual.

Validación: 144 pruebas, umbrales, especies, reproducción de eventos, reducción sin cambios de dados, consumo inmediato/diferido de Menor, UI real en Chrome y captura `reports/status-ui/stand-up.png`. Tipos, lint, formato, build, web e integración.

Quedan fuera de este módulo las reglas abiertas de Hemorragia/consumible especializado, Desmembramiento, dirección/bloqueos del empuje forzado y propuestas editoriales de maniobras universales. No se les asignan cifras o efectos especulativos. El punto 5 de entorno/objetivos sigue pospuesto por la fuente.
