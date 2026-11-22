# IA-03 — Intérprete puro de condiciones y prioridades

Base: 8b71298a006789d058507d5a1f78d33af3e54191. Se incorpora `evaluateAIDirectives`, que recibe el conjunto de acciones legales calculado por el decisor. Nunca fabrica acciones, modifica estado ni consulta RNG.

Las condiciones AND/OR cubren Salud, Vigor, acciones disponibles, condiciones existentes, zona, ronda, enemigos visibles, aliado conocido próximo y ataque disponible. Leer recursos/condiciones de otro actor requiere `observedActors` y visibilidad; los datos del propio actor están disponibles. La coordinación identifica aliados/blancos concretos, no concede telepatía ni capacidades nuevas.

Los intents traducen ataque, aproximación, retirada, recuperación, defensa, mantener posición, protección de aliado, foco y habilidad existente a un subconjunto del conjunto legal. Se filtran objetivos inexistentes/no observados y modelos de arma no poseídos. Movimiento usa distancia narrativa existente, sin metros ni restricciones de ocupación inventadas. Entorno/objetivos permanece fuera del contrato por decisión del usuario.

Primero se descartan condiciones falsas e intents sin acciones; luego se elige la prioridad ejecutable mayor. Dentro de ella, órdenes obligatorias prevalecen sobre preferencias. Si quedan varias obligatorias incompatibles se devuelven TODAS como candidatas para el sorteo reproducible de IA-04: no se emite error ni se escoge por ID. Ordenar IDs y acciones solo estabiliza la lista del sorteo. La traza distingue condición falsa, ausencia de acciones y elegibilidad.

La integración runtime y la selección aleatoria se conectan en IA-04 con su transporte de RNG/replay, evitando introducir temporalmente un desempate incorrecto. Los perfiles tradicionales siguen usando el decisor base sin cambios.

Pruebas: mayor prioridad antes de obligatoriedad; descarte de intento ilegal; empate obligatorio sin error/ID fijo; independencia del orden textual; cambio de Salud; protección contra lectura de Salud no observada; AND/OR; acción/actor desconocidos; entradas y RNG inalterados. Suite total 134 pruebas, tipos, lint, formato, build y web.
