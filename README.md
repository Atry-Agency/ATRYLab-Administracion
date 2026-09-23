# ATRY LAB Administración

Panel privado y separado de la web pública de ATRY LAB.

## Funciones actuales

- Solicitudes manuales con cliente, cantidades, plazos, cotización, seña, notas y referencias privadas.
- Seguimiento por estados e historial de cambios.
- Clientes con datos de contacto e historial comercial.
- Fichas de producción con material, color, peso, tiempo, máquina y reimpresiones.
- Catálogo administrable con mínimos, orden, visibilidad y destacados.
- Configuración de canales de contacto y datos del taller.

## Panel publicado

GitHub Pages publica la carpeta `docs` de la rama `main`. Antes de subir cambios,
`npm run build` regenera esa carpeta. La interfaz es pública, pero los datos y
las operaciones permanecen protegidos por Supabase Auth y las políticas RLS.

## Desarrollo local

1. Instalar dependencias con `npm install`.
2. Copiar `.env.example` como `.env.local`.
3. Completar únicamente la URL y la clave **publishable** de Supabase.
4. Ejecutar `npm run dev`.

Sin variables de entorno, el panel abre automáticamente una vista de demostración local. Esa vista no envía ni guarda datos reales.

## Preparar Supabase

1. Crear un proyecto Supabase para ATRY LAB.
2. Ejecutar `supabase/schema.sql` desde SQL Editor.
3. Crear el primer usuario desde Authentication.
4. Copiar el UUID del usuario y ejecutar la instrucción comentada al final de `schema.sql` para asignarle el rol `owner`.
5. El esquema crea automáticamente el bucket privado `request-attachments` y sus políticas de acceso.

## Cotizaciones

Después del esquema inicial, ejecutá una vez `supabase/quotes.sql` en el SQL Editor de Supabase. La migración es aditiva: crea cotizaciones versionadas, artículos normalizados, numeración atómica, políticas RLS y el bucket privado `quote-pdfs`. No modifica la información original recibida desde la web.

## Seguridad

- Nunca copiar `service_role`, contraseñas de base de datos ni secretos a `.env.local`.
- El navegador utiliza exclusivamente la clave publishable con RLS activo.
- No publicar `.env.local` ni este panel dentro del repositorio público de la web.
- Activar MFA para todas las cuentas administrativas antes de producción.
