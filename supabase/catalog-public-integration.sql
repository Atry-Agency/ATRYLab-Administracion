-- Conexión segura entre ATRY LAB pública y el panel de administración.
-- Ejecutar una sola vez en el SQL Editor del proyecto Supabase.

alter table public.catalog_items
  add column if not exists publication_status text not null default 'draft'
    check (publication_status in ('draft','upcoming','published')),
  add column if not exists image_path text,
  add column if not exists image_alt text,
  add column if not exists badge text;

create index if not exists catalog_items_public_idx
  on public.catalog_items (active, publication_status, sort_order);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'catalog-images',
  'catalog-images',
  true,
  5242880,
  array['image/png','image/jpeg','image/webp','image/avif']
)
on conflict (id) do update
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "staff upload catalog images" on storage.objects;
create policy "staff upload catalog images" on storage.objects
for insert to authenticated
with check (bucket_id = 'catalog-images' and public.is_manager());

drop policy if exists "staff update catalog images" on storage.objects;
create policy "staff update catalog images" on storage.objects
for update to authenticated
using (bucket_id = 'catalog-images' and public.is_manager())
with check (bucket_id = 'catalog-images' and public.is_manager());

drop policy if exists "staff delete catalog images" on storage.objects;
create policy "staff delete catalog images" on storage.objects
for delete to authenticated
using (bucket_id = 'catalog-images' and public.is_manager());

