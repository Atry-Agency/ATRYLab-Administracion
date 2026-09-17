import "./styles.css";
import { supabase, isSupabaseConfigured } from "./supabase.js";
import { demoRequests, demoCatalog, statusMeta } from "./demo-data.js";

const state = {
  page: "dashboard", requests: [], catalog: [], selected: null, query: "", status: "all",
  demo: !isSupabaseConfigured, loading: true, user: null, sidebarOpen: false
};

const nav = [
  ["dashboard","ph-squares-four","Resumen"], ["requests","ph-inbox","Solicitudes"],
  ["production","ph-printer","Producción"], ["catalog","ph-cube","Catálogo"],
  ["customers","ph-users","Clientes"], ["settings","ph-sliders-horizontal","Configuración"]
];

const money = value => value ? new Intl.NumberFormat("es-UY",{style:"currency",currency:"UYU",maximumFractionDigits:0}).format(value) : "A cotizar";
const shortDate = value => new Intl.DateTimeFormat("es-UY",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value));
const esc = value => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const statusPill = status => { const s=statusMeta[status]||statusMeta.new; return `<span class="status ${s.tone}"><i></i>${s.label}</span>`; };

async function bootstrap(){
  if(state.demo){ state.requests=[...demoRequests]; state.catalog=[...demoCatalog]; state.loading=false; render(); return; }
  const {data:{session}}=await supabase.auth.getSession();
  if(!session){ state.loading=false; renderLogin(); return; }
  state.user=session.user; await loadData();
  supabase.auth.onAuthStateChange((_event,sessionNow)=>{ if(!sessionNow) renderLogin(); });
}

async function loadData(){
  state.loading=true; render();
  const [requestsResult,catalogResult]=await Promise.all([
    supabase.from("requests").select("*").order("created_at",{ascending:false}),
    supabase.from("catalog_items").select("*").order("sort_order",{ascending:true})
  ]);
  if(requestsResult.error || catalogResult.error){
    toast("No pudimos cargar todos los datos", "error");
  }
  state.requests=requestsResult.data||[]; state.catalog=catalogResult.data||[]; state.loading=false; render();
}

function renderLogin(){
  document.querySelector("#app").innerHTML=`<main class="login-shell">
    <section class="login-brand"><div class="brand"><span><img src="/recursos/atry-isotipo.png"></span>ATRY <b>LAB</b></div><div><small>ADMINISTRACIÓN</small><h1>Todo el taller,<br><em>en un solo lugar.</em></h1><p>Solicitudes, producción, clientes y catálogo con una operación clara y segura.</p></div><footer>Acceso exclusivo para el equipo ATRY.</footer></section>
    <section class="login-panel"><form id="login-form"><span class="login-icon"><i class="ph ph-lock-key"></i></span><small>BIENVENIDO</small><h2>Ingresá al panel</h2><p>Usá el correo autorizado de ATRY LAB.</p><label>Correo<input name="email" type="email" autocomplete="email" required placeholder="equipo@atrylab.com"></label><label>Contraseña<input name="password" type="password" autocomplete="current-password" required placeholder="••••••••••••"></label><button class="primary" type="submit">Ingresar <i class="ph ph-arrow-right"></i></button><span id="login-message"></span></form></section>
  </main>`;
  document.querySelector("#login-form").addEventListener("submit",signIn);
}

async function signIn(event){
  event.preventDefault(); const form=new FormData(event.currentTarget); const button=event.currentTarget.querySelector("button");
  button.disabled=true; button.innerHTML='Verificando <i class="ph ph-circle-notch spin"></i>';
  const {data,error}=await supabase.auth.signInWithPassword({email:form.get("email"),password:form.get("password")});
  if(error){ document.querySelector("#login-message").textContent="No pudimos validar esos datos."; button.disabled=false; button.innerHTML='Ingresar <i class="ph ph-arrow-right"></i>'; return; }
  state.user=data.user; await loadData();
}

