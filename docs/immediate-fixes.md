# Inicio directo tiradas y submenús

Corrección sobre la implementación existente. No cambia las fórmulas de combate, costes de maniobras ni historiales anteriores.

## Datos de ensayo aprobados

Confirmados por el usuario el 19/11/2026: Vigía tiene Resistencia natural 4 y conserva su armadura media (+6), Salud 37 y Vigor máximo 6. Cada Acechador tiene Resistencia natural 4; su ataque usa Fuerza 25 + valor propio 20. El 45 se calcula en cada prueba y no se almacena como capacidad independiente. El resto de fichas, armas, armaduras, acciones y reservas se conserva.

Los componentes de ataque se guardan en la configuración de Resistencia del preset. No se transforman cifras antiguas de Vulnerabilidad ni se deducen nuevos atributos. Los campos históricos se conservan para compatibilidad; las fichas actuales muestran los componentes activos de ataque. La política de 01 queda fijada provisionalmente en `requiresImpact` y el grado usa `modifiedRoll`, dentro de `resistance-experiment-v1`; no son selectores del inicio.

## Cambios

- `packages/fixtures/src/tactical-demo.ts`: datos de ensayo aprobados, cargados directamente sin formulario.
- `apps/web/app/lab.tsx` y `lib/preset-diagnostics.ts`: inicio → iniciativa → combate; ausencia de datos en otros presets se identifica sin abrir un formulario ni ejecutar Vulnerabilidad. La edición explícita sigue disponible en Biblioteca mediante el escenario JSON.
- `app/encounter-window.tsx`, `lib/exchange-roll.ts`, `app/combat-log.tsx` y metadatos de eventos de `packages/engine/src/attack.ts`: resultado modificado grande, dado natural secundario en negrita y log con componentes y umbrales. Esquivar/Parar mantienen su dado; escudo muestra la prueba ofensiva recalculada, sin dado nuevo. Los grados provienen del motor.
- `app/combat-view.tsx`, `app/styles.css` y su integración con Coliseo: editores de manos y preparación reemplazan el cuerpo del panel. Cabecera y pie permanecen visibles; cancelar no consume recursos, equipar aplica una Menor y vuelve a Ataque. Preparar conserva los disparadores y costes del motor existente.

## Verificación

Capturas reales guardadas en `reports/ui-fixes`:

1. `01-inicio-directo.png`: iniciativa tras Iniciar encuentro, sin formulario previo.
2. `02-cambiar-arma.png`: editor independiente de manos, sin lista de ataques apilada; botones y pie visibles.
3. `03-preparar-ataque.png`: arma y dos disparadores en vista propia, confirmación única.
4. `04-tirada-modificada.png`: ataque natural 38 + Resistencia 4 = **42** dominante; defensa Esquivar **30** sin añadir Resistencia. Log cerrado inicialmente.

En navegador también se comprobó cancelar sin consumir Menor, equipar consumiendo una sola Menor y volver a Ataque, preparar reservando Mayor y terminando el turno sin pagar Vigor todavía, disparar al entrar un enemigo y abrir el log con Atributo 25 + Dominio 35, Resistencia natural y armadura, umbrales y defensa.

Las pruebas automáticas incluyen los ejemplos visuales 09 → 13 y 76 → 81 y la preservación de fichas por identificador. El ejemplo con escudo y los equipos a dos manos cuentan con pruebas de lógica existentes; no se capturaron visualmente en este escenario porque no equipa escudo ni arma a dos manos. La auditoría general del motor queda fuera de este lote, conforme a lo indicado por el usuario.
