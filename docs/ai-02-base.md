# IA-02 — Decisor base único

Base: a77c85b18b11023e1f5a41d7c97063d308187ee9. El punto público `chooseTacticalAction` obtiene una sola vez las acciones legales y el actor, y forma el contexto de una decisión. La selección base consume ese contexto; no vuelve a consultar legalidad, no lo conserva entre pasos ni modifica actores/RNG. Los consumidores continúan entrando por el mismo punto público.

Se conservan orden, prioridades, defensa, política de oportunidades/Talentos, objetivos y puntuación de ataques de los perfiles tradicionales. No se añaden nuevos porcentajes ni recuperación de criaturas. El cambio prepara la evaluación declarativa sin introducir un segundo motor en UI o en Coliseo.

Pruebas: 200 escenarios × todos sus actores, cada decisión pertenece a `getLegalActions`, estado/RNG idénticos tras inspección; criatura agotada con ataque costoso termina legalmente sin recuperar Vigor humano; criatura con básico gratuito conserva ataque a 0 Vigor. Se mantienen las tres semillas de caracterización de IA-01 y los tests manual/automático/replay previos.

Validación: suite completa (130 pruebas), tipos, lint, formato, build y web. Sin cambio de comportamiento ni de versión física del motor en esta refactorización.