function shell(content){
  const pageTitle=nav.find(x=>x[0]===state.page)?.[2]||"Administración";
  return `<div class="app-shell ${state.sidebarOpen?'menu-open':''}">
    <aside class="sidebar"><button class="brand" data-page="dashboard"><span><img src="/recursos/atry-isotipo.png"></span><span>ATRY <b>LAB</b><small>ADMIN</small></span></button><nav>${nav.map(([id,icon,label])=>`<button data-page="${id}" class="${state.page===id?'active':''}"><i class="ph ${icon}"></i><span>${label}</span>${id==='requests'?`<b>${state.requests.filter(r=>r.status==='new').length}</b>`:''}</button>`).join("")}</nav><div class="sidebar-foot"><span class="avatar">A</span><div><strong>Equipo ATRY</strong><small>${state.demo?'Vista de demostración':esc(state.user?.email)}</small></div><button id="logout" title="Cerrar sesión"><i class="ph ph-sign-out"></i></button></div></aside>
    <main class="main"><header><button class="menu-toggle" id="menu-toggle"><i class="ph ph-list"></i></button><div><small>ATRY LAB / OPERACIONES</small><h1>${pageTitle}</h1></div><div class="top-actions"><button class="search-trigger"><i class="ph ph-magnifying-glass"></i><span>Buscar</span><kbd>⌘ K</kbd></button><button class="notification"><i class="ph ph-bell"></i><b></b></button><span class="live"><i></i>${state.demo?'Demo':'En línea'}</span></div></header>${state.demo?`<div class="demo-banner"><i class="ph ph-flask"></i><span><strong>Vista de demostración</strong> — la interfaz está lista; falta vincular las credenciales de Supabase.</span></div>`:''}<div class="content">${content}</div></main>
    <div class="drawer-backdrop"></div><div id="toast-root"></div>
  </div>`;
}

function render(){
  if(state.loading){ document.querySelector("#app").innerHTML='<div class="loading"><img src="/recursos/atry-isotipo.png"><span></span><p>Preparando tu espacio de trabajo…</p></div>'; return; }
  const views={dashboard:dashboardView,requests:requestsView,production:productionView,catalog:catalogView,customers:customersView,settings:settingsView};
  document.querySelector("#app").innerHTML=shell((views[state.page]||dashboardView)()); bindGlobal();
}

function dashboardView(){
  const newCount=state.requests.filter(r=>r.status==='new').length;
  const active=state.requests.filter(r=>["approved","printing"].includes(r.status)).length;
  const pending=state.requests.filter(r=>["reviewing","quoted"].includes(r.status)).length;
  const total=state.requests.filter(r=>!['cancelled'].includes(r.status)).reduce((n,r)=>n+(r.amount||0),0);
  return `<section class="welcome"><div><small>JUEVES, 17 DE SETIEMBRE</small><h2>Buen día, ATRY.</h2><p>Esto es lo que necesita atención hoy.</p></div><button class="primary" data-page="requests"><i class="ph ph-plus"></i>Nueva solicitud</button></section>
  <section class="metrics"><article class="metric accent"><div><span>NUEVAS</span><i class="ph ph-inbox"></i></div><strong>${newCount}</strong><p>solicitudes por revisar</p><small><i class="ph ph-arrow-up-right"></i> Entraron hoy</small></article><article class="metric"><div><span>EN CURSO</span><i class="ph ph-printer"></i></div><strong>${active}</strong><p>trabajos activos</p><small>Producción al día</small></article><article class="metric"><div><span>POR COTIZAR</span><i class="ph ph-calculator"></i></div><strong>${pending}</strong><p>esperan respuesta</p><small>Prioridad comercial</small></article><article class="metric"><div><span>VALOR ABIERTO</span><i class="ph ph-chart-line-up"></i></div><strong class="money">${money(total)}</strong><p>en solicitudes activas</p><small>Sin contar canceladas</small></article></section>
  <section class="dashboard-grid"><article class="panel activity"><div class="panel-head"><div><small>ACTIVIDAD RECIENTE</small><h3>Últimas solicitudes</h3></div><button data-page="requests">Ver todas <i class="ph ph-arrow-right"></i></button></div><div class="request-list">${state.requests.slice(0,5).map(requestRow).join("")}</div></article>
  <article class="panel focus"><div class="panel-head"><div><small>PRÓXIMOS PASOS</small><h3>Para resolver hoy</h3></div><span>${pending+newCount}</span></div><div class="focus-list"><button data-page="requests"><i class="ph ph-chat-circle-text"></i><span><strong>Responder solicitudes nuevas</strong><small>Que nadie quede esperando</small></span><b>${newCount}</b></button><button data-page="production"><i class="ph ph-clock-countdown"></i><span><strong>Revisar fechas de entrega</strong><small>Trabajos próximos a vencer</small></span><b>${active}</b></button><button data-page="catalog"><i class="ph ph-eye"></i><span><strong>Revisar catálogo</strong><small>${state.catalog.filter(x=>x.active).length} productos visibles</small></span><i class="ph ph-caret-right"></i></button></div></article></section>`;
}

