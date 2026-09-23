export const demoRequests = [
  { id:"ATRY-2026-00124", created_at:"2026-09-17T14:20:00", customer_name:"Martina Silva", customer_company:"Marea Estudio", customer_phone:"099 421 830", title:"Llaveros para equipo", category:"Tu marca", quantity:50, deadline:"25 set", status:"new", priority:"normal", amount:null, notes:"Logo en dos colores. Entrega en Montevideo." },
  { id:"ATRY-2026-00123", created_at:"2026-09-17T10:05:00", customer_name:"Lucía Ferreyra", customer_company:"Casa Nativa", customer_phone:"098 115 294", title:"Porta QR para mostrador", category:"Negocios", quantity:4, deadline:"Sin apuro", status:"reviewing", priority:"normal", amount:null, notes:"Necesita versión para menú y WiFi." },
  { id:"ATRY-2026-00122", created_at:"2026-09-16T18:30:00", customer_name:"Joaquín Pérez", customer_company:"Liga Sur", customer_phone:"092 704 618", title:"Trofeos campeonato", category:"Eventos", quantity:12, deadline:"30 set", status:"reviewing", priority:"high", amount:18400, notes:"Tres tamaños con nombre de categoría." },
  { id:"ATRY-2026-00121", created_at:"2026-09-15T12:15:00", customer_name:"Ana Costa", customer_company:"", customer_phone:"094 661 022", title:"Figura desde referencia", category:"Figuras", quantity:1, deadline:"Sin apuro", status:"approved", priority:"normal", amount:4200, notes:"Figura de mascota a partir de fotografías." },
  { id:"ATRY-2026-00120", created_at:"2026-09-14T16:42:00", customer_name:"Bruno Méndez", customer_company:"Nodo Café", customer_phone:"091 330 552", title:"Números de mesa", category:"Negocios", quantity:20, deadline:"20 set", status:"printing", priority:"high", amount:7600, notes:"Negro mate, numeración del 1 al 20." },
  { id:"ATRY-2026-00119", created_at:"2026-09-12T09:30:00", customer_name:"Valentina Rossi", customer_company:"Boda V & F", customer_phone:"095 908 441", title:"Souvenirs personalizados", category:"Eventos", quantity:80, deadline:"18 oct", status:"ready", priority:"normal", amount:22400, notes:"Dos colores, nombre y fecha." }
];

export const demoCatalog = [
  {id:"llaveros",name:"Llaveros personalizados",category:"Tu marca",min_quantity:10,active:true,featured:true},
  {id:"porta-qr",name:"Porta QR",category:"Negocios",min_quantity:1,active:true,featured:true},
  {id:"logos-3d",name:"Logos 3D",category:"Tu marca",min_quantity:1,active:true,featured:false},
  {id:"souvenirs",name:"Souvenirs",category:"Eventos",min_quantity:10,active:true,featured:true},
  {id:"trofeos",name:"Trofeos",category:"Eventos",min_quantity:1,active:true,featured:true},
  {id:"figuras-referencia",name:"Figuras desde referencia",category:"Figuras",min_quantity:1,active:true,featured:false}
];

export const statusMeta = {
  new:{label:"Nueva",tone:"blue"}, reviewing:{label:"En conversación",tone:"violet"},
  approved:{label:"Confirmada",tone:"green"}, printing:{label:"Fabricando",tone:"cyan"}, ready:{label:"Lista",tone:"mint"},
  delivered:{label:"Entregada",tone:"gray"}, cancelled:{label:"Cancelada",tone:"red"}
};
