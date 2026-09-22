import "./styles.css";
import { supabase, isSupabaseConfigured } from "./supabase.js";
import { demoRequests, demoCatalog, statusMeta } from "./demo-data.js";

const asset = path => `${import.meta.env.BASE_URL || "/"}${path.replace(/^\//, "")}`;
const logo = asset("recursos/atry-isotipo.png");
const state = {
  page: "dashboard", requests: [], catalog: [], customers: [], jobs: [], attachments: [], settings: {}, profiles: [],
  selected: null, query: "", status: "all", catalogQuery: "", catalogStatus: "all", catalogSelection: new Set(), catalogSelecting: false, loading: true, demo: !isSupabaseConfigured,
  user: null, sidebarOpen: false
};

const nav = [
  ["dashboard", "ph-squares-four", "Resumen"], ["requests", "ph-clipboard-text", "Solicitudes"],
  ["production", "ph-printer", "Producción"], ["deliveries", "ph-truck", "Entregas"], ["catalog", "ph-cube", "Catálogo"],
  ["customers", "ph-users", "Clientes"], ["settings", "ph-sliders-horizontal", "Configuración"]
];
const pageNames = Object.fromEntries(nav.map(([id,, label]) => [id, label]));
const esc = value => String(value ?? "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
const money = value => value !== null && value !== undefined && value !== "" ? new Intl.NumberFormat("es-UY", {style:"currency", currency:"UYU", maximumFractionDigits:0}).format(value) : "A cotizar";
const shortDate = value => value ? new Intl.DateTimeFormat("es-UY", {day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit"}).format(new Date(value)) : "A definir";
const whatsappNumber = value => { const digits=String(value||"").replace(/\D/g,""); if(!digits)return ""; if(digits.startsWith("598"))return digits; return `598${digits.replace(/^0/,"")}`; };
const checked = value => value ? "checked" : "";
const setting = key => state.settings[key]?.value || {};
const statusPill = id => { const meta = statusMeta[id] || {label:id, tone:"gray"}; return `<span class="status ${meta.tone}"><i></i>${esc(meta.label)}</span>`; };
const emptyState = (icon, title, copy) => `<div class="empty"><i class="ph ${icon}"></i><h3>${title}</h3><p>${copy}</p></div>`;
const publicationMeta = {
  published:{label:"Publicado", icon:"ph-check-circle", tone:"published"},
  upcoming:{label:"Próximamente", icon:"ph-clock-countdown", tone:"upcoming"},
  draft:{label:"Borrador", icon:"ph-pencil-simple", tone:"draft"}
};
const publicationState = item => item.publication_status || (item.active ? "published" : "draft");
const deliveryMeta = {
  pending:{label:"Por coordinar",tone:"gray",icon:"ph-clock"}, preparing:{label:"Preparando",tone:"amber",icon:"ph-package"},
  ready:{label:"Listo para enviar",tone:"blue",icon:"ph-package"}, dispatched:{label:"En camino",tone:"violet",icon:"ph-truck"}, delivered:{label:"Entregado",tone:"green",icon:"ph-check-circle"}
};
const deliveryOf = request => ({method:"coordinate",status:"pending",department:"",city:"",address:"",notes:"",...(request?.configuration?.delivery || {})});
const deliveryMethodLabel = method => ({shipping:"Envío",pickup:"Retiro",coordinate:"A coordinar"}[method] || "A coordinar");
const iconOptions = [
  ["ph-key","Llavero"],["ph-qr-code","Código QR"],["ph-trophy","Trofeo"],["ph-gift","Regalo"],
  ["ph-flower","Decoración"],["ph-paw-print","Mascota"],["ph-cube","Pieza 3D"],["ph-house","Hogar"],
  ["ph-storefront","Negocio"],["ph-confetti","Evento"],["ph-shapes","Figura"],["ph-ruler","A medida"]
];
const badgeOptions = [["","Sin etiqueta"],["Nuevo","Nuevo"],["Popular","Popular"],["Recomendado","Recomendado"],["Edición limitada","Edición limitada"],["Para regalar","Para regalar"],["Empresas","Empresas"]];
const slugify = value => String(value || "producto").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") || "producto";
const catalogImageUrl = path => path ? supabase.storage.from("catalog-images").getPublicUrl(path).data.publicUrl : "";
const imageFrame = item => ({
  x: Math.min(100, Math.max(0, Number(item?.settings?.image_position_x ?? 50))),
  y: Math.min(100, Math.max(0, Number(item?.settings?.image_position_y ?? 50))),
  zoom: Math.min(2.4, Math.max(.7, Number(item?.settings?.image_zoom ?? 1))),
  fit: item?.settings?.image_fit === "contain" ? "contain" : "cover",
  background: /^#[0-9a-f]{6}$/i.test(item?.settings?.image_background || "") ? item.settings.image_background : "#d9dcdf"
});
const imageFrameStyle = item => { const frame = imageFrame(item); return `--image-x:${frame.x}%;--image-y:${frame.y}%;--image-zoom:${frame.zoom};--image-fit:${frame.fit};--image-bg:${frame.background}`; };

async function bootstrap(){
  if(state.demo){ state.requests = [...demoRequests]; state.catalog = [...demoCatalog]; state.loading = false; render(); return; }
  const {data:{session}} = await supabase.auth.getSession();
  if(!session){ state.loading = false; renderLogin(); return; }
  state.user = session.user;
  await loadData();
  supabase.auth.onAuthStateChange((_event, next) => { if(!next) renderLogin(); });
}

async function loadData(){
  state.loading = true; render();
  const [requests, catalog, customers, jobs, attachments, settings, profiles] = await Promise.all([
    supabase.from("requests").select("*").order("created_at", {ascending:false}),
    supabase.from("catalog_items").select("*").order("sort_order", {ascending:true}),
    supabase.from("customers").select("*").order("updated_at", {ascending:false}),
    supabase.from("production_jobs").select("*").order("created_at", {ascending:false}),
    supabase.from("request_attachments").select("*").order("created_at", {ascending:false}),
    supabase.from("app_settings").select("*"),
    supabase.from("profiles").select("*").order("created_at", {ascending:true})
  ]);
  const failure = [requests, catalog, customers, jobs, attachments, settings, profiles].find(result => result.error);
  if(failure){ state.loading = false; render(); toast(`No se pudieron cargar los datos: ${failure.error.message}`, "error"); return; }
  state.requests = requests.data || []; state.catalog = catalog.data || []; state.customers = customers.data || [];
  state.jobs = jobs.data || []; state.attachments = attachments.data || []; state.settings = Object.fromEntries((settings.data || []).map(row => [row.key, row]));
  state.profiles = profiles.data || []; state.loading = false; render();
}

function renderLogin(){
  document.querySelector("#app").innerHTML = `<main class="login-shell">
    <section class="login-brand"><div class="brand brand-large"><span><img src="${logo}" alt="Isotipo ATRY"></span><span>ATRY <b>LAB</b></span></div><div><small>ADMINISTRACIÓN</small><h1>Todo el taller,<br><em>en un solo lugar.</em></h1><p>Solicitudes, producción, clientes y catálogo con una operación clara y segura.</p></div><footer>Acceso exclusivo para el equipo ATRY.</footer></section>
    <section class="login-panel"><form id="login-form"><div class="login-logo"><img src="${logo}" alt="ATRY"></div><small>BIENVENIDO</small><h2>Ingresá al panel</h2><p>Usá el correo autorizado de ATRY LAB.</p><label>Correo<input name="email" type="email" autocomplete="email" required placeholder="equipo@atrylab.com"></label><label>Contraseña<input name="password" type="password" autocomplete="current-password" required placeholder="••••••••••••"></label><button class="primary" type="submit">Ingresar <i class="ph ph-arrow-right"></i></button><span id="login-message"></span></form></section>
  </main>`;
  document.querySelector("#login-form").addEventListener("submit", signIn);
}

async function signIn(event){
  event.preventDefault(); const form = new FormData(event.currentTarget); const button = event.currentTarget.querySelector("button");
  button.disabled = true; button.innerHTML = 'Verificando <i class="ph ph-circle-notch spin"></i>';
  const {data, error} = await supabase.auth.signInWithPassword({email:form.get("email"), password:form.get("password")});
  if(error){ document.querySelector("#login-message").textContent = "No pudimos validar esos datos."; button.disabled = false; button.innerHTML = 'Ingresar <i class="ph ph-arrow-right"></i>'; return; }
  state.user = data.user; await loadData();
}

function shell(content){
  const title = pageNames[state.page] || "Panel";
  return `<div class="app-shell ${state.sidebarOpen ? "menu-open" : ""}">
    <aside class="sidebar"><button class="brand brand-panel" data-page="dashboard"><span><img src="${logo}" alt="ATRY"></span><span>ATRY <b>LAB</b><small>ADMIN</small></span></button><nav>${nav.map(([id, icon, label]) => `<button data-page="${id}" class="${state.page === id ? "active" : ""}"><i class="ph ${icon}"></i><span>${label}</span>${id === "requests" ? `<b>${state.requests.filter(r => r.status === "new").length}</b>` : ""}</button>`).join("")}</nav><div class="sidebar-foot"><span class="avatar brand-avatar"><img src="${logo}" alt="ATRY"></span><div><strong>${esc(state.profiles.find(p => p.id === state.user?.id)?.full_name || "Administrador ATRY")}</strong><small>${state.demo ? "Vista de demostración" : esc(state.user?.email)}</small></div><button data-logout title="Cerrar sesión"><i class="ph ph-sign-out"></i></button></div></aside>
    <main class="main"><header><button class="menu-toggle" id="menu-toggle"><i class="ph ph-list"></i></button><div><small>ATRY LAB / OPERACIONES</small><h1>${title}</h1></div><div class="top-actions"><button class="search-trigger" id="global-search"><i class="ph ph-magnifying-glass"></i><span>Buscar</span><kbd>⌘ K</kbd></button><span class="live"><i></i>${state.demo ? "Demo" : "En línea"}</span><button class="header-logout" data-logout title="Cerrar sesión" aria-label="Cerrar sesión"><i class="ph ph-sign-out"></i><span>Salir</span></button></div></header>${state.demo ? `<div class="demo-banner"><i class="ph ph-flask"></i><span><strong>Vista de demostración</strong> — los cambios se muestran en pantalla y no se guardan.</span></div>` : ""}<div class="content">${content}</div></main>
    <div class="drawer-backdrop"></div><div id="modal-root"></div><div id="toast-root"></div>
  </div>`;
}

function render(){
  if(state.loading){ document.querySelector("#app").innerHTML = `<div class="loading"><img src="${logo}" alt="ATRY"><span></span><p>Preparando tu espacio de trabajo…</p></div>`; return; }
  const views = {dashboard:dashboardView, requests:requestsView, production:productionView, deliveries:deliveriesView, catalog:catalogView, customers:customersView, settings:settingsView};
  document.querySelector("#app").innerHTML = shell((views[state.page] || dashboardView)()); bindGlobal();
}

function dashboardView(){
  const newCount = state.requests.filter(r => r.status === "new").length;
  const active = state.requests.filter(r => ["approved", "printing"].includes(r.status)).length;
  const pending = state.requests.filter(r => ["reviewing", "quoted"].includes(r.status)).length;
  const total = state.requests.filter(r => r.status !== "cancelled").reduce((sum, r) => sum + Number(r.amount || 0), 0);
  return `<section class="welcome"><div><small>${new Intl.DateTimeFormat("es-UY", {weekday:"long", day:"numeric", month:"long"}).format(new Date()).toUpperCase()}</small><h2>Buen día, ATRY.</h2><p>Esto es lo que necesita atención hoy.</p></div><button class="primary" data-action="new-request"><i class="ph ph-plus"></i>Nueva solicitud</button></section>
  <section class="metrics"><article class="metric accent"><div><span>SOLICITUDES NUEVAS</span><i class="ph ph-inbox"></i></div><strong>${newCount}</strong><p>Esperando primera respuesta</p><small><i class="ph ph-arrow-up-right"></i> Atender ahora</small></article><article class="metric"><div><span>EN PRODUCCIÓN</span><i class="ph ph-printer"></i></div><strong>${active}</strong><p>Trabajos activos</p><small>${state.jobs.length} fichas de taller</small></article><article class="metric"><div><span>COTIZACIONES</span><i class="ph ph-file-text"></i></div><strong>${pending}</strong><p>Pendientes de decisión</p><small>Seguimiento comercial</small></article><article class="metric"><div><span>VALOR REGISTRADO</span><i class="ph ph-currency-dollar"></i></div><strong class="money">${money(total)}</strong><p>Solicitudes no canceladas</p><small>Importes cargados</small></article></section>
  <section class="dashboard-grid"><article class="panel activity"><div class="panel-head"><div><small>ACTIVIDAD RECIENTE</small><h3>Últimas solicitudes</h3></div><button data-page="requests">Ver todas <i class="ph ph-arrow-right"></i></button></div><div class="request-list">${state.requests.length ? state.requests.slice(0,5).map(requestRow).join("") : emptyState("ph-inbox", "Todavía no hay solicitudes", "Creá la primera manualmente o conectá la web cuando el panel esté listo.")}</div></article>
  <article class="panel focus"><div class="panel-head"><div><small>PRÓXIMOS PASOS</small><h3>Para resolver hoy</h3></div><span>${pending + newCount}</span></div><div class="focus-list"><button data-page="requests"><i class="ph ph-chat-circle-text"></i><span><strong>Responder solicitudes nuevas</strong><small>Que nadie quede esperando</small></span><b>${newCount}</b></button><button data-page="production"><i class="ph ph-clock-countdown"></i><span><strong>Revisar producción</strong><small>Materiales, tiempos y entregas</small></span><b>${active}</b></button><button data-page="catalog"><i class="ph ph-eye"></i><span><strong>Revisar catálogo</strong><small>${state.catalog.filter(x => x.active).length} productos visibles</small></span><i class="ph ph-caret-right"></i></button></div></article></section>`;
}

function requestRow(r){ return `<button class="request-row" data-request="${esc(r.id)}"><span class="request-avatar">${esc(r.customer_name).slice(0,1)}</span><span class="request-copy"><strong>${esc(r.title)}</strong><small>${esc(r.customer_name)}${r.customer_company ? ` · ${esc(r.customer_company)}` : ""}</small></span>${statusPill(r.status)}<span class="request-time">${shortDate(r.created_at)}</span><i class="ph ph-caret-right"></i></button>`; }

function requestsView(){
  const filtered = state.requests.filter(r => (state.status === "all" || r.status === state.status) && `${r.id} ${r.customer_name} ${r.customer_company} ${r.title}`.toLowerCase().includes(state.query.toLowerCase()));
  const filters = [["all","Todas","all"], ...Object.entries(statusMeta).map(([id,x]) => [id,x.label,x.tone])];
  return `<section class="section-head"><div><h2>Solicitudes</h2><p>Seguimiento desde el primer contacto hasta la entrega.</p></div><button class="primary" data-action="new-request"><i class="ph ph-plus"></i>Crear manualmente</button></section><section class="toolbar"><label><i class="ph ph-magnifying-glass"></i><input id="request-search" value="${esc(state.query)}" placeholder="Buscar por cliente, proyecto o código"></label><div class="filters request-filters">${filters.map(([id,label,tone]) => `<button data-status="${id}" class="${tone} ${state.status === id ? "active" : ""}">${id === "all" ? `<i class="ph ph-squares-four"></i>` : "<i></i>"}${label}</button>`).join("")}</div></section><section class="table-panel"><div class="table-head"><span>Solicitud</span><span>Cliente</span><span>Estado</span><span>Entrega</span><span>Valor</span><span></span></div>${filtered.length ? filtered.map(r => `<button class="table-row" data-request="${esc(r.id)}"><span><b>${esc(r.id)}</b><strong>${esc(r.title)}</strong><small>${esc(r.category || "Sin categoría")}</small></span><span><strong>${esc(r.customer_name)}</strong><small>${esc(r.customer_company || r.customer_phone || r.customer_email || "Sin contacto")}</small></span>${statusPill(r.status)}<span>${esc(r.deadline || "A definir")}</span><span>${money(r.amount)}</span><i class="ph ph-caret-right"></i></button>`).join("") : emptyState("ph-magnifying-glass", "No encontramos solicitudes", "Probá con otro término o creá una nueva.")}</section>`;
}

function productionView(){
  const columns = [["approved","Por preparar"],["printing","Fabricando"],["ready","Listo para entregar"]];
  return `<section class="section-head"><div><h2>Producción</h2><p>Materiales, tiempos de máquina y entregas en una sola vista.</p></div><button class="primary" data-action="new-job"><i class="ph ph-plus"></i>Agregar trabajo</button></section><section class="kanban">${columns.map(([status,title]) => { const rows = state.requests.filter(r => r.status === status); return `<article><header><span>${title}</span><b>${rows.length}</b></header><div>${rows.length ? rows.map(r => { const job = state.jobs.find(j => j.request_id === r.id); return `<button class="job-card" data-request="${esc(r.id)}"><small>${esc(r.id)}</small><strong>${esc(r.title)}</strong><p>${esc(r.customer_name)} · ${r.quantity} un.</p>${job ? `<div class="job-meta"><span>${esc(job.material || "Material a definir")}</span><span>${esc(job.color || "Color a definir")}</span><span>${job.print_minutes_estimated ? `${Math.round(job.print_minutes_estimated / 60)} h` : "Tiempo a definir"}</span></div>` : `<div class="job-warning"><i class="ph ph-warning-circle"></i> Falta ficha de producción</div>`}<footer><span><i class="ph ph-calendar-blank"></i>${esc(r.deadline || "A definir")}</span>${r.priority === "high" ? "<em>Prioridad</em>" : ""}</footer></button>`; }).join("") : '<div class="column-empty">Sin trabajos acá</div>'}</div></article>`; }).join("")}</section>`;
}

function deliveriesView(){
  const rows=state.requests.filter(request=>!["cancelled"].includes(request.status)).map(request=>({request,delivery:deliveryOf(request)}));
  const shipping=rows.filter(row=>row.delivery.method==="shipping");
  const pending=rows.filter(row=>row.delivery.status!=="delivered").length;
  return `<section class="section-head"><div><h2>Entregas</h2><p>Ubicaciones, modalidad y seguimiento de cada pedido.</p></div><button class="primary" data-page="requests"><i class="ph ph-clipboard-text"></i>Ver solicitudes</button></section>
  <section class="delivery-summary"><article><i class="ph ph-package"></i><span><strong>${pending}</strong><small>Pendientes</small></span></article><article><i class="ph ph-truck"></i><span><strong>${shipping.length}</strong><small>Con envío</small></span></article><article><i class="ph ph-storefront"></i><span><strong>${rows.filter(row=>row.delivery.method==="pickup").length}</strong><small>Para retirar</small></span></article></section>
  <section class="delivery-list">${rows.length?rows.map(({request,delivery})=>{const meta=deliveryMeta[delivery.status]||deliveryMeta.pending;const place=delivery.method==="shipping"?[delivery.address,delivery.city,delivery.department].filter(Boolean).join(", "):deliveryMethodLabel(delivery.method);return `<article><span class="delivery-icon ${meta.tone}"><i class="ph ${meta.icon}"></i></span><div><small>${esc(request.id)} · ${esc(deliveryMethodLabel(delivery.method))}</small><h3>${esc(request.title)}</h3><p>${esc(request.customer_name)} · ${esc(place||"Ubicación pendiente")}</p>${delivery.notes?`<em>${esc(delivery.notes)}</em>`:""}</div><label><span>Estado de entrega</span><select data-delivery-status="${esc(request.id)}" class="delivery-status ${meta.tone}">${Object.entries(deliveryMeta).map(([id,item])=>`<option value="${id}" ${delivery.status===id?"selected":""}>${item.label}</option>`).join("")}</select></label><button class="icon-btn" data-request="${esc(request.id)}" title="Ver solicitud"><i class="ph ph-arrow-right"></i></button></article>`;}).join(""):emptyState("ph-truck","Todavía no hay entregas","Las solicitudes nuevas aparecerán acá con su modalidad y ubicación.")}</section>`;
}

function catalogView(){
  const counts = Object.fromEntries(Object.keys(publicationMeta).map(status => [status, state.catalog.filter(item => publicationState(item) === status).length]));
  const term = state.catalogQuery.trim().toLowerCase();
  const filtered = state.catalog.filter(item => (state.catalogStatus === "all" || publicationState(item) === state.catalogStatus) && `${item.name} ${item.category} ${item.badge || ""} ${item.description || ""}`.toLowerCase().includes(term));
  return `<section class="section-head"><div><h2>Catálogo</h2><p>Decidí qué está listo, qué querés anticipar y qué todavía queda guardado.</p></div><div class="section-actions"><button class="secondary ${state.catalogSelecting?"active":""}" data-catalog-select-mode><i class="ph ph-check-square"></i>${state.catalogSelecting?"Cancelar selección":"Seleccionar"}</button><button class="primary" data-action="new-product"><i class="ph ph-plus"></i>Nuevo producto</button></div></section>
  <section class="catalog-summary"><button data-catalog-status="all" class="all ${state.catalogStatus === "all" ? "active" : ""}"><i class="ph ph-squares-four"></i><span><strong>${state.catalog.length}</strong><small>Todos</small></span></button>${Object.entries(publicationMeta).map(([id,meta]) => `<button data-catalog-status="${id}" class="${meta.tone} ${state.catalogStatus === id ? "active" : ""}"><i class="ph ${meta.icon}"></i><span><strong>${counts[id]}</strong><small>${meta.label}</small></span></button>`).join("")}</section>
  <section class="catalog-search"><label><i class="ph ph-magnifying-glass"></i><input id="catalog-search" value="${esc(state.catalogQuery)}" placeholder="Buscar por nombre, categoría o etiqueta"></label>${state.catalogQuery || state.catalogStatus !== "all" ? `<button data-catalog-reset><i class="ph ph-x"></i> Limpiar</button>` : ""}<span>${filtered.length} ${filtered.length === 1 ? "producto" : "productos"}</span></section>
  ${state.catalogSelecting?`<section class="catalog-bulk"><button data-catalog-select-all><i class="ph ph-checks"></i>${filtered.every(item=>state.catalogSelection.has(item.id))&&filtered.length?"Quitar visibles":"Seleccionar visibles"}</button><span><b>${state.catalogSelection.size}</b> seleccionados</span><label>Cambiar a <select id="catalog-bulk-status"><option value="published">Publicado</option><option value="upcoming">Próximamente</option><option value="draft">Borrador</option></select></label><button class="primary" data-catalog-apply ${state.catalogSelection.size?"":"disabled"}>Aplicar cambio</button></section>`:""}
  <section class="catalog-admin editorial ${state.catalogSelecting?"selecting":""}">${filtered.length ? filtered.map(item => { const status = publicationState(item); const meta = publicationMeta[status]; const image = catalogImageUrl(item.image_path); const selected=state.catalogSelection.has(item.id); return `<article class="${selected?"selected":""}">${state.catalogSelecting?`<button class="catalog-select ${selected?"active":""}" data-catalog-select="${esc(item.id)}" aria-label="${selected?"Quitar":"Seleccionar"} ${esc(item.name)}"><i class="ph ${selected?"ph-check":"ph-circle"}"></i></button>`:""}
    <div class="catalog-thumb ${image ? "has-image" : ""}">${image ? `<img src="${esc(image)}" alt="" style="${imageFrameStyle(item)}">` : `<img src="${logo}" alt=""><small>Imagen pendiente</small>`}</div>
    <div class="catalog-copy"><small>${esc(item.category)}${item.badge ? ` · ${esc(item.badge)}` : ""}</small><h3>${esc(item.name)}</h3><p>${esc(item.description || "Sin descripción pública")}</p><p>Pedido mínimo: <b>${item.min_quantity} ${item.min_quantity === 1 ? "unidad" : "unidades"}</b></p></div>
    <span class="publication ${meta.tone}"><i class="ph ${meta.icon}"></i>${meta.label}</span>
    <button class="icon-btn" data-edit-product="${esc(item.id)}" title="Editar producto"><i class="ph ph-pencil-simple"></i></button>
  </article>`; }).join("") : emptyState("ph-magnifying-glass", "No encontramos productos", "Probá con otra búsqueda o limpiá los filtros.")}</section>`;
}

function customerStats(customer){
  const rows = state.requests.filter(r => r.customer_id === customer.id || (customer.phone && r.customer_phone === customer.phone) || (customer.email && r.customer_email === customer.email));
  return {count:rows.length, value:rows.reduce((sum,r) => sum + Number(r.amount || 0), 0)};
}
function customersView(){
  return `<section class="section-head"><div><h2>Clientes</h2><p>Datos de contacto, historial y contexto comercial.</p></div><button class="primary" data-action="new-customer"><i class="ph ph-user-plus"></i>Nuevo cliente</button></section><section class="customer-grid">${state.customers.length ? state.customers.map(customer => { const stats = customerStats(customer); return `<article><span class="customer-avatar">${esc(customer.full_name).slice(0,1)}</span><div><h3>${esc(customer.full_name)}</h3><p>${esc(customer.company || "Cliente particular")}</p><small>${esc(customer.phone || customer.email || "Sin contacto")}</small></div><dl><div><dt>Solicitudes</dt><dd>${stats.count}</dd></div><div><dt>Valor</dt><dd>${money(stats.value)}</dd></div></dl><button class="icon-btn" data-edit-customer="${esc(customer.id)}" title="Editar cliente"><i class="ph ph-pencil-simple"></i></button></article>`; }).join("") : emptyState("ph-users", "Todavía no hay clientes", "Creá el primero o se agregarán cuando conectemos la web.")}</section>`;
}

function settingsView(){
  const channels = setting("contact_channels"); const business = setting("business_profile");
  return `<section class="section-head"><div><h2>Configuración</h2><p>Datos operativos, contacto y acceso del equipo.</p></div></section><section class="settings-grid"><article class="panel"><span class="setting-icon"><i class="ph ph-whatsapp-logo"></i></span><div><h3>Canales de contacto</h3><p>${esc(channels.whatsapp || "WhatsApp sin configurar")} · ${esc(channels.email || "Correo sin configurar")}</p></div><button data-action="contact-settings">Administrar</button></article><article class="panel"><span class="setting-icon"><i class="ph ph-buildings"></i></span><div><h3>Datos del taller</h3><p>${esc(business.city || "Montevideo")}${business.pickup_address ? ` · ${esc(business.pickup_address)}` : ""}</p></div><button data-action="business-settings">Administrar</button></article><article class="panel"><span class="setting-icon"><i class="ph ph-users-three"></i></span><div><h3>Equipo y permisos</h3><p>${state.profiles.length} ${state.profiles.length === 1 ? "persona autorizada" : "personas autorizadas"}.</p></div><button data-action="team-settings">Ver equipo</button></article><article class="panel"><span class="setting-icon"><i class="ph ph-shield-check"></i></span><div><h3>Seguridad</h3><p>Supabase Auth, RLS y archivos privados activos.</p></div><button data-action="security-info">Revisar</button></article></section>`;
}

function openModal({title, eyebrow="ATRY LAB", description="", content, submitLabel="Guardar cambios", onSubmit, wide=false, modalClass=""}){
  closeModal(); const root = document.querySelector("#modal-root"); const pageScroll = window.scrollY;
  document.body.dataset.modalScroll = String(pageScroll); document.body.style.top = `-${pageScroll}px`; document.body.classList.add("modal-open");
  root.innerHTML = `<div class="modal-backdrop"><section class="form-modal ${wide ? "wide" : ""} ${esc(modalClass)}" role="dialog" aria-modal="true"><header><div><small>${esc(eyebrow)}</small><h2>${esc(title)}</h2>${description ? `<p>${esc(description)}</p>` : ""}</div><button type="button" class="icon-btn modal-close" aria-label="Cerrar"><i class="ph ph-x"></i></button></header><form><div class="form-body">${content}</div><footer><button type="button" class="secondary modal-cancel">Cancelar</button><button type="submit" class="primary">${esc(submitLabel)} <i class="ph ph-check"></i></button></footer></form></section></div>`;
  root.querySelector(".modal-close").onclick = closeModal; root.querySelector(".modal-cancel").onclick = closeModal;
  root.querySelector(".modal-backdrop").onclick = event => { if(event.target.classList.contains("modal-backdrop")) closeModal(); };
  root.querySelector("form").onsubmit = async event => { event.preventDefault(); const button = event.currentTarget.querySelector('[type="submit"]'); button.disabled = true; const original = button.innerHTML; button.innerHTML = 'Guardando <i class="ph ph-circle-notch spin"></i>'; try { await onSubmit(new FormData(event.currentTarget), event.currentTarget); } catch(error){ toast(error.message || "No se pudo guardar", "error"); button.disabled = false; button.innerHTML = original; } };
  const modalBody = root.querySelector(".form-body"); if(modalBody) modalBody.scrollTop = 0;
  if(modalClass.includes("product-modal")) setTimeout(() => root.querySelector(".modal-close")?.focus({preventScroll:true}), 20);
  else setTimeout(() => root.querySelector("input:not([type='hidden']),select,textarea")?.focus({preventScroll:true}), 20);
}
function closeModal(){ const root = document.querySelector("#modal-root"); if(root) root.innerHTML = ""; if(document.body.classList.contains("modal-open")){ const pageScroll=Number(document.body.dataset.modalScroll||0); document.body.classList.remove("modal-open"); document.body.style.top=""; delete document.body.dataset.modalScroll; window.scrollTo(0,pageScroll); } }
const field = (label, name, value="", options="") => `<label>${label}<input name="${name}" value="${esc(value)}" ${options}></label>`;
const textarea = (label, name, value="", placeholder="") => `<label class="span-2">${label}<textarea name="${name}" placeholder="${esc(placeholder)}">${esc(value)}</textarea></label>`;
const select = (label, name, options, value="", extra="") => `<label>${label}<select name="${name}" ${extra}>${options.map(([id,text]) => `<option value="${esc(id)}" ${String(id) === String(value) ? "selected" : ""}>${esc(text)}</option>`).join("")}</select></label>`;

function requestModal(existing=null){
  const customerOptions = [["", "Cargar datos manualmente"], ...state.customers.map(c => [c.id, `${c.full_name}${c.company ? ` · ${c.company}` : ""}`])];
  const delivery=deliveryOf(existing);
  openModal({title:existing ? "Editar solicitud" : "Nueva solicitud", eyebrow:"GESTIÓN COMERCIAL", description:"Registrá lo necesario para cotizar, producir y entregar sin perder contexto.", wide:true, content:`<div class="form-section"><h3><span>1</span>Cliente y contacto</h3><div class="form-grid">${select("Cliente guardado", "customer_id", customerOptions, existing?.customer_id || "", 'id="customer-picker"')}${field("Nombre completo *", "customer_name", existing?.customer_name, "required")}${field("Marca, empresa o evento", "customer_company", existing?.customer_company)}${field("WhatsApp", "customer_phone", existing?.customer_phone, 'inputmode="tel" placeholder="099 000 000"')}${field("Correo", "customer_email", existing?.customer_email, 'type="email" placeholder="nombre@correo.com"')}</div></div><div class="form-section"><h3><span>2</span>Proyecto</h3><div class="form-grid">${field("Nombre del proyecto *", "title", existing?.title, 'required placeholder="Ej. Llaveros para el equipo"')}${select("Categoría", "category", [["Tu marca","Tu marca"],["Negocios","Negocios"],["Eventos","Eventos"],["Hogar","Hogar"],["Figuras","Figuras"],["A medida","A medida"]], existing?.category || "A medida")}${field("Cantidad *", "quantity", existing?.quantity || 1, 'type="number" min="1" required')}${field("Entrega o plazo", "deadline", existing?.deadline, 'placeholder="Ej. 30 set / Sin apuro"')}${select("Estado", "status", Object.entries(statusMeta).map(([id,x]) => [id,x.label]), existing?.status || "new")}${select("Prioridad", "priority", [["normal","Normal"],["high","Alta"]], existing?.priority || "normal")}${field("Precio cotizado (UYU)", "amount", existing?.amount ?? "", 'type="number" min="0" step="1"')}${field("Seña recibida (UYU)", "deposit", existing?.deposit ?? "", 'type="number" min="0" step="1"')}${textarea("Descripción, materiales, colores y referencias", "notes", existing?.notes, "Todo lo que el taller necesita saber")}<label class="span-2 file-field">Archivos de referencia <input type="file" name="references" multiple accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf,.stl,.3mf"><small>Imágenes, PDF, STL o 3MF · hasta 25 MB por archivo</small></label></div></div><div class="form-section"><h3><span>3</span>Entrega</h3><div class="form-grid">${select("Modalidad", "delivery_method", [["shipping","Envío"],["pickup","Retiro coordinado"],["coordinate","A coordinar"]], delivery.method)}${select("Estado de entrega", "delivery_status", Object.entries(deliveryMeta).map(([id,item])=>[id,item.label]), delivery.status)}${field("Departamento", "delivery_department", delivery.department, 'placeholder="Ej. Montevideo"')}${field("Localidad o barrio", "delivery_city", delivery.city, 'placeholder="Ej. Pocitos"')}${field("Dirección", "delivery_address", delivery.address, 'placeholder="Calle, número y apartamento"')}${field("Indicaciones", "delivery_notes", delivery.notes, 'placeholder="Horario, portería o referencia"')}</div></div>`, submitLabel:existing ? "Actualizar solicitud" : "Crear solicitud", onSubmit:async data => {
    const files = data.getAll("references").filter(file => file instanceof File && file.size); data.delete("references");
    const deliveryPayload={method:data.get("delivery_method"),status:data.get("delivery_status"),department:data.get("delivery_department")||null,city:data.get("delivery_city")||null,address:data.get("delivery_address")||null,notes:data.get("delivery_notes")||null}; ["delivery_method","delivery_status","delivery_department","delivery_city","delivery_address","delivery_notes"].forEach(key=>data.delete(key));
    const payload = Object.fromEntries(data.entries()); payload.quantity = Number(payload.quantity); payload.amount = payload.amount ? Number(payload.amount) : null; payload.deposit = payload.deposit ? Number(payload.deposit) : null; payload.customer_id = payload.customer_id || null; payload.configuration={...(existing?.configuration||{}),delivery:deliveryPayload}; payload.source = existing?.source || "manual"; payload.updated_at = new Date().toISOString();
    if(existing){ const {error} = await supabase.from("requests").update(payload).eq("id", existing.id); if(error) throw error; }
    else { payload.id = `ATRY-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`; const {error} = await supabase.from("requests").insert(payload); if(error) throw error; }
    if(files.length) await uploadReferences(existing?.id || payload.id, files);
    closeModal(); await loadData(); toast(existing ? "Solicitud actualizada" : "Solicitud creada");
  }});
  const picker = document.querySelector("#customer-picker");
  picker?.addEventListener("change", () => { const customer = state.customers.find(c => c.id === picker.value); if(!customer) return; const form = picker.form; [["customer_name","full_name"],["customer_company","company"],["customer_phone","phone"],["customer_email","email"]].forEach(([input,key]) => { form.elements[input].value = customer[key] || ""; }); });
}

async function uploadReferences(requestId, files){
  for(const file of files){
    if(file.size > 25 * 1024 * 1024) throw new Error(`${file.name} supera el límite de 25 MB.`);
    const safeName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-");
    const path = `${requestId}/${crypto.randomUUID()}-${safeName}`;
    const {error:uploadError} = await supabase.storage.from("request-attachments").upload(path, file, {contentType:file.type || "application/octet-stream"});
    if(uploadError) throw uploadError;
    const {error:rowError} = await supabase.from("request_attachments").insert({request_id:requestId, storage_path:path, original_name:file.name, mime_type:file.type || null, size_bytes:file.size});
    if(rowError) throw rowError;
  }
}

function productModal(item=null){
  const currentStatus = item ? publicationState(item) : "draft"; const image = catalogImageUrl(item?.image_path); const frame = imageFrame(item);
  const currentIcon = item?.settings?.icon || "ph-cube";
  const nextOrder = state.catalog.length ? Math.max(...state.catalog.map(entry => Number(entry.sort_order || 0))) + 10 : 10;
  openModal({title:item ? "Editar producto" : "Nuevo producto", eyebrow:"CATÁLOGO", description:"Completá la información y ajustá la imagen exactamente como querés que aparezca en el catálogo.", wide:true, modalClass:"product-modal", content:`<div class="product-editor">
    <section class="product-editor-image">
      <div class="preview-caption"><div><span>ENCUADRE DEL CATÁLOGO</span><small>Arrastrá la imagen para acomodarla</small></div><div class="preview-device" aria-label="Formato de vista previa"><button type="button" class="active" data-preview-ratio="desktop"><i class="ph ph-desktop"></i> PC</button><button type="button" data-preview-ratio="mobile"><i class="ph ph-device-mobile"></i> Celular</button></div></div>
      <div class="crop-stage"><div class="editor-preview ${image ? "has-image" : ""}" id="product-image-preview" tabindex="0" aria-label="Editor de encuadre. Arrastrá para mover y usá la rueda o pellizcá para ampliar.">${image ? `<img src="${esc(image)}" alt="" draggable="false" style="${imageFrameStyle(item)}">` : `<img src="${logo}" alt="ATRY" draggable="false"><span>Subí una imagen para comenzar</span>`}<span class="crop-grid" aria-hidden="true"></span><span class="crop-corner top-left" aria-hidden="true"></span><span class="crop-corner top-right" aria-hidden="true"></span><span class="crop-corner bottom-left" aria-hidden="true"></span><span class="crop-corner bottom-right" aria-hidden="true"></span><span class="crop-hint"><i class="ph ph-hand-grabbing"></i> Arrastrá para mover</span></div></div>
      <div class="crop-toolbar" aria-label="Herramientas de encuadre"><button type="button" data-crop-action="zoom-out" aria-label="Alejar"><i class="ph ph-minus"></i></button><label><i class="ph ph-magnifying-glass-minus"></i><input type="range" name="image_zoom" min=".7" max="2.4" step="0.01" value="${frame.zoom}" aria-label="Zoom de imagen"><b data-frame-value="zoom">${Math.round(frame.zoom * 100)}%</b></label><button type="button" data-crop-action="zoom-in" aria-label="Acercar"><i class="ph ph-plus"></i></button><span></span><button type="button" class="frame-reset" aria-label="Centrar imagen"><i class="ph ph-crosshair"></i><em>Centrar</em></button></div>
      <div class="crop-options"><div class="fit-choice" role="group" aria-label="Modo de ajuste"><button type="button" data-fit="cover" class="${frame.fit === "cover" ? "active" : ""}"><i class="ph ph-crop"></i> Recortar tarjeta</button><button type="button" data-fit="contain" class="${frame.fit === "contain" ? "active" : ""}"><i class="ph ph-arrows-out-simple"></i> Ver completa</button></div><label class="background-choice"><span>Fondo</span><input type="color" name="image_background" value="${frame.background}" aria-label="Color de fondo"></label></div>
      <input type="hidden" name="image_position_x" value="${frame.x}"><input type="hidden" name="image_position_y" value="${frame.y}"><input type="hidden" name="image_fit" value="${frame.fit}">
      <p class="preview-help"><i class="ph ph-info"></i><span>El marco muestra el recorte exacto de la tarjeta. Al abrir el producto, la foto se verá completa.</span></p>
      <label class="file-field compact image-upload"><input type="file" name="image" accept="image/png,image/jpeg,image/webp,image/avif"><span class="upload-icon"><i class="ph ph-image-square"></i></span><span><strong>${image ? "Cambiar imagen" : "Subir imagen"}</strong><small>JPG, PNG, WebP o AVIF · máximo 5 MB</small></span><i class="ph ph-upload-simple"></i></label>${item?.image_path ? `<label class="check-field remove-image"><input type="checkbox" name="remove_image"><span>Quitar imagen actual</span></label>` : ""}
    </section>
    <div class="form-grid product-fields">${field("Nombre del producto *", "name", item?.name, 'required placeholder="Ej. Llaveros personalizados"')}${select("Categoría", "category", [["Tu marca","Tu marca"],["Personalizados","Personalizados"],["Negocios","Negocios"],["Eventos","Eventos"],["Hogar","Hogar"],["Casa","Casa"],["Figuras","Figuras"],["A medida","A medida"],["Trofeos & premios","Trofeos & premios"],["Prototipos & piezas","Prototipos & piezas"]], item?.category || "A medida")}${select("Disponibilidad", "publication_status", [["draft","Borrador · solo lo ves vos"],["upcoming","Próximamente · visible con aviso"],["published","Publicado · disponible para pedir"]], currentStatus, `class="publication-status-select ${currentStatus}"`)}${field("Pedido mínimo", "min_quantity", item?.min_quantity || 1, 'type="number" min="1" required')}${select("Etiqueta", "badge", badgeOptions, item?.badge || "")}${field("Texto alternativo de la foto", "image_alt", item?.image_alt || item?.name || "", 'placeholder="Ej. Llavero celeste y blanco"')}<fieldset class="icon-picker span-2"><legend>Icono del producto</legend><p>Elegí el que mejor representa el artículo.</p><div>${iconOptions.map(([icon,label]) => `<button type="button" data-product-icon="${icon}" class="${currentIcon === icon ? "active" : ""}" title="${label}"><i class="ph ${icon}"></i><span>${label}</span></button>`).join("")}</div><input type="hidden" name="icon" value="${currentIcon}"></fieldset>${textarea("Descripción para la web", "description", item?.description, "Contá qué es y para qué sirve en una frase clara")}<label class="check-field span-2 featured-choice"><input type="checkbox" name="featured" ${checked(item?.featured)}><span><strong>Mostrar entre los destacados</strong><small>Aparecerá también en las selecciones principales del catálogo.</small></span></label><input type="hidden" name="sort_order" value="${item?.sort_order ?? nextOrder}"></div>
  </div>`, submitLabel:item ? "Guardar producto" : "Crear producto", onSubmit:async data => {
    const baseId = slugify(data.get("name")); const id = item?.id || `${baseId}-${Date.now().toString().slice(-5)}`; const publication = data.get("publication_status"); let imagePath = data.has("remove_image") ? null : (item?.image_path || null); const file = data.get("image");
    if(file instanceof File && file.size){ imagePath = await uploadCatalogImage(id, file); }
    const payload = {id, name:data.get("name"), category:data.get("category"), description:data.get("description") || null, min_quantity:Number(data.get("min_quantity")), sort_order:Number(data.get("sort_order") || 0), active:publication !== "draft", publication_status:publication, featured:data.has("featured"), image_path:imagePath, image_alt:data.get("image_alt") || data.get("name"), badge:data.get("badge") || (publication === "upcoming" ? "Próximamente" : null), settings:{...(item?.settings || {}), icon:data.get("icon") || "ph-cube", image_position_x:Number(data.get("image_position_x") || 50), image_position_y:Number(data.get("image_position_y") || 50), image_zoom:Number(data.get("image_zoom") || 1), image_fit:data.get("image_fit") === "contain" ? "contain" : "cover", image_background:data.get("image_background") || "#d9dcdf"}, updated_at:new Date().toISOString()};
    const query = item ? supabase.from("catalog_items").update(payload).eq("id", item.id) : supabase.from("catalog_items").insert(payload); const {error} = await query; if(error) throw error;
    closeModal(); await loadData(); toast(item ? "Producto actualizado" : "Producto creado");
  }}); bindProductImagePreview();
  bindProductChoices();
  if(item){ const footer=document.querySelector(".product-modal footer"); footer?.insertAdjacentHTML("afterbegin",`<button type="button" class="danger product-delete"><i class="ph ph-trash"></i>Eliminar producto</button><span class="footer-spacer"></span>`); document.querySelector(".product-delete")?.addEventListener("click",()=>confirmProductDelete(item)); }
}

function bindProductChoices(){
  const iconInput=document.querySelector('input[name="icon"]');
  document.querySelectorAll("[data-product-icon]").forEach(button => button.addEventListener("click",()=>{ if(!iconInput)return; iconInput.value=button.dataset.productIcon; document.querySelectorAll("[data-product-icon]").forEach(entry=>entry.classList.toggle("active",entry===button)); }));
  const publication=document.querySelector('.publication-status-select');
  publication?.addEventListener("change",()=>{ publication.classList.remove("published","upcoming","draft"); publication.classList.add(publication.value); });
}

function confirmProductDelete(item){
  openModal({title:"¿Eliminar este producto?",eyebrow:"ACCIÓN PERMANENTE",description:"Esta acción no se puede deshacer.",modalClass:"delete-modal",submitLabel:"Sí, eliminar",content:`<div class="delete-warning"><i class="ph ph-trash"></i><div><strong>${esc(item.name)}</strong><p>Se quitará del panel y dejará de aparecer inmediatamente en el catálogo público.</p></div></div>`,onSubmit:async()=>{ if(state.demo){closeModal();toast("En la demostración no se eliminan productos");return;} const {error}=await supabase.from("catalog_items").delete().eq("id",item.id); if(error)throw error; if(item.image_path) await supabase.storage.from("catalog-images").remove([item.image_path]); closeModal(); await loadData(); toast("Producto eliminado"); }});
}

function bindProductImagePreview(){
  const input = document.querySelector('input[name="image"]'); const preview = document.querySelector("#product-image-preview"); if(!input || !preview) return;
  const controls = {x:document.querySelector('[name="image_position_x"]'), y:document.querySelector('[name="image_position_y"]'), zoom:document.querySelector('[name="image_zoom"]'), fit:document.querySelector('[name="image_fit"]'), background:document.querySelector('[name="image_background"]')};
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const updateFrame = () => { const image = preview.querySelector("img"); if(!image) return; image.style.setProperty("--image-x", `${controls.x.value}%`); image.style.setProperty("--image-y", `${controls.y.value}%`); image.style.setProperty("--image-zoom", controls.zoom.value); image.style.setProperty("--image-fit", controls.fit.value); image.style.setProperty("--image-bg", controls.background.value); document.querySelector('[data-frame-value="zoom"]').textContent = `${Math.round(Number(controls.zoom.value) * 100)}%`; document.querySelectorAll("[data-fit]").forEach(button => button.classList.toggle("active", button.dataset.fit === controls.fit.value)); };
  [controls.zoom, controls.background].forEach(control => control.addEventListener("input", updateFrame));
  document.querySelectorAll("[data-preview-ratio]").forEach(button => button.addEventListener("click", () => { document.querySelectorAll("[data-preview-ratio]").forEach(entry => entry.classList.toggle("active", entry === button)); preview.classList.toggle("mobile-ratio", button.dataset.previewRatio === "mobile"); }));
  document.querySelectorAll("[data-fit]").forEach(button => button.addEventListener("click", () => { controls.fit.value=button.dataset.fit; if(button.dataset.fit === "contain"){ controls.x.value=50; controls.y.value=50; controls.zoom.value=1; } updateFrame(); }));
  document.querySelectorAll("[data-crop-action]").forEach(button => button.addEventListener("click", () => { const direction=button.dataset.cropAction === "zoom-in" ? 1 : -1; controls.zoom.value=clamp(Number(controls.zoom.value)+direction*.1,.7,2.4); updateFrame(); }));
  document.querySelector(".frame-reset")?.addEventListener("click", () => { controls.x.value=50; controls.y.value=50; controls.zoom.value=1; updateFrame(); });

  const pointers = new Map(); let lastPoint=null; let pinchStart=null;
  preview.addEventListener("pointerdown", event => { if(!preview.classList.contains("has-image")) return; preview.setPointerCapture(event.pointerId); pointers.set(event.pointerId,{x:event.clientX,y:event.clientY}); lastPoint={x:event.clientX,y:event.clientY}; pinchStart=null; preview.classList.add("dragging"); });
  preview.addEventListener("pointermove", event => { if(!pointers.has(event.pointerId)) return; const previous=pointers.get(event.pointerId); pointers.set(event.pointerId,{x:event.clientX,y:event.clientY}); if(pointers.size===1){ const rect=preview.getBoundingClientRect(); const dx=event.clientX-previous.x; const dy=event.clientY-previous.y; controls.x.value=clamp(Number(controls.x.value)-dx/rect.width*100,0,100); controls.y.value=clamp(Number(controls.y.value)-dy/rect.height*100,0,100); lastPoint={x:event.clientX,y:event.clientY}; updateFrame(); } else if(pointers.size===2){ const [a,b]=[...pointers.values()]; const distance=Math.hypot(a.x-b.x,a.y-b.y); if(!pinchStart) pinchStart={distance,zoom:Number(controls.zoom.value)}; else { controls.zoom.value=clamp(pinchStart.zoom*(distance/pinchStart.distance),.7,2.4); updateFrame(); } } });
  const endPointer = event => { pointers.delete(event.pointerId); pinchStart=null; lastPoint=null; if(!pointers.size) preview.classList.remove("dragging"); };
  preview.addEventListener("pointerup",endPointer); preview.addEventListener("pointercancel",endPointer);
  preview.addEventListener("wheel", event => { if(!preview.classList.contains("has-image")) return; event.preventDefault(); controls.zoom.value=clamp(Number(controls.zoom.value)+(event.deltaY<0?.08:-.08),.7,2.4); updateFrame(); },{passive:false});
  preview.addEventListener("dblclick", () => { controls.x.value=50; controls.y.value=50; updateFrame(); });
  input.addEventListener("change", () => { const file = input.files?.[0]; if(!file) return; if(file.size > 5 * 1024 * 1024){ input.value=""; toast("La imagen supera los 5 MB", "error"); return; } const url = URL.createObjectURL(file); preview.classList.add("has-image"); preview.querySelector("img")?.remove(); preview.insertAdjacentHTML("afterbegin",`<img src="${url}" alt="Vista previa" draggable="false">`); controls.x.value=50; controls.y.value=50; controls.zoom.value=1; updateFrame(); });
  updateFrame();
}

async function uploadCatalogImage(productId, file){
  if(file.size > 5 * 1024 * 1024) throw new Error("La imagen supera los 5 MB.");
  const extension = (file.name.split(".").pop() || "webp").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `productos/${productId}/${Date.now()}.${extension}`;
  const {error} = await supabase.storage.from("catalog-images").upload(path, file, {contentType:file.type || "image/webp", cacheControl:"31536000", upsert:false});
  if(error) throw error; return path;
}

function customerModal(customer=null){
  openModal({title:customer ? "Editar cliente" : "Nuevo cliente", eyebrow:"CLIENTES", description:"Guardá datos útiles para no pedir lo mismo en cada encargo.", content:`<div class="form-grid">${field("Nombre completo *", "full_name", customer?.full_name, "required")}${field("Marca, empresa o evento", "company", customer?.company)}${field("WhatsApp", "phone", customer?.phone, 'inputmode="tel" placeholder="099 000 000"')}${field("Correo", "email", customer?.email, 'type="email" placeholder="nombre@correo.com"')}${textarea("Notas internas", "notes", customer?.notes, "Preferencias, forma de entrega, datos de facturación...")}</div>`, submitLabel:customer ? "Actualizar cliente" : "Crear cliente", onSubmit:async data => {
    const payload = Object.fromEntries(data.entries()); payload.updated_at = new Date().toISOString(); const query = customer ? supabase.from("customers").update(payload).eq("id", customer.id) : supabase.from("customers").insert(payload); const {error} = await query; if(error) throw error;
    closeModal(); await loadData(); toast(customer ? "Cliente actualizado" : "Cliente creado");
  }});
}

function jobModal(job=null, request=null){
  const eligible = state.requests.filter(r => !["delivered","cancelled"].includes(r.status));
  const stage = request?.status || "approved"; const localDue = job?.due_at ? new Date(job.due_at).toISOString().slice(0,16) : "";
  openModal({title:job ? "Editar ficha de producción" : "Agregar trabajo", eyebrow:"PRODUCCIÓN", description:"Materiales, tiempos y máquina asignada para este pedido.", content:`<div class="form-grid">${select("Solicitud *", "request_id", [["","Seleccionar solicitud"], ...eligible.map(r => [r.id, `${r.id} · ${r.title}`])], job?.request_id || request?.id || "", `required ${job ? "disabled" : ""}`)}${select("Etapa", "stage", [["approved","Por preparar"],["printing","Fabricando"],["ready","Listo para entregar"]], stage)}${field("Material", "material", job?.material, 'placeholder="PLA, PETG, TPU..."')}${field("Color", "color", job?.color, 'placeholder="Negro mate, celeste..."')}${field("Gramos estimados", "grams_estimated", job?.grams_estimated ?? "", 'type="number" min="0" step="0.1"')}${field("Tiempo estimado (min)", "print_minutes_estimated", job?.print_minutes_estimated ?? "", 'type="number" min="0"')}${field("Impresora", "printer_name", job?.printer_name, 'placeholder="Ej. Máquina 01"')}${field("Fecha límite", "due_at", localDue, 'type="datetime-local"')}${field("Reimpresiones", "reprints", job?.reprints || 0, 'type="number" min="0"')}${textarea("Notas de producción", "notes", job?.notes, "Calidad, orientación, relleno, terminación...")}</div>`, submitLabel:job ? "Actualizar ficha" : "Crear ficha", onSubmit:async data => {
    const nextStage = data.get("stage"); const now = new Date().toISOString(); const requestId = job?.request_id || data.get("request_id"); const payload = {request_id:requestId, material:data.get("material") || null, color:data.get("color") || null, grams_estimated:data.get("grams_estimated") ? Number(data.get("grams_estimated")) : null, print_minutes_estimated:data.get("print_minutes_estimated") ? Number(data.get("print_minutes_estimated")) : null, printer_name:data.get("printer_name") || null, due_at:data.get("due_at") ? new Date(data.get("due_at")).toISOString() : null, reprints:Number(data.get("reprints") || 0), notes:data.get("notes") || null, started_at:["printing","ready"].includes(nextStage) ? (job?.started_at || now) : null, completed_at:nextStage === "ready" ? (job?.completed_at || now) : null, updated_at:now};
    const query = job ? supabase.from("production_jobs").update(payload).eq("id", job.id) : supabase.from("production_jobs").insert(payload); const {error} = await query; if(error) throw error; const {error:updateError} = await supabase.from("requests").update({status:nextStage, updated_at:now}).eq("id", requestId); if(updateError) throw updateError;
    closeModal(); await loadData(); toast(job ? "Ficha de producción actualizada" : "Ficha de producción creada");
  }});
}

function settingsModal(type){
  if(type === "contact"){
    const value = setting("contact_channels"); openModal({title:"Canales de contacto", eyebrow:"CONFIGURACIÓN", description:"Estos datos se usarán al conectar la web pública.", content:`<div class="form-grid">${field("WhatsApp de ATRY", "whatsapp", value.whatsapp || "", 'inputmode="tel" placeholder="59893802328"')}${field("Correo de solicitudes", "email", value.email || "atryagency@gmail.com", 'type="email"')}${field("Instagram", "instagram", value.instagram || "@atrylab", 'placeholder="@atrylab"')}${field("Horario de atención", "hours", value.hours || "", 'placeholder="Lun a vie, 9 a 18 h"')}</div>`, onSubmit:data => saveSetting("contact_channels", Object.fromEntries(data.entries()), "Canales actualizados")});
  } else {
    const value = setting("business_profile"); openModal({title:"Datos del taller", eyebrow:"CONFIGURACIÓN", description:"Información operativa para presupuestos, retiros y entregas.", content:`<div class="form-grid">${field("Nombre comercial", "business_name", value.business_name || "ATRY LAB")}${field("Ciudad", "city", value.city || "Montevideo")}${field("Dirección de retiro", "pickup_address", value.pickup_address || "")}${field("Moneda", "currency", value.currency || "UYU")}${field("Plazo estándar", "standard_lead_time", value.standard_lead_time || "", 'placeholder="Ej. 5 a 10 días hábiles"')}${field("Seña habitual (%)", "default_deposit_percent", value.default_deposit_percent || "", 'type="number" min="0" max="100"')}${textarea("Condiciones generales", "terms", value.terms || "", "Entrega, revisiones, tolerancias y pagos")}</div>`, onSubmit:data => saveSetting("business_profile", Object.fromEntries(data.entries()), "Datos del taller actualizados")});
  }
}
async function saveSetting(key, value, message){ const {error} = await supabase.from("app_settings").upsert({key, value, updated_by:state.user?.id, updated_at:new Date().toISOString()}); if(error) throw error; closeModal(); await loadData(); toast(message); }

function teamModal(){
  openModal({title:"Equipo autorizado", eyebrow:"ACCESOS", description:"Los usuarios se crean desde Supabase Authentication y se habilitan con un perfil.", submitLabel:"Cerrar", content:`<div class="team-list">${state.profiles.map(profile => `<article><span>${esc(profile.full_name || "Usuario").slice(0,1)}</span><div><strong>${esc(profile.full_name || "Sin nombre")}</strong><small>${esc(profile.role)} · ${profile.active ? "Activo" : "Inactivo"}</small></div><i class="ph ${profile.active ? "ph-check-circle" : "ph-minus-circle"}"></i></article>`).join("") || "<p>No hay perfiles registrados.</p>"}</div>`, onSubmit:async() => closeModal()});
}
function securityModal(){ openModal({title:"Seguridad del panel", eyebrow:"PROTECCIÓN ACTIVA", description:"La información está aislada de la web pública.", submitLabel:"Entendido", content:`<div class="security-list"><p><i class="ph ph-check-circle"></i><span><strong>Inicio de sesión obligatorio</strong>Supabase Auth valida cada acceso.</span></p><p><i class="ph ph-check-circle"></i><span><strong>Políticas por rol</strong>RLS impide lecturas y cambios anónimos.</span></p><p><i class="ph ph-check-circle"></i><span><strong>Archivos privados</strong>Las referencias se guardarán en un bucket no público.</span></p><p><i class="ph ph-warning-circle"></i><span><strong>Recomendación</strong>Activá MFA en Supabase antes de sumar más usuarios.</span></p></div>`, onSubmit:async() => closeModal()}); }

function detailDrawer(id){
  const r = state.requests.find(x => x.id === id); if(!r) return; state.selected = id; const job = state.jobs.find(j => j.request_id === id); const files = state.attachments.filter(file => file.request_id === id);
  const root = document.querySelector(".app-shell"); root.classList.add("drawer-open"); const drawer = document.createElement("aside"); drawer.className = "detail-drawer request-detail-drawer";
  const whatsapp = whatsappNumber(r.customer_phone); const currentStatus=statusMeta[r.status]||{label:r.status,tone:"gray"};
  const delivery=deliveryOf(r); const deliveryMetaItem=deliveryMeta[delivery.status]||deliveryMeta.pending; const deliveryPlace=delivery.method==="shipping"?[delivery.address,delivery.city,delivery.department].filter(Boolean).join(", "):deliveryMethodLabel(delivery.method);
  const requestItems=Array.isArray(r.configuration?.items)?r.configuration.items:[]; const balance=r.amount===null||r.amount===undefined?null:Math.max(0,Number(r.amount||0)-Number(r.deposit||0));
  const contactLines=[r.customer_phone?`<a href="https://wa.me/${esc(whatsapp)}" target="_blank" rel="noopener"><i class="ph ph-whatsapp-logo"></i>${esc(r.customer_phone)}</a>`:"",r.customer_email?`<a href="mailto:${esc(r.customer_email)}"><i class="ph ph-envelope-simple"></i>${esc(r.customer_email)}</a>`:""].filter(Boolean).join("");
  const itemCards=requestItems.map((item,index)=>{const answers=Object.entries(item.answers||{}).filter(([,value])=>Array.isArray(value)?value.length:String(value||"").trim()).slice(0,5);return `<article class="request-config-item"><span>${String(index+1).padStart(2,"0")}</span><div><h4>${esc(item.name||r.title)}</h4><p>${esc(item.idea||"Sin descripción adicional")}</p><dl><div><dt>Cantidad</dt><dd>${esc(item.quantity||r.quantity)} un.</dd></div><div><dt>Plazo</dt><dd>${esc(item.deadline||r.deadline||"A definir")}</dd></div>${answers.map(([label,value])=>`<div><dt>${esc(label.replace(/_/g," "))}</dt><dd>${esc(Array.isArray(value)?value.join(", "):value)}</dd></div>`).join("")}</dl></div></article>`;}).join("");
  drawer.innerHTML = `<header class="request-detail-head"><div><span class="status ${currentStatus.tone}"><i></i>${esc(currentStatus.label)}</span><small>${esc(r.id)}</small><h2>${esc(r.title)}</h2><p>${esc(r.category||"Sin categoría")} · creada ${shortDate(r.created_at)}</p></div><button class="icon-btn drawer-close" aria-label="Cerrar"><i class="ph ph-x"></i></button></header><div class="drawer-body"><section class="detail-status ${currentStatus.tone}"><label>Estado de la solicitud</label><select id="status-select" class="${currentStatus.tone}">${Object.entries(statusMeta).map(([key,x]) => `<option value="${key}" ${r.status === key ? "selected" : ""}>${x.label}</option>`).join("")}</select><small>Actualizalo a medida que avanza el trabajo.</small></section><section class="client-block premium"><span>${esc(r.customer_name).slice(0,1)}</span><div><small>CLIENTE</small><h3>${esc(r.customer_name)}</h3><p>${esc(r.customer_company || "Cliente particular")}</p><nav>${contactLines||"<em>Sin datos de contacto</em>"}</nav></div>${whatsapp ? `<a class="client-whatsapp" href="https://wa.me/${esc(whatsapp)}" target="_blank" rel="noopener" aria-label="Abrir WhatsApp"><i class="ph ph-whatsapp-logo"></i></a>` : ""}</section><section class="detail-facts premium"><div><i class="ph ph-stack"></i><small>Cantidad</small><strong>${r.quantity} unidades</strong></div><div><i class="ph ph-calendar-blank"></i><small>Plazo</small><strong>${esc(r.deadline || "A definir")}</strong></div><div><i class="ph ph-currency-dollar"></i><small>Valor</small><strong>${money(r.amount)}</strong></div><div><i class="ph ph-wallet"></i><small>Saldo</small><strong>${balance===null?"A cotizar":money(balance)}</strong></div></section><section class="drawer-delivery"><div><small class="eyebrow">ENTREGA</small><span class="status ${deliveryMetaItem.tone}"><i></i>${deliveryMetaItem.label}</span></div><h3><i class="ph ${delivery.method==="shipping"?"ph-truck":delivery.method==="pickup"?"ph-storefront":"ph-chat-circle-dots"}"></i>${esc(deliveryMethodLabel(delivery.method))}</h3><p>${esc(deliveryPlace||"Ubicación pendiente")}</p>${delivery.notes?`<small><i class="ph ph-info"></i>${esc(delivery.notes)}</small>`:""}</section>${itemCards?`<section><small class="eyebrow">DATOS ENVIADOS DESDE LA WEB</small><div class="request-config-list">${itemCards}</div></section>`:""}<section><small class="eyebrow">NOTAS DEL PEDIDO</small><p class="notes">${esc(r.notes || "Sin notas todavía.")}</p></section>${files.length ? `<section><small class="eyebrow">ARCHIVOS DE REFERENCIA</small><div class="attachment-list">${files.map(file => `<button data-attachment="${esc(file.storage_path)}"><i class="ph ph-paperclip"></i><span><strong>${esc(file.original_name)}</strong><small>${file.size_bytes ? `${Math.ceil(file.size_bytes / 1024)} KB` : "Archivo adjunto"}</small></span><i class="ph ph-arrow-square-out"></i></button>`).join("")}</div></section>` : ""}${job ? `<section><div class="inline-head"><small class="eyebrow">FICHA DE PRODUCCIÓN</small><button id="edit-job">Editar ficha</button></div><div class="production-facts"><span><b>Material</b>${esc(job.material || "A definir")}</span><span><b>Color</b>${esc(job.color || "A definir")}</span><span><b>Peso</b>${job.grams_estimated ? `${job.grams_estimated} g` : "A definir"}</span><span><b>Máquina</b>${esc(job.printer_name || "A definir")}</span></div></section>` : ""}<section class="request-origin"><small class="eyebrow">ORIGEN</small><p>${esc(r.source || "manual")} · última actualización ${shortDate(r.updated_at||r.created_at)}</p></section></div><footer><button class="danger drawer-delete" id="drawer-delete" aria-label="Eliminar solicitud"><i class="ph ph-trash"></i></button><button class="secondary" id="drawer-note"><i class="ph ph-note-pencil"></i>Nota</button><button class="primary" id="drawer-edit"><i class="ph ph-pencil-simple"></i>Editar</button></footer>`;
  root.append(drawer); document.querySelector(".drawer-close").onclick = closeDrawer; document.querySelector("#status-select").onchange = event => updateStatus(id, event.target.value); document.querySelector("#drawer-edit").onclick = () => { closeDrawer(); requestModal(r); }; document.querySelector("#drawer-note").onclick = () => noteModal(r); document.querySelector("#drawer-delete").onclick = () => { closeDrawer(); confirmRequestDelete(r); }; document.querySelector("#edit-job")?.addEventListener("click", () => { closeDrawer(); jobModal(job, r); }); document.querySelectorAll("[data-attachment]").forEach(button => button.onclick = () => openAttachment(button.dataset.attachment));
}
async function openAttachment(path){ const {data, error} = await supabase.storage.from("request-attachments").createSignedUrl(path, 300); if(error){ toast("No se pudo abrir el archivo", "error"); return; } window.open(data.signedUrl, "_blank", "noopener"); }
function closeDrawer(){ document.querySelector(".detail-drawer")?.remove(); document.querySelector(".app-shell")?.classList.remove("drawer-open"); state.selected = null; }
function noteModal(request){ openModal({title:"Agregar nota", eyebrow:request.id, description:"La nota se agrega al historial interno de la solicitud.", content:textarea("Nueva nota", "note", "", "Escribí una actualización clara"), submitLabel:"Agregar nota", onSubmit:async data => { const entry = `[${new Intl.DateTimeFormat("es-UY", {dateStyle:"short", timeStyle:"short"}).format(new Date())}] ${data.get("note")}`; const notes = [request.notes, entry].filter(Boolean).join("\n\n"); const {error} = await supabase.from("requests").update({notes, updated_at:new Date().toISOString()}).eq("id", request.id); if(error) throw error; closeModal(); closeDrawer(); await loadData(); toast("Nota agregada"); }}); }
function confirmRequestDelete(request){
  const files=state.attachments.filter(file=>file.request_id===request.id).map(file=>file.storage_path);
  openModal({title:"¿Eliminar esta solicitud?",eyebrow:"ACCIÓN PERMANENTE",description:"Esta acción no se puede deshacer.",modalClass:"delete-modal",submitLabel:"Sí, eliminar",content:`<div class="delete-warning"><i class="ph ph-trash"></i><div><strong>${esc(request.title)}</strong><p>Se eliminarán la solicitud, su historial, la ficha de producción y los archivos de referencia asociados.</p></div></div>`,onSubmit:async()=>{if(state.demo){closeModal();toast("En la demostración no se eliminan solicitudes");return;}if(files.length){const {error:fileError}=await supabase.storage.from("request-attachments").remove(files);if(fileError)throw fileError;}const {error}=await supabase.from("requests").delete().eq("id",request.id);if(error)throw error;closeModal();await loadData();toast("Solicitud eliminada");}});
}
async function updateStatus(id, status){ const item = state.requests.find(x => x.id === id); const previous = item.status; item.status = status; if(!state.demo){ const {error} = await supabase.from("requests").update({status, updated_at:new Date().toISOString()}).eq("id", id); if(error){ item.status = previous; toast("No se pudo actualizar el estado", "error"); return; } await supabase.from("status_history").insert({request_id:id, from_status:previous, to_status:status, changed_by:state.user?.id}); } toast("Estado actualizado"); closeDrawer(); await loadData(); }

async function updateDeliveryStatus(id,status){
  const request=state.requests.find(item=>item.id===id); if(!request)return;
  const configuration={...(request.configuration||{}),delivery:{...deliveryOf(request),status}};
  if(state.demo){request.configuration=configuration;render();toast("Estado de entrega actualizado");return;}
  const {error}=await supabase.from("requests").update({configuration,updated_at:new Date().toISOString()}).eq("id",id);
  if(error){toast("No se pudo actualizar la entrega","error");return;} await loadData(); toast("Estado de entrega actualizado");
}

async function applyBulkCatalogStatus(){
  const ids=[...state.catalogSelection]; const status=document.querySelector("#catalog-bulk-status")?.value; if(!ids.length||!publicationMeta[status])return;
  if(state.demo){state.catalog.forEach(item=>{if(ids.includes(item.id)){item.publication_status=status;item.active=status!=="draft";}});state.catalogSelection.clear();state.catalogSelecting=false;render();toast(`${ids.length} productos actualizados`);return;}
  const {error}=await supabase.from("catalog_items").update({publication_status:status,active:status!=="draft",updated_at:new Date().toISOString()}).in("id",ids);
  if(error){toast("No se pudieron actualizar los productos","error");return;} state.catalogSelection.clear();state.catalogSelecting=false;await loadData();toast(`${ids.length} productos actualizados`);
}

function bindGlobal(){
  document.querySelectorAll("[data-page]").forEach(button => button.onclick = () => { state.page = button.dataset.page; state.sidebarOpen = false; render(); });
  document.querySelectorAll("[data-request]").forEach(button => button.onclick = () => detailDrawer(button.dataset.request));
  document.querySelectorAll("[data-status]").forEach(button => button.onclick = () => { state.status = button.dataset.status; render(); });
  document.querySelectorAll("[data-catalog-status]").forEach(button => button.onclick = () => { state.catalogStatus = button.dataset.catalogStatus; render(); });
  document.querySelector("[data-catalog-select-mode]")?.addEventListener("click",()=>{state.catalogSelecting=!state.catalogSelecting;if(!state.catalogSelecting)state.catalogSelection.clear();render();});
  document.querySelectorAll("[data-catalog-select]").forEach(button=>button.addEventListener("click",()=>{const id=button.dataset.catalogSelect;if(state.catalogSelection.has(id))state.catalogSelection.delete(id);else state.catalogSelection.add(id);render();}));
  document.querySelector("[data-catalog-select-all]")?.addEventListener("click",()=>{const term=state.catalogQuery.trim().toLowerCase();const visible=state.catalog.filter(item=>(state.catalogStatus==="all"||publicationState(item)===state.catalogStatus)&&`${item.name} ${item.category} ${item.badge||""} ${item.description||""}`.toLowerCase().includes(term));const all=visible.length&&visible.every(item=>state.catalogSelection.has(item.id));visible.forEach(item=>all?state.catalogSelection.delete(item.id):state.catalogSelection.add(item.id));render();});
  document.querySelector("[data-catalog-apply]")?.addEventListener("click",applyBulkCatalogStatus);
  document.querySelectorAll("[data-delivery-status]").forEach(select=>select.addEventListener("change",()=>updateDeliveryStatus(select.dataset.deliveryStatus,select.value)));
  document.querySelector("[data-catalog-reset]")?.addEventListener("click", () => { state.catalogStatus="all"; state.catalogQuery=""; render(); });
  document.querySelectorAll("[data-action]").forEach(button => button.onclick = () => handleAction(button.dataset.action));
  document.querySelectorAll("[data-edit-product]").forEach(button => button.onclick = () => productModal(state.catalog.find(item => item.id === button.dataset.editProduct)));
  document.querySelectorAll("[data-edit-customer]").forEach(button => button.onclick = () => customerModal(state.customers.find(item => item.id === button.dataset.editCustomer)));
  document.querySelector("#request-search")?.addEventListener("input", event => { state.query = event.target.value; const pos = event.target.selectionStart; render(); const input = document.querySelector("#request-search"); input?.focus(); input?.setSelectionRange(pos, pos); });
  document.querySelector("#catalog-search")?.addEventListener("input", event => { state.catalogQuery = event.target.value; const pos = event.target.selectionStart; render(); const input = document.querySelector("#catalog-search"); input?.focus(); input?.setSelectionRange(pos, pos); });
  document.querySelector("#menu-toggle")?.addEventListener("click", () => { state.sidebarOpen = !state.sidebarOpen; document.querySelector(".app-shell").classList.toggle("menu-open", state.sidebarOpen); });
  document.querySelector("#global-search")?.addEventListener("click", focusSearch);
  document.querySelector(".drawer-backdrop")?.addEventListener("click", () => { closeDrawer(); state.sidebarOpen = false; document.querySelector(".app-shell")?.classList.remove("menu-open"); });
  document.querySelectorAll("[data-logout]").forEach(button => button.addEventListener("click", async() => { if(state.demo){ toast("La sesión demo permanece activa"); return; } button.disabled=true; button.innerHTML='<i class="ph ph-circle-notch spin"></i><span>Saliendo</span>'; const {error}=await supabase.auth.signOut(); if(error){ toast("No se pudo cerrar la sesión", "error"); button.disabled=false; button.innerHTML='<i class="ph ph-sign-out"></i><span>Salir</span>'; } }));
}
function handleAction(action){
  ({"new-request":() => requestModal(), "new-product":() => productModal(), "new-customer":() => customerModal(), "new-job":() => jobModal(), "contact-settings":() => settingsModal("contact"), "business-settings":() => settingsModal("business"), "team-settings":teamModal, "security-info":securityModal}[action] || (() => {}))();
}
function focusSearch(){ state.page = "requests"; render(); setTimeout(() => document.querySelector("#request-search")?.focus(), 0); }
document.addEventListener("keydown", event => { if(event.key === "Escape"){ if(document.querySelector("#modal-root")?.innerHTML) closeModal(); else closeDrawer(); } if((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k"){ event.preventDefault(); focusSearch(); } });
function toast(message, type="ok"){ const root = document.querySelector("#toast-root") || document.body; const item = document.createElement("div"); item.className = `toast ${type}`; item.innerHTML = `<i class="ph ${type === "error" ? "ph-warning-circle" : "ph-check-circle"}"></i>${esc(message)}`; root.append(item); setTimeout(() => item.remove(), 3200); }

bootstrap();