function requestRow(r){ return `<button class="request-row" data-request="${esc(r.id)}"><span class="request-avatar">${esc(r.customer_name).slice(0,1)}</span><span class="request-copy"><strong>${esc(r.title)}</strong><small>${esc(r.customer_name)}${r.customer_company?` · ${esc(r.customer_company)}`:''}</small></span>${statusPill(r.status)}<span class="request-time">${shortDate(r.created_at)}</span><i class="ph ph-caret-right"></i></button>`; }

function requestsView(){
  const filtered=state.requests.filter(r=>(state.status==='all'||r.status===state.status)&&`${r.id} ${r.customer_name} ${r.customer_company} ${r.title}`.toLowerCase().includes(state.query.toLowerCase()));
  return `<section class="section-head"><div><h2>Solicitudes</h2><p>Seguimiento desde el primer contacto hasta la entrega.</p></div><button class="primary"><i class="ph ph-plus"></i>Crear manualmente</button></section><section class="toolbar"><label><i class="ph ph-magnifying-glass"></i><input id="request-search" value="${esc(state.query)}" placeholder="Buscar por cliente, proyecto o código"></label><div class="filters">${[["all","Todas"],...Object.entries(statusMeta).map(([id,x])=>[id,x.label])].map(([id,label])=>`<button data-status="${id}" class="${state.status===id?'active':''}">${label}</button>`).join("")}</div><button class="icon-btn" title="Más filtros"><i class="ph ph-faders-horizontal"></i></button></section><section class="table-panel"><div class="table-head"><span>Solicitud</span><span>Cliente</span><span>Estado</span><span>Entrega</span><span>Valor</span><span></span></div>${filtered.length?filtered.map(r=>`<button class="table-row" data-request="${esc(r.id)}"><span><b>${esc(r.id)}</b><strong>${esc(r.title)}</strong><small>${esc(r.category)}</small></span><span><strong>${esc(r.customer_name)}</strong><small>${esc(r.customer_company||r.customer_phone)}</small></span>${statusPill(r.status)}<span>${esc(r.deadline||"A definir")}</span><span>${money(r.amount)}</span><i class="ph ph-caret-right"></i></button>`).join(""):`<div class="empty"><i class="ph ph-magnifying-glass"></i><h3>No encontramos solicitudes</h3><p>Probá con otro término o estado.</p></div>`}</section>`;
}

function productionView(){
  const cols=[["approved","Por preparar"],["printing","Fabricando"],["ready","Listo para entregar"]];
  return `<section class="section-head"><div><h2>Producción</h2><p>Una vista simple del trabajo que está pasando por el taller.</p></div><button class="primary"><i class="ph ph-plus"></i>Agregar trabajo</button></section><section class="kanban">${cols.map(([status,title])=>{const rows=state.requests.filter(r=>r.status===status);return `<article><header><span>${title}</span><b>${rows.length}</b></header><div>${rows.length?rows.map(r=>`<button class="job-card" data-request="${esc(r.id)}"><small>${esc(r.id)}</small><strong>${esc(r.title)}</strong><p>${esc(r.customer_name)} · ${r.quantity} un.</p><footer><span><i class="ph ph-calendar-blank"></i>${esc(r.deadline)}</span>${r.priority==='high'?'<em>Prioridad</em>':''}</footer></button>`).join(""):'<div class="column-empty">Sin trabajos acá</div>'}</div></article>`}).join("")}</section>`;
}

