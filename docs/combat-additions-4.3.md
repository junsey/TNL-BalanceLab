# Lote adicional 4.3 — Combate con Dos Dagas

Base: 6f6507f312bad02c0f40de8f8cb0c0c48db8a256 (CI correcto). La decisión directa posterior del usuario fija **1 Vigor por pareja de golpes** y sustituye el coste pendiente de la adenda. La propiedad de daga secundaria sigue siendo independiente del Talento.

Con el Talento y una daga utilizable en cada mano, la Mayor o la Menor de daga secundaria ejecuta dos ataques separados. El primero cobra 1 Vigor; el segundo queda prepagado y no exige un segundo punto. Tiene nuevo d100, grado, daño y defensa propios; no fusiona los dados ni la reducción de armadura. Con ambas acciones disponibles se obtienen cuatro ataques por 2 Vigor total.

La continuación de la pareja se conserva en el estado y en el replay mientras se resuelve la primera defensa. Antes del segundo golpe se comprueba legalidad actual: atacante vivo y capaz, arma utilizable y equipada, objetivo vivo en alcance. No cambia de objetivo ni crea un ataque ilegal. Estos controles reutilizan la legalidad del motor, sin conceder nuevas acciones, descuentos ajenos a la pareja o reglas especiales de retarget.

Armadura pesada desactiva el Talento, no la propiedad secundaria. Se agrega clasificación opcional de armadura y se identifica explícitamente la clase de los tres modelos de ensayo existentes. Una armadura importada sin clasificación no se supone ligera. El editor explica los requisitos pendientes. No cambian protección, Resistencia, reducción ni durabilidad de ningún modelo.

El equipo de laboratorio admite dos instancias de Daga del mismo modelo. El editor ofrece activar el Talento como ensayo explícito, con procedencia `BANCO_DE_PRUEBAS`, sin modificar la ficha canónica ni inventar adquisición. El menú común indica «Atacar con dos dagas» con su icono Mayor/Menor. Motor `0.10.0-dagger-pairs`; versiones anteriores permanecen reconocibles y los informes históricos no se regeneran.

Validación: 121 pruebas, incluidos cuatro ataques, coste con un solo Vigor restante, pesada/sin Talento, armadura reducida por golpe y replay exacto en cada defensa. Tipos, lint, formato, build y pruebas web. Navegador: `test:paired-ui`, captura `reports/secondary-dagger-ui/paired-command.png`. CI ejecuta la variante simple y la pareja.

Quedan en etapas siguientes contraataques, estados/efectos, IA y maniobras. El wizard solicitado después se implementará a continuación del lote de combate; especificación recibida: `C:/Users/Hell-/Downloads/TNL_BalanceLab_Wizard_Creacion_Personajes_Codex_v1.md`.
