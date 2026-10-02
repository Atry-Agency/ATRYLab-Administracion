# sync-finance-sheet

Función protegida que crea, actualiza, anula o elimina la fila vinculada de `VENTAS`.

Secretos necesarios en Supabase Edge Functions:

- `GOOGLE_SERVICE_ACCOUNT_JSON`: JSON completo de una cuenta de servicio que tenga acceso de editor a la planilla.
- `GOOGLE_SHEET_ID`: respaldo opcional; normalmente se toma de `app_settings.cost_parameters`.

La cuenta de servicio sólo necesita `https://www.googleapis.com/auth/spreadsheets`. No expongas el JSON en Vite, GitHub Pages ni variables `VITE_*`.