function catalogView(){
  return `<section class="section-head"><div><h2>Catálogo</h2><p>Controlá qué encuentra el cliente y las reglas básicas de cada producto.</p></div><button class="primary"><i class="ph ph-plus"></i>Nuevo producto</button></section><section class="catalog-admin">${state.catalog.map(item=>`<article><span class="catalog-icon"><i class="ph ph-cube"></i></span><div><small>${esc(item.category)}</small><h3>${esc(item.name)}</h3><p>Pedido mínimo: <b>${item.min_quantity} ${item.min_quantity===1?'unidad':'unidades'}</b></p></div><span class="visibility ${item.active?'on':''}"><i></i>${item.active?'Visible':'Oculto'}</span><button class="icon-btn"><i class="ph ph-pencil-simple"></i></button></article>`).join("")}</section>`;
}

function customersView(){
  const map=new Map(); state.requests.forEach(r=>{if(!map.has(r.customer_phone))map.set(r.customer_phone,{name:r.customer_name,company:r.customer_company,phone:r.customer_phone,count:0,value:0,last:r.created_at});const x=map.get(r.customer_phone);x.count++;x.value+=r.amount||0;if(r.created_at>x.last)x.last=r.created_at;});
  return `<section class="section-head"><div><h2>Clientes</h2><p>Historial y contexto para atender mejor cada nuevo pedido.</p></div><button class="primary"><i class="ph ph-user-plus"></i>Nuevo cliente</button></section><section class="customer-grid">${[...map.values()].map(x=>`<article><span class="customer-avatar">${esc(x.name).slice(0,1)}</span><div><h3>${esc(x.name)}</h3><p>${esc(x.company||"Cliente particular")}</p><small>${esc(x.phone)}</small></div><dl><div><dt>Solicitudes</dt><dd>${x.count}</dd></div><div><dt>Valor</dt><dd>${money(x.value)}</dd></div></dl><button class="icon-btn"><i class="ph ph-arrow-right"></i></button></article>`).join("")}</section>`;
}

function settingsView(){ return `<section class="section-head"><div><h2>Configuración</h2><p>Preferencias generales y acceso del equipo.</p></div></section><section class="settings-grid"><article class="panel"><span class="setting-icon"><i class="ph ph-whatsapp-logo"></i></span><div><h3>Canales de contacto</h3><p>Número de WhatsApp y correo que recibe las solicitudes.</p></div><button>Administrar</button></article><article class="panel"><span class="setting-icon"><i class="ph ph-users-three"></i></span><div><h3>Equipo y permisos</h3><p>Invitaciones, roles y acceso al panel.</p></div><button>Administrar</button></article><article class="panel"><span class="setting-icon"><i class="ph ph-shield-check"></i></span><div><h3>Seguridad</h3><p>Doble factor, sesiones y registro de actividad.</p></div><button>Revisar</button></article><article class="panel"><span class="setting-icon"><i class="ph ph-database"></i></span><div><h3>Respaldo</h3><p>Estado de las copias de seguridad externas.</p></div><button>Configurar</button></article></section>`; }

