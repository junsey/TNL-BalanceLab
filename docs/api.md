# API privada

El servidor exige cookie de sesión para recursos compartidos. Las escrituras requieren que el origen coincida con `APP_ORIGIN`. Las solicitudes JSON se limitan a 1 MiB.

| Método | Ruta | Uso |
| --- | --- | --- |
| POST | `/api/session` | Formulario con alias y contraseña compartida. |
| DELETE | `/api/session` | Cerrar sesión. |
| GET | `/api/records?kind=…` | Revisiones vigentes. La página admite cursor `after`. |
| GET | `/api/records?kind=…&id=…` | Historial de un registro. Admite cursor `before`. |
| POST | `/api/records` | Guardar documento con `kind`, `expected` y `data`. Enviar `id` al actualizar y revisión esperada 0 al crear. |
| GET | `/api/checkpoints` | Últimos lotes compartidos. |
| GET | `/api/checkpoints?job=…` | Estado, plan y checkpoints, con cursor `after`. |
| POST | `/api/checkpoints` | Confirmar un bloque con `job`, `plan`, `chunk` y `canceled`. |

La edición concurrente responde 409 con la revisión vigente. Restaurar equivale a guardar los datos históricos con la revisión vigente como base. Para importar un estudio, enviar las `dependencies` verificadas en el ZIP junto con el documento y, si existe, su `origin`. El servidor asigna nuevos IDs y conserva procedencia en la misma transacción.

El checkpoint se confirma en orden por índice. Retransmitir el mismo bloque conserva los conteos. Un bloque incompatible o fuera de orden devuelve 409. Al cerrar la pestaña, las partidas futuras dejan de ejecutarse y se pueden consultar los bloques confirmados.
