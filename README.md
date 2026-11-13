# TNL-BalanceLab

Simulador privado de balance para The Night Land RPG. Incluye tablero táctico, ejecución automática, lotes en un worker y biblioteca versionada.

## Instalación y comprobación

Con Node.js 24 y npm, ejecutar desde la raíz del repositorio.

```sh
npm ci
npm run dev
```

Abrí `http://127.0.0.1:3000`. El modo de desarrollo permite usar los datos de ensayo. Para la biblioteca compartida, configurá sesión y PostgreSQL según la guía de despliegue.

En **Automático**, manejás al personaje y la IA decide por los enemigos, incluidas sus defensas. En **Control total**, manejás a todos los combatientes. En **Lotes**, la IA simula ambos bandos.

```sh
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
npm run test:web
```

## Primer ensayo

```sh
npm run playtest -- mi-semilla
```

La prueba enfrenta a un atacante con daga a un blanco pasivo con armadura media y corta al incapacitarlo o al alcanzar 100 rondas. Devuelve la configuración efectiva, las tiradas, los cambios de Salud y Vigor por ronda y un hash SHA-256. El resultado identifica el modelo reducido con las consecuencias de pifias, las lesiones críticas y el desgaste desactivados expresamente.

## Estado

El motor táctico incluye oportunidades, dos disparadores de ataques preparados, Primeros Auxilios, tablas experimentales, Energía y visibilidad. El tablero permite guardar y reanudar una defensa antes de tirar daño. Los lotes separan resultados de modelo reducido, censuras y fallos. Los checkpoints compartidos se confirman en PostgreSQL.

La liberación v0 sigue abierta. La matriz de aceptación identifica el alcance verificado, las brechas funcionales y las pruebas pendientes en producción.

- [Plan completo](PLAN.md)
- [Trazabilidad del CORE](docs/rules-traceability.md)
- [Reglas pendientes](docs/unresolved-rules.md)
- [Arquitectura y responsables](docs/architecture.md)
- [Contrato del encuentro táctico](docs/tactical-engine.md)
- [Presentación del combate](docs/combat-interface.md)
- [Matriz D01–D40](docs/acceptance.md)
- [Despliegue privado](docs/deployment.md)