function detailDrawer(id){
  const r=state.requests.find(x=>x.id===id); if(!r)return; state.selected=id;
  const root=document.querySelector(".app-shell"); root.classList.add("drawer-open");
  const drawer=document.createElement("aside"); drawer.className="detail-drawer"; drawer.innerHTML=`<header><div><small>${esc(r.id)}</small><h2>${esc(r.title)}</h2></div><button class="icon-btn drawer-close"><i class="ph ph-x"></i></button></header><div class="drawer-body"><section class="detail-status"><label>Estado</label><select id="status-select">${Object.entries(statusMeta).map(([id,x])=>`<option value="${id}" ${r.status===id?'selected':''}>${x.label}</option>`).join("")}</select></section><section class="client-block"><span>${esc(r.customer_name).slice(0,1)}</span><div><small>CLIENTE</small><h3>${esc(r.customer_name)}</h3><p>${esc(r.customer_company||"Cliente particular")}</p></div><a href="https://wa.me/598${esc(r.customer_phone).replace(/\D/g,"").replace(/^598/,"")}" target="_blank"><i class="ph ph-whatsapp-logo"></i></a></section><section class="detail-facts"><div><small>Cantidad</small><strong>${r.quantity} unidades</strong></div><div><small>Entrega</small><strong>${esc(r.deadline)}</strong></div><div><small>Valor</small><strong>${money(r.amount)}</strong></div><div><small>Prioridad</small><strong>${r.priority==='high'?'Alta':'Normal'}</strong></div></section><section><small class="eyebrow">DETALLE DEL PEDIDO</small><p class="notes">${esc(r.notes)}</p></section><section><small class="eyebrow">ACTIVIDAD</small><div class="timeline"><span><i></i><div><strong>Solicitud recibida</strong><small>${shortDate(r.created_at)}</small></div></span><span><i></i><div><strong>Esperando próxima acción</strong><small>Actualizá el estado para continuar</small></div></span></div></section></div><footer><button class="secondary"><i class="ph ph-note-pencil"></i>Agregar nota</button><button class="primary"><i class="ph ph-whatsapp-logo"></i>Responder</button></footer>`;
  root.append(drawer); document.querySelector(".drawer-close").onclick=closeDrawer; document.querySelector(".drawer-backdrop").onclick=closeDrawer; document.querySelector("#status-select").onchange=e=>updateStatus(id,e.target.value);
}

function closeDrawer(){ document.querySelector(".detail-drawer")?.remove(); document.querySelector(".app-shell")?.classList.remove("drawer-open"); state.selected=null; }
async function updateStatus(id,status){ const item=state.requests.find(x=>x.id===id); const previous=item.status; item.status=status; if(!state.demo){ const {error}=await supabase.from("requests").update({status}).eq("id",id); if(error){item.status=previous;toast("No se pudo actualizar el estado","error");return;} } toast("Estado actualizado"); closeDrawer(); render(); }

function bindGlobal(){
  document.querySelectorAll("[data-page]").forEach(b=>b.onclick=()=>{state.page=b.dataset.page;state.sidebarOpen=false;render();});
  document.querySelectorAll("[data-request]").forEach(b=>b.onclick=()=>detailDrawer(b.dataset.request));
  document.querySelectorAll("[data-status]").forEach(b=>b.onclick=()=>{state.status=b.dataset.status;render();});
  document.querySelector("#request-search")?.addEventListener("input",e=>{state.query=e.target.value;const pos=e.target.selectionStart;render();const input=document.querySelector("#request-search");input.focus();input.setSelectionRange(pos,pos);});
  document.querySelector("#menu-toggle")?.addEventListener("click",()=>{state.sidebarOpen=!state.sidebarOpen;document.querySelector(".app-shell").classList.toggle("menu-open",state.sidebarOpen);});
  document.querySelector(".drawer-backdrop")?.addEventListener("click",()=>{state.sidebarOpen=false;document.querySelector(".app-shell").classList.remove("menu-open");});
  document.querySelector("#logout")?.addEventListener("click",async()=>{if(state.demo){toast("La sesión demo permanece activa");return;}await supabase.auth.signOut();});
  document.addEventListener("keydown",keyboardOnce,{once:true});
}
function keyboardOnce(e){ if(e.key==='Escape')closeDrawer(); if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();state.page='requests';render();setTimeout(()=>document.querySelector('#request-search')?.focus(),0);} }
function toast(message,type="ok"){const root=document.querySelector("#toast-root");if(!root)return;root.innerHTML=`<div class="toast ${type}"><i class="ph ${type==='error'?'ph-warning-circle':'ph-check-circle'}"></i>${message}</div>`;setTimeout(()=>root.innerHTML="",2800);}

bootstrap();
