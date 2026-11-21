# Etapa 2.4 — Combate compartido entre Laboratorio y Coliseo

Base: 095a82ffa5b6c3972b5b354e9cde2ead24bef17d; CI de la base correcto. La etapa conserva el motor y el catálogo v4 medidos en 2.3. Las ampliaciones normativas recibidas después se implementarán en su lote propio, sin reinterpretar el informe de 36000 encuentros.

## Composición y presentación

`combat-layout.tsx` compone una sola estructura: PartyBar con comandos y cuatro espacios, TacticalBoard y LatestResolution centrales, EnemyPanel lateral. Ambos modos la consumen. La barra usa todos los IDs de `playerTeam` y permite seleccionar actores con acciones legales; consultar una ficha no consume acciones. Los valores de Alerta y del resumen de la barra se derivan de la ficha actual.

`use-combat-presentation.ts` comparte selección y avance de cuadros, espera de defensa, pausa, velocidad, continuación, contexto del ataque y estado previo reconstruido del historial. `combat-presentation.tsx` comparte iniciativa y ventana de intercambio. Se elimina el `ready=true` del Coliseo y su temporizador de cierre separado. Ninguna animación genera dados ni modifica eventos. Las defensas pendientes enfocan al defensor correspondiente.

Coliseo incorpora consulta de replay activo y de oleadas registradas. Pausar IA conserva la posibilidad de actuar manualmente, igual que en Laboratorio; también permite resolver una defensa manual restaurada. El final de oleada espera al cierre de su intercambio. Supervivencia, recursos, equipos, configuración, calibración, guardado y exportación conservan sus datos y procedimientos.

## CSS y navegación

Se retiran los contenedores de combate `coliseum-roster`, `coliseum-combat` y `coliseum-command` y sus reglas específicas. La previsualización del grupo entre oleadas conserva un estilo separado. Durante combate, controles de carrera, archivos y composición quedan en paneles plegables. No se rediseña el Laboratorio para imitar al Coliseo.

Los submenús de cambiar manos y preparar ataque se mantienen dentro del mismo panel; las tres acciones directas están en una fila. Confirmar una acción devuelve el menú a su raíz. Las zonas y enemigos tienen desplazamiento interno acotado; a 390 px los cuatro espacios permanecen dentro de pantalla. Se corrigió el desborde de la navegación superior móvil.

## Evidencia

108 pruebas de reglas/persistencia y pruebas de tipos, lint, build y web. `npm run test:ui` prueba Chrome contra `npm run dev` (o `TNL_UI_URL`). El CI inicia el servidor y conserva las capturas como artifact.

Las pruebas UI utilizan estados y eventos válidos generados por el motor, guardados y cargados por los flujos reales. Se buscan semillas con PJ habilitados para poder seleccionar los cuatro; no se cambian sus atributos para producir la captura. Verifican:

- 1 y 4 PJ en ambos modos; espacios vacantes y listado de enemigos.
- Selección de cuatro PJ legales, cambio de manos, preparación, regreso a raíz y tres accesos directos alineados.
- Quince enemigos, 35 zonas y ausencia de desborde a 1440 y 390 px.
- Defensa pendiente, resolución y replay con las mismas tiradas modificadas entre modos, sin errores de página.

Capturas comparativas revisadas: `reports/shared-combat-ui/comparativa-1pj.png` y `comparativa-4pj.png`. También se incluyen móvil, quince enemigos, cambio de arma, preparación, defensa, intercambio y replay; `verification.json` identifica las comprobaciones y versiones. Las cabeceras de configuración propias de cada modo se conservan; el árbol de combate, sus componentes y sus controles son compartidos.
