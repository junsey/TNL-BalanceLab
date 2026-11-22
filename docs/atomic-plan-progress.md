# Avance del plan atómico

El usuario autorizó continuar todas las etapas en orden, publicando cada una en main y avisando para QA al completar el documento. No se requiere una pausa de aprobación entre etapas.

| Etapa | Estado | Base / publicación | Evidencia |
| --- | --- | --- | --- |
| Lote previo | Publicado | ade2f70 | docs/immediate-fixes.md |
| 1.1 Dados y reproducción | Publicado | 71f2d75 | docs/rng-audit-1.1.md; 65 tests, 16 contrastes |
| 1.2 Fuente de cálculo | Publicada | c3eaf60 | docs/core-calculation-1.2.md; 71 tests + web, tipos, lint y build |
| 1.3 Fichas y migración | Publicada | 64debb7 | docs/combat-documents-1.3.md; 76 tests + web, tipos, lint y build |
| 1.4 Cadena de combate | Publicada | e181215 | docs/core-combat-1.4.md; 97 tests + web, tipos, lint y build |
| 1.5 Integración | Publicada | 355bc47 | docs/integration-1.5.md; 101 tests, integración, web y capturas; CI correcto |
| 2.1 Fauna menor | Publicada | 79dbf8d | docs/minor-fauna-2.1.md; 103 tests, 6000 fichas y encuentros 1/5/10/15; CI correcto |
| 2.2 Equipo por PJ | Publicada | 700a3aa | docs/equipment-2.2.md; 106 tests, roundtrip, web y capturas; CI correcto |
| 2.3 Escalado y balance | Publicada | 095a82f | docs/scaling-2.3.md; 108 tests, 36000 ensayos, 72 extremos reproducidos y captura; CI correcto |
| 2.4 Combate compartido | Publicada | 8019acf; CI correcto | docs/shared-combat-2.4.md; comparativas, responsive, defensa y replay |
| 3.1 Catálogo de creación | Publicada | be54ca2; CI correcto | docs/creation-catalog-3.1.md; 110 pruebas, tipos, lint, formato, build y web |
| 3.2 Generación determinista | Publicada | aa58523; CI correcto | docs/creation-engine-3.2.md; 113 pruebas, 10000 semillas y repeticiones, tipos, lint, build y web |
| 3.3 Pantalla de creación | Publicada | 49680ea; CI correcto | docs/creation-ui-3.3.md; seis recorridos e2e y 113 pruebas |
| 3.4 Equipo y persistencia | Publicada | 0e0c890; CI correcto | docs/creation-persistence-3.4.md; 115 tests, archivos, sesión, DB y e2e |
| 4.1 Contrato de capacidades | Publicada | 0f2abba | docs/combat-additions-4.1.md; 116 pruebas |
| 4.2 Daga secundaria | Publicada | 6f6507f; CI correcto | docs/combat-additions-4.2.md; 118 pruebas y navegador |
| 4.3 Dos Dagas | Publicada | 421d6f8 | docs/combat-additions-4.3.md; 121 pruebas y navegador |
| 4.4 Contraataques | Publicada | 012f641 | docs/combat-additions-4.4.md; pruebas y navegador |
| IA-01 Contrato de directivas | Publicada | a77c85b | docs/ai-01-contract.md; 128 pruebas |
| IA-02 Decisor base | Publicada en este commit | base a77c85b | docs/ai-02-base.md; 130 pruebas |
| IA-03–IA-06, estados y maniobras | En curso / pendientes de reglas por bloque | — | docs/queued-combat-additions.md |
| Wizard WIZ-01–WIZ-06 | En cola después del combate | — | Especificación v1 del usuario, 21/11 |
