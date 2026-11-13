# Despliegue privado

## Local

Con Node 24 y npm, ejecutar `npm ci` y `npm run dev`. El servidor local escucha en `127.0.0.1:3000`. Sin configuración de sesión, el modo de desarrollo habilita el tablero y el editor local. La API compartida requiere sesión y base de datos.

Para probar el flujo privado con un PostgreSQL propio, copiar los nombres de variables de `.env.example` a `apps/web/.env.local` y aplicar las migraciones con `npm run migrate`. Configurar `APP_ORIGIN` con el origen exacto del navegador, por ejemplo `http://127.0.0.1:3000`.

## Vercel

1. Crear o enlazar el proyecto privado en Vercel al repositorio. Elegir Next.js, Node.js 24, `apps/web` como directorio raíz e incluir los archivos compartidos fuera del directorio raíz. Configurar el comando de build en `next build --webpack`. [Configuración de monorepos en Vercel](https://vercel.com/docs/monorepos).
2. Configurar `DATABASE_URL`, `SESSION_SECRET`, `SHARED_PASSWORD_HASH` y `APP_ORIGIN` por ambiente. Usar una base o rama de PostgreSQL separada para preview. `SESSION_SECRET` debe tener al menos 32 bytes. Generar el hash con `node scripts/hash-password.ts`, pasando la contraseña por entrada estándar desde un gestor de secretos.
3. Aplicar las migraciones en la base elegida antes de promover el despliegue.
4. Abrir dos sesiones con alias distintos. Verificar lectura compartida, escritura con revisión esperada y persistencia de un lote. Confirmar que las rutas privadas denieguen lecturas y escrituras sin sesión.
5. Para revertir código, promover el último despliegue compatible con las migraciones aplicadas. Conservar las revisiones y los checkpoints de producción.

`npm run test:web` prueba el build de producción local con una base efímera. En CI utiliza PostgreSQL 17 y lanza dos ediciones concurrentes. La prueba local efímera verifica el conflicto con dos sesiones mediante escrituras secuenciales.