create or replace function public.get_public_catalog()
returns table (
  id text,
  name text,
  category text,
  description text,
  min_quantity integer,
  featured boolean,
  sort_order integer,
  publication_status text,
  image_path text,
  image_alt text,
  badge text,
  settings jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id, c.name, c.category, c.description, c.min_quantity, c.featured,
    c.sort_order, c.publication_status, c.image_path, c.image_alt, c.badge, c.settings
  from public.catalog_items c
  where c.active = true
    and c.publication_status in ('published','upcoming')
  order by c.sort_order, c.name;
$$;

revoke all on function public.get_public_catalog() from public;
grant execute on function public.get_public_catalog() to anon, authenticated;

create or replace function public.submit_public_request(
  p_customer_name text,
  p_customer_company text default null,
  p_customer_phone text default null,
  p_customer_email text default null,
  p_title text default 'Solicitud desde la web',
  p_category text default null,
  p_quantity integer default 1,
  p_deadline text default null,
  p_notes text default null,
  p_configuration jsonb default '{}'::jsonb
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id text;
begin
  if length(trim(coalesce(p_customer_name,''))) < 2
     or length(p_customer_name) > 120 then
    raise exception 'Nombre inválido';
  end if;
  if p_quantity < 1 or p_quantity > 100000 then
    raise exception 'Cantidad inválida';
  end if;
  if length(coalesce(p_customer_company,'')) > 160
     or length(coalesce(p_customer_phone,'')) > 40
     or length(coalesce(p_customer_email,'')) > 160
     or length(coalesce(p_title,'')) > 180
     or length(coalesce(p_category,'')) > 160
     or length(coalesce(p_deadline,'')) > 120
     or length(coalesce(p_notes,'')) > 6000
     or pg_column_size(coalesce(p_configuration,'{}'::jsonb)) > 50000 then
    raise exception 'La solicitud supera el tamaño permitido';
  end if;

  v_id := 'ATRY-' || to_char(now(), 'YYYY') || '-' ||
          upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.requests (
    id, customer_name, customer_company, customer_phone, customer_email,
    title, category, quantity, deadline, status, priority, notes,
    configuration, source
  ) values (
    v_id,
    trim(p_customer_name),
    nullif(trim(coalesce(p_customer_company,'')), ''),
    nullif(trim(coalesce(p_customer_phone,'')), ''),
    nullif(trim(coalesce(p_customer_email,'')), ''),
    left(coalesce(nullif(trim(p_title),''),'Solicitud desde la web'),180),
    nullif(trim(coalesce(p_category,'')), ''),
    p_quantity,
    nullif(trim(coalesce(p_deadline,'')), ''),
    'new',
    'normal',
    nullif(trim(coalesce(p_notes,'')), ''),
    coalesce(p_configuration,'{}'::jsonb),
    'web'
  );

  return v_id;
end;
$$;

revoke all on function public.submit_public_request(text,text,text,text,text,text,integer,text,text,jsonb) from public;
grant execute on function public.submit_public_request(text,text,text,text,text,text,integer,text,text,jsonb) to anon, authenticated;

insert into public.catalog_items (
  id,name,category,description,min_quantity,active,featured,sort_order,publication_status,settings
) values
  ('llaveros','Llaveros personalizados','Tu marca','Tu logo, nombre o diseño convertido en un objeto que acompaña todos los días.',10,true,true,10,'published',jsonb_build_object('icon','ph-key')),
  ('porta-qr','Porta QR','Tu marca · Negocios','Un soporte limpio y estable para compartir menú, redes, WiFi o medios de pago.',1,true,true,20,'published',jsonb_build_object('icon','ph-qr-code')),
  ('logos-3d','Logos 3D','Tu marca','Tu identidad convertida en una pieza física para escritorio, pared, mostrador o stand.',1,true,false,30,'upcoming',jsonb_build_object('icon','ph-cube-focus')),
  ('posavasos','Posavasos','Tu marca','Series personalizadas para regalos, uso interno o presencia de marca en cada mesa.',1,true,false,40,'upcoming',jsonb_build_object('icon','ph-coffee')),
  ('carteleria','Cartelería','Tu marca','Carteles, nombres y mensajes con forma, color y medida pensados para tu espacio.',1,true,false,50,'upcoming',jsonb_build_object('icon','ph-signpost')),
  ('exhibidores','Exhibidores','Tu marca · Negocios','Soportes de producto y piezas de mostrador para ordenar, destacar y vender mejor.',1,true,false,60,'upcoming',jsonb_build_object('icon','ph-presentation-chart')),
  ('regalos-corporativos','Regalos corporativos','Tu marca','Objetos útiles y memorables desarrollados especialmente para clientes o equipos.',1,true,false,70,'upcoming',jsonb_build_object('icon','ph-gift')),
  ('cumpleanos','Cumpleaños','Eventos','Piezas temáticas y personalizadas para que la celebración tenga una identidad propia.',1,true,false,80,'upcoming',jsonb_build_object('icon','ph-cake')),
  ('casamientos','Casamientos','Eventos','Detalles de mesa, recuerdos y señalización diseñados para acompañar la celebración.',1,true,false,90,'upcoming',jsonb_build_object('icon','ph-heart')),
  ('quince','15 años','Eventos','Nombres, centros y recuerdos personalizados para una noche realmente única.',1,true,false,100,'upcoming',jsonb_build_object('icon','ph-confetti')),
  ('souvenirs','Souvenirs','Eventos','Recuerdos personalizados que conectan con la temática, la fecha y las personas.',10,true,true,110,'published',jsonb_build_object('icon','ph-gift')),
  ('toppers','Toppers','Eventos','Diseños para tortas y mesas dulces con nombres, edades, formas o frases.',1,true,false,120,'upcoming',jsonb_build_object('icon','ph-star')),
  ('centros-mesa','Centros de mesa','Eventos · Casa','Composiciones personalizadas que organizan y visten el centro de cada mesa.',1,true,false,130,'upcoming',jsonb_build_object('icon','ph-flower')),
  ('medallas','Medallas','Eventos · Trofeos','Medallas con identidad propia para competencias, reconocimientos y encuentros.',1,true,false,140,'upcoming',jsonb_build_object('icon','ph-medal')),
  ('figuras-referencia','Figuras desde referencia','Figuras','Transformamos una imagen o concepto en una figura pensada especialmente para vos.',1,true,false,150,'upcoming',jsonb_build_object('icon','ph-image-square')),
  ('miniaturas','Miniaturas','Figuras','Objetos, escenas o personajes resueltos a escala con atención en cada detalle.',1,true,false,160,'upcoming',jsonb_build_object('icon','ph-person-simple-run')),
  ('mascotas','Mascotas personalizadas','Figuras','Una pieza inspirada en tu mascota a partir de fotos y referencias.',1,true,false,170,'upcoming',jsonb_build_object('icon','ph-paw-print')),
  ('diseno-personalizado','Diseño personalizado','Figuras','Cuando no existe una base, desarrollamos el objeto desde cero junto a vos.',1,true,false,180,'upcoming',jsonb_build_object('icon','ph-pencil-ruler')),
  ('regalos-unicos','Regalos únicos','Figuras · Casa','Una idea con historia convertida en un regalo que no se consigue en otro lado.',1,true,false,190,'upcoming',jsonb_build_object('icon','ph-hand-heart')),
  ('jarrones','Jarrones','Casa','Formas contemporáneas para sumar textura, color y personalidad a un ambiente.',1,true,true,200,'published',jsonb_build_object('icon','ph-vase')),
  ('decoracion','Decoración','Casa','Objetos visuales en distintos tamaños y colores para completar tus espacios.',1,true,false,210,'upcoming',jsonb_build_object('icon','ph-lamp-pendant')),
  ('organizadores','Organizadores','Casa','Soluciones simples que ordenan escritorio, cocina, baño o cualquier rincón.',1,true,false,220,'upcoming',jsonb_build_object('icon','ph-tray')),
  ('cocina','Utilidades de cocina','Casa','Accesorios prácticos adaptados al uso cotidiano y a tu espacio disponible.',1,true,false,230,'upcoming',jsonb_build_object('icon','ph-cooking-pot')),
  ('bano','Utilidades de baño','Casa','Organizadores y soportes funcionales con una estética limpia y durable.',1,true,false,240,'upcoming',jsonb_build_object('icon','ph-drop')),
  ('utilidades','Utilidades del hogar','Casa','Piezas que resuelven pequeñas necesidades de forma prolija y personalizada.',1,true,false,250,'upcoming',jsonb_build_object('icon','ph-house-line')),
  ('numeros-mesa','Números de mesa','Negocios','Numeración resistente, clara y coherente con la identidad de tu local o evento.',1,true,false,260,'upcoming',jsonb_build_object('icon','ph-number-circle-one')),
  ('porta-menu','Porta menú','Negocios','Soportes de mesa funcionales y personalizados para cartas, promociones o servicios.',1,true,false,270,'upcoming',jsonb_build_object('icon','ph-book-open-text')),
  ('logos-locales','Logos para locales','Negocios','Tu marca presente en mostradores, paredes, vidrieras y espacios de atención.',1,true,false,280,'upcoming',jsonb_build_object('icon','ph-storefront')),
  ('senalizacion','Señalización','Negocios','Indicadores y mensajes claros, producidos a medida para ordenar la experiencia.',1,true,false,290,'upcoming',jsonb_build_object('icon','ph-signpost')),
  ('trofeos','Trofeos','Trofeos & premios','Reconocimientos con una silueta propia para competencias, equipos y marcas.',1,true,true,300,'published',jsonb_build_object('icon','ph-trophy')),
  ('premios-empresariales','Premios empresariales','Trofeos & premios','Piezas sobrias para reconocer hitos, trayectorias y logros de equipo.',1,true,false,310,'upcoming',jsonb_build_object('icon','ph-buildings')),
  ('placas','Placas','Trofeos & premios','Placas personalizadas con texto, identidad y soporte adaptado a la ocasión.',1,true,false,320,'upcoming',jsonb_build_object('icon','ph-plaque')),
  ('reconocimientos','Reconocimientos','Trofeos & premios','Objetos con significado para agradecer, distinguir o celebrar un momento.',1,true,false,330,'upcoming',jsonb_build_object('icon','ph-seal-check')),
  ('prototipos','Prototipos','Prototipos & piezas','Convertimos una idea o archivo en una primera pieza para validar forma y uso.',1,true,false,340,'upcoming',jsonb_build_object('icon','ph-cube-transparent')),
  ('piezas-personalizadas','Piezas personalizadas','Prototipos & piezas','Fabricamos la pieza que necesitás cuando una solución estándar no alcanza.',1,true,false,350,'upcoming',jsonb_build_object('icon','ph-cube')),
  ('soportes','Soportes','Prototipos & piezas','Soportes específicos para ordenar, fijar o integrar objetos y dispositivos.',1,true,false,360,'upcoming',jsonb_build_object('icon','ph-brackets-angle')),
  ('adaptadores','Adaptadores','Prototipos & piezas','Uniones y adaptaciones hechas según medidas, encastres y necesidades concretas.',1,true,false,370,'upcoming',jsonb_build_object('icon','ph-plugs-connected')),
  ('maquetas','Maquetas','Prototipos & piezas','Volúmenes y modelos físicos para presentar, estudiar o comunicar un proyecto.',1,true,false,380,'upcoming',jsonb_build_object('icon','ph-buildings')),
  ('llaveros-qr-nfc','Llaveros con QR o NFC','Personalizados','Llaveros con QR o NFC desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,390,'upcoming',jsonb_build_object('icon','ph-qr-code')),
  ('nombres-letras','Nombres y letras 3D','Personalizados','Nombres y letras 3D desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,400,'upcoming',jsonb_build_object('icon','ph-text-aa')),
  ('pines-insignias','Pines e insignias','Personalizados','Pines e insignias desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,410,'upcoming',jsonb_build_object('icon','ph-medal')),
  ('identificadores','Identificadores personalizados','Personalizados','Identificadores personalizados desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,420,'upcoming',jsonb_build_object('icon','ph-identification-card')),
  ('tags','Tags para llaves, mochilas o mascotas','Personalizados','Tags para llaves, mochilas o mascotas desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,430,'upcoming',jsonb_build_object('icon','ph-tag')),
  ('fichas-tokens','Fichas y tokens personalizados','Personalizados','Fichas y tokens personalizados desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,440,'upcoming',jsonb_build_object('icon','ph-coins')),
  ('miniaturas-marca','Miniaturas de logos o productos','Personalizados','Miniaturas de logos o productos desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,450,'upcoming',jsonb_build_object('icon','ph-cube')),
  ('porta-qr-nfc','Porta QR con NFC','Negocios','Porta QR con NFC desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,460,'upcoming',jsonb_build_object('icon','ph-wifi-high')),
  ('porta-precios','Porta precios','Negocios','Porta precios desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,470,'upcoming',jsonb_build_object('icon','ph-currency-dollar')),
  ('porta-tarjetas','Porta tarjetas','Negocios','Porta tarjetas desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,480,'upcoming',jsonb_build_object('icon','ph-credit-card')),
  ('soporte-celular-tarjetas','Soporte para celular y tarjetas','Negocios','Soporte para celular y tarjetas desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,490,'upcoming',jsonb_build_object('icon','ph-device-mobile')),
  ('risers','Elevadores y risers','Negocios','Elevadores y risers desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,500,'upcoming',jsonb_build_object('icon','ph-stairs')),
  ('displays-mostrador','Displays de mostrador','Negocios','Displays de mostrador desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,510,'upcoming',jsonb_build_object('icon','ph-presentation')),
  ('nombres-escritorio','Nombres de escritorio','Negocios','Nombres de escritorio desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,520,'upcoming',jsonb_build_object('icon','ph-desk')),
  ('tags-activos','Tags para activos, cables o lockers','Negocios','Tags para activos, cables o lockers desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,530,'upcoming',jsonb_build_object('icon','ph-tag')),
  ('fichas-fidelidad','Fichas de fidelidad','Negocios','Fichas de fidelidad desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,540,'upcoming',jsonb_build_object('icon','ph-ticket')),
  ('senales-mesa','Señales de mesa o mostrador','Negocios','Señales de mesa o mostrador desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,550,'upcoming',jsonb_build_object('icon','ph-signpost')),
  ('organizadores-oficina','Organizadores de oficina','Negocios','Organizadores de oficina desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,560,'upcoming',jsonb_build_object('icon','ph-tray')),
  ('carteles-bienvenida','Carteles de bienvenida','Eventos','Carteles de bienvenida desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,570,'upcoming',jsonb_build_object('icon','ph-confetti')),
  ('iniciales-decorativas','Nombres e iniciales decorativas','Eventos','Nombres e iniciales decorativas desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,580,'upcoming',jsonb_build_object('icon','ph-text-aa')),
  ('identificadores-invitados','Identificadores para invitados','Eventos','Identificadores para invitados desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,590,'upcoming',jsonb_build_object('icon','ph-identification-badge')),
  ('acreditaciones','Acreditaciones','Eventos','Acreditaciones desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,600,'upcoming',jsonb_build_object('icon','ph-identification-card')),
  ('tokens-eventos','Tokens para juegos o actividades','Eventos','Tokens para juegos o actividades desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,610,'upcoming',jsonb_build_object('icon','ph-game-controller')),
  ('trofeos-modulares','Trofeos modulares','Eventos','Trofeos modulares desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,620,'upcoming',jsonb_build_object('icon','ph-trophy')),
  ('recuerdos-graduacion','Recuerdos de graduación','Eventos','Recuerdos de graduación desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,630,'upcoming',jsonb_build_object('icon','ph-graduation-cap')),
  ('soporte-celular','Soportes para celular','Hogar','Soportes para celular desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,640,'upcoming',jsonb_build_object('icon','ph-device-mobile')),
  ('organizador-cables','Organizadores de cables','Hogar','Organizadores de cables desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,650,'upcoming',jsonb_build_object('icon','ph-plugs-connected')),
  ('portalapices','Portalápices','Hogar','Portalápices desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,660,'upcoming',jsonb_build_object('icon','ph-pencil')),
  ('soporte-auriculares','Soportes para auriculares','Hogar','Soportes para auriculares desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,670,'upcoming',jsonb_build_object('icon','ph-headphones')),
  ('soporte-controles','Soportes para controles','Hogar','Soportes para controles desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,680,'upcoming',jsonb_build_object('icon','ph-game-controller')),
  ('soporte-tablet','Soportes para tablet','Hogar','Soportes para tablet desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,690,'upcoming',jsonb_build_object('icon','ph-device-tablet')),
  ('separadores-cajon','Separadores para cajones','Hogar','Separadores para cajones desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,700,'upcoming',jsonb_build_object('icon','ph-grid-four')),
  ('organizador-maquillaje','Organizadores para maquillaje','Hogar','Organizadores para maquillaje desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,710,'upcoming',jsonb_build_object('icon','ph-sparkle')),
  ('porta-llaves','Porta llaves','Hogar','Porta llaves desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,720,'upcoming',jsonb_build_object('icon','ph-key')),
  ('vaciabolsillos','Bandejas vaciabolsillos','Hogar','Bandejas vaciabolsillos desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,730,'upcoming',jsonb_build_object('icon','ph-tray')),
  ('macetas-autorriego','Macetas de autorriego','Hogar','Macetas de autorriego desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,740,'upcoming',jsonb_build_object('icon','ph-plant')),
  ('etiquetas-plantas','Etiquetas para plantas','Hogar','Etiquetas para plantas desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,750,'upcoming',jsonb_build_object('icon','ph-leaf')),
  ('organizador-cafe','Organizadores de cápsulas de café','Hogar','Organizadores de cápsulas de café desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,760,'upcoming',jsonb_build_object('icon','ph-coffee')),
  ('accesorios-mate','Accesorios para mate','Hogar','Accesorios para mate desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,770,'upcoming',jsonb_build_object('icon','ph-cup')),
  ('marcadores-libros','Marcadores de libros','Hogar','Marcadores de libros desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,780,'upcoming',jsonb_build_object('icon','ph-bookmark')),
  ('soportes-libros','Soportes para libros','Hogar','Soportes para libros desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,790,'upcoming',jsonb_build_object('icon','ph-books')),
  ('animales-articulados','Animales articulados','Figuras','Animales articulados desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,800,'upcoming',jsonb_build_object('icon','ph-paw-print')),
  ('personajes-atry','Personajes originales de ATRY','Figuras','Personajes originales de ATRY desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,810,'upcoming',jsonb_build_object('icon','ph-smiley')),
  ('coleccionables','Coleccionables','Figuras','Coleccionables desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,820,'upcoming',jsonb_build_object('icon','ph-cube')),
  ('esculturas-geometricas','Esculturas geométricas','Figuras','Esculturas geométricas desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,830,'upcoming',jsonb_build_object('icon','ph-polygon')),
  ('fidgets','Fidgets','Figuras','Fidgets desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,840,'upcoming',jsonb_build_object('icon','ph-spinner')),
  ('puzzles','Puzzles y juegos de lógica','Figuras','Puzzles y juegos de lógica desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,850,'upcoming',jsonb_build_object('icon','ph-puzzle-piece')),
  ('adornos-estacionales','Adornos estacionales','Figuras','Adornos estacionales desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,860,'upcoming',jsonb_build_object('icon','ph-star')),
  ('litofanias','Litofanías personalizadas','Figuras','Litofanías personalizadas desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,870,'upcoming',jsonb_build_object('icon','ph-image')),
  ('repuestos','Repuestos no críticos','A medida','Repuestos no críticos desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,880,'upcoming',jsonb_build_object('icon','ph-wrench')),
  ('carcasas','Carcasas','A medida','Carcasas desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,890,'upcoming',jsonb_build_object('icon','ph-cube')),
  ('tapas-perillas','Tapas y perillas','A medida','Tapas y perillas desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,900,'upcoming',jsonb_build_object('icon','ph-toggle-right')),
  ('guias-montaje','Guías de montaje','A medida','Guías de montaje desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,910,'upcoming',jsonb_build_object('icon','ph-ruler')),
  ('jigs','Jigs y herramientas auxiliares','A medida','Jigs y herramientas auxiliares desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,920,'upcoming',jsonb_build_object('icon','ph-hammer')),
  ('plantillas','Plantillas','A medida','Plantillas desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,930,'upcoming',jsonb_build_object('icon','ph-selection')),
  ('impresion-archivo','Impresión desde archivo del cliente','A medida','Impresión desde archivo del cliente desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,940,'upcoming',jsonb_build_object('icon','ph-file-arrow-up')),
  ('modelado-3d','Servicio de modelado 3D','A medida','Servicio de modelado 3D desarrollado a medida, con materiales y terminación definidos según el uso.',1,true,false,950,'upcoming',jsonb_build_object('icon','ph-cube-transparent'))
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  description = coalesce(public.catalog_items.description, excluded.description),
  min_quantity = excluded.min_quantity,
  featured = excluded.featured,
  sort_order = excluded.sort_order,
  settings = public.catalog_items.settings || excluded.settings,
  updated_at = now();

update public.catalog_items
set active = true,
    publication_status = case
      when id in ('llaveros','porta-qr','souvenirs','trofeos','jarrones') then 'published'
      when publication_status = 'draft' then 'upcoming'
      else publication_status
    end,
    badge = case
      when id in ('llaveros','porta-qr','souvenirs','trofeos','jarrones') then null
      else coalesce(badge,'Próximamente')
    end,
    updated_at = now();

