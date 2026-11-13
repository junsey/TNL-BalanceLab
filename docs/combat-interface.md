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
