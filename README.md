# ATRY LAB Administración

Panel privado y separado de la web pública de ATRY LAB.

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

## Seguridad

- Nunca copiar `service_role`, contraseñas de base de datos ni secretos a `.env.local`.
- El navegador utiliza exclusivamente la clave publishable con RLS activo.
- No publicar `.env.local` ni este panel dentro del repositorio público de la web.
- Activar MFA para todas las cuentas administrativas antes de producción.
