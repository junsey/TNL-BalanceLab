# Personaje activo e inventario

Solicitud directa del 22/11: un menú de perfil con personaje activo, atributos, objetos, equipo y selección entre personajes creados; usarlo por defecto en la aplicación y conservar continuidad.

La cabecera incluye «Mi personaje». El selector reúne los presets humanos, personajes conservados en la sesión, la ficha confirmada actual y los creados de la biblioteca compartida cuando está disponible. Las copias con versiones/reglas no compatibles no se convierten silenciosamente. Un personaje creado requiere elegir explícitamente su perfil de ensayo si todavía no lo tenía: la Resistencia canónica permanece `null`. Los atributos se consultan sin regenerar ni alterar la creación.

Equipar/desequipar opera sobre los objetos existentes, conserva armas guardadas, armadura y durabilidad, y respeta combinaciones de manos válidas. No agrega objetos del catálogo ni repone consumibles. La selección y el equipo se conservan por personaje en este navegador; la biblioteca original no se sobrescribe. Los personajes conservados sólo en sesión mantienen esa condición para sus archivos; elegir un perfil activo conserva una copia de juego local.

Laboratorio usa el perfil al preparar un encuentro nuevo. Los cambios de equipo del menú no alteran un combate ya iniciado; los consumos/Salud del combate vinculado actualizan el perfil sin revertir una elección de equipo para el próximo encuentro. Los replays y las fichas de otro personaje no actualizan ese perfil. Coliseo recibe el mismo personaje predeterminado; su nuevo flujo por pasos y sincronización de carrera se completan en la siguiente etapa.

Verificación: pruebas de inventario, durabilidad, rechazo de perfil inválido, deduplicación, preparación de copia sin alterar creación y actualización de Salud conservando equipo pendiente; prueba en Chrome a 390/1440 con cambio de activo, sesión creada, recuperación, equipo y axe sin violaciones. Además, 155 pruebas, typecheck, lint, formato, build, web y seis recorridos de creación. Capturas en `reports/player-profile-ui`. No requiere migración de base de datos.
