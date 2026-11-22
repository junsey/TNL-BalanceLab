# Lote adicional 4.4 — Riposta y Contraataque Ágil

Base publicada: 421d6f89c55c17be970b3f864edd2f86739c60df. Se integran los dos Talentos distintos del diseño aprobado. Nivel I exige ¼ o crítico; Nivel II exige ½ o mejor. Riposta solo usa Parar y admite daño residual; Contraataque Ágil solo usa Esquivar. Bloquear no genera grados ni activa Riposta.

La defensa se paga normalmente. Si el actor conserva Vigor suficiente y un ataque legal, se abre una reacción opcional: ejecutar el Talento o pasar. Aceptar paga el coste normal del arma, sin consumir Mayor/Menor ni reembolsar defensa. La IA usa su política de reacciones existente y registra un motivo específico. No se añaden límites por ronda: un contraataque puede defenderse y disparar otro; el Vigor y los resultados de las defensas limitan la cadena.

El estado, las continuaciones de Dos Dagas y las oportunidades originales esperan a esas decisiones. El replay valida ataques reactivos fuera de la fase propia sin exigir que el atacante haya gastado su Mayor. Las parejas prepagadas conservan su blanco y se revalidan al reanudarse. Logs separados para ventana/decisión de Talento, sin contarla como oportunidad de alcance.

Ambos modos enfocan al actor que reacciona. El menú común muestra ejecutar/pasar y el coste del ataque. El editor de equipo permite ensayar cada Talento y nivel, con procedencia experimental explícita; no altera arquetipos ni adquisición canónica. La clasificación de Dones y las Facultades existentes permanecen intactas.

Motor `0.11.0-counter-talents`; versiones previas conservadas para consulta. Pruebas específicas: umbrales I/II, Riposta parcial, pasar sin coste, falta de Vigor tras defensa, Bloqueo sin activación, cadenas de tres o más contraataques con recursos no negativos, replay de cada paso y guardado del equipo de ensayo. Suite total: 126 pruebas. Tipos, lint, formato, build y web. `test:counter-ui` carga un historial válido y ejecuta la elección en navegador; captura revisada en `reports/counter-ui/riposte-choice.png`.

Continúan IA y los efectos/maniobras restantes. Se solicitó cierre de integración de Hemorragia e inyección especializada y del efecto concreto de Desmembramiento; no se inventan sus parámetros mientras se avanza con bloques independientes. Después se ejecutará WIZ-01–WIZ-06 del documento nuevo de creación.
