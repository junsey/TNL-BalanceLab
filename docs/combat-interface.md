# Presentación del combate

La barra inferior fija integra el menú de comandos a la izquierda de los cuatro espacios del grupo. Las fichas y el menú se despliegan hacia arriba. El simulador controla un solo personaje jugador.

El menú separa Acción Mayor, Acción Menor, equipo y reacciones. Al elegir Mover o Correr, hacé clic en un destino legal para ejecutar el desplazamiento. Para Atacar, hacé clic en el blanco resaltado. Al gastar ambas acciones, el simulador cierra el turno controlado cuando termina la resolución pendiente. Si queda una Menor disponible, llegar a 0 Vigor permite Respirar. Tomar Aliento sigue las reglas del motor.

La ventana muestra ataque y defensa en columnas, con los umbrales, dados, daño y cambios de recursos del evento. Las reacciones manuales se eligen después de confirmar el impacto y antes de mostrar daño. La ventana espera **Continuar** por defecto. **Continuación automática** y **Pausar** se pueden cambiar durante el encuentro. En el modo Automático, el jugador maneja a su personaje y la IA maneja a los enemigos.

La ficha distingue la Protección que resta Vulnerabilidad, la Durabilidad que mide desgaste y la reducción directa que ofrecen algunos modelos. Los atributos se muestran cuando están en la ficha del escenario. Los rasgos de ensayo se muestran como etiquetas.

La apertura conserva las tiradas de iniciativa con el snapshot y se puede consultar desde el registro. El log filtra ataques y movimiento, muestra las tiradas y dados, y compara Salud, Vigor, Energía, Durabilidad y condiciones entre eventos. El replay reutiliza los eventos guardados. Los guardados anteriores siguen cargando y muestran un aviso si sus tiradas de iniciativa no estaban registradas.

Los terrenos y las marcas de zona son información visual de cada escenario. El mapa reserva espacio para sus etiquetas, para los sprites y para varios ocupantes. La simulación sigue usando las reglas de movimiento y visibilidad ya configuradas.

**Configuración efectiva** permite buscar una ruta del snapshot y ver el valor y la revisión de origen. Una variante o una edición de catálogo cambia la procedencia de los campos que modifica. El resto conserva la fuente anterior. Un escenario completo de biblioteca aporta sus propios valores y prevalece sobre los valores generales. Los guardados anteriores pueden carecer de este detalle.

### Componentes y verificación

- `combat-view.tsx` y `party-bar.tsx`: menú, mapa y fichas del grupo.
- `lab.tsx` y `encounter-window.tsx`: acciones directas, avance de turno, pausa y comparación de tiradas.
- `styles.css`: barra fija, variantes para pantallas estrechas y paneles de resultados.
- Comprobaciones ejecutadas: `npm run typecheck`, `npm run lint` y `npm test` (37 pruebas).
- Pendiente: comprobación de clics, scroll y paneles desplegados en navegador a distintas resoluciones.

## Lote 01, integración del 18/11/2026

El selector de manos permite una combinación completa con una sola Menor, o cancelar sin coste. Se admite una arma en cada mano, escudo, manos libres y armas a dos manos en ambos slots. La daga guardada solo aparece como ataque con mano libre y no habilita Parar mientras sigue guardada.

Arrojar requiere una propiedad Arrojadiza explícita, Destreza y Dominio de Armas Arrojadizas configurados y el modelo de Resistencia del ensayo. Consume la Mayor y el coste normal de Vigor, añade 1d6 al daño y deja el arma en el hexágono del objetivo. El botón del arma caída ofrece guardar o equipar en una mano libre. Las armas conservan su identidad en el snapshot y el replay.

Los ensayos nuevos solicitan los parámetros de Resistencia y las habilidades de cada arma. Las escalas y políticas de 01/grados son decisiones del diseñador y se guardan en el escenario. La versión se registra como 0.6.0-resistance-experimental. Los historiales anteriores mantienen su versión y se rotulan como históricos. Las nuevas simulaciones desde la interfaz requieren la configuración vigente.

Comprobaciones de esta integración:
- TypeScript y compilación de producción.
- 48 pruebas de motor y presentación, incluida la restauración de grados con Resistencia, manos, lanzamiento/recogida y stock de consumibles.
- Navegador local: configuración explícita de ensayo, equipo de ambas manos, lanzamiento desde mapa, defensa enemiga, oportunidad al retirarse, recogida en la mano izquierda y guardar/cargar.
- Los valores utilizados durante la prueba visual (Atributo 30, Dominio 20 y Resistencia natural 10, bonificaciones 0) se ingresaron para ese ensayo y no son presets canónicos.

Límites existentes: el selector trabaja con el arma principal, un arma de reserva y el escudo ya presentes en la ficha. El sistema de grupos completos y el catálogo de criaturas pertenecen al modo Coliseo solicitado después de este lote.
