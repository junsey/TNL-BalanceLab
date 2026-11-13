# Arquitectura

`schemas` valida contratos JSON v1, `fixtures` contiene el catálogo de prueba y `engine` ejecuta lógica reproducible sin interfaz, red ni reloj. `apps/web` contiene el tablero Next.js, los workers de lote y estudios, y las rutas privadas.

Las referencias de catálogo se materializan en la configuración del encuentro. El snapshot conserva los datos de entrada y su versión aunque se edite el catálogo. Las rutas privadas validan el documento y aplican revisiones en PostgreSQL. Los lotes usan checkpoints por índice y los workers hacen el cálculo en el navegador. El replay aplica eventos con hashes de estado.

## Responsables de las decisiones

| Decisiones | Módulo responsable |
| --- | --- |
| D01, D16–D19, D26, D32–D33 | Motor de combate, condiciones y supervivencia |
| D02, D04, D22–D24, D27–D28, D30 | Escenarios, mapas y generación de encuentros |
| D03, D06, D21 | Perfiles y selección de acciones de IA |
| D05, D31 | Ejecución individual y por lotes |
| D07, D13, D15, D39 | Laboratorio, catálogos y configuración |
| D08–D09, D20, D38 | Persistencia, revisiones, sesiones y replay |
| D10–D12, D25, D29 | Interfaz táctica |
| D14, D34, D36–D37 | Estudios y analítica |
| D35 | Portabilidad ZIP |
| D40 | Integración y aceptación |
