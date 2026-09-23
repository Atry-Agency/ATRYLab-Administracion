import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const cyan = rgb(0.05, .68, .80);
const navy = rgb(.025, .16, .20);
const muted = rgb(.40, .47, .49);
const line = rgb(.86, .89, .90);
const soft = rgb(.95, .98, .98);

const formatMoney = (value, currency) => new Intl.NumberFormat("es-UY", {style:"currency",currency,maximumFractionDigits:2}).format(Number(value || 0));
const date = value => value ? new Intl.DateTimeFormat("es-UY").format(new Date(`${String(value).slice(0,10)}T12:00:00`)) : "";
const clean = value => String(value || "").trim();
const safeName = value => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g,"-").replace(/^-|-$/g,"") || "Cliente";

export async function generateQuotePdf(quote, items, request, settings={}){
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const base = import.meta.env.BASE_URL || "/";
  const [regularBytes, boldBytes, logoBytes] = await Promise.all([
    fetch(`${base}recursos/eurostile-medium.otf`).then(r=>r.arrayBuffer()),
    fetch(`${base}recursos/eurostile-bold-extended.otf`).then(r=>r.arrayBuffer()),
    fetch(`${base}recursos/atry-isotipo.png`).then(r=>r.arrayBuffer())
  ]);
  const regular = await pdf.embedFont(regularBytes, {subset:true});
  const bold = await pdf.embedFont(boldBytes, {subset:true});
  const logo = await pdf.embedPng(logoBytes);
  const size=[595.28,841.89], margin=48;
  let page, y;
  const newPage = () => {
    page=pdf.addPage(size); y=793;
    page.drawRectangle({x:0,y:821,width:size[0],height:21,color:navy});
    page.drawImage(logo,{x:margin,y:773,width:27,height:27});
    page.drawText("ATRY LAB",{x:84,y:782,size:14,font:bold,color:navy});
    page.drawText("COTIZACIÓN",{x:margin,y:733,size:28,font:bold,color:navy});
    page.drawText(quote.quote_number,{x:margin,y:711,size:12,font:bold,color:cyan});
    page.drawText(`V${quote.version}`,{x:margin+bold.widthOfTextAtSize(quote.quote_number,12)+8,y:711,size:9,font:bold,color:muted});
    page.drawText(`Fecha: ${date(quote.issue_date)}`,{x:390,y:735,size:9,font:regular,color:muted});
    page.drawText(`Válida hasta: ${date(quote.valid_until)}`,{x:390,y:718,size:9,font:regular,color:muted});
    page.drawLine({start:{x:margin,y:691},end:{x:size[0]-margin,y:691},thickness:1,color:line}); y=666;
  };
  const text = (value,x,yy,fontSize=9,color=navy,font=regular) => page.drawText(clean(value),{x,y:yy,size:fontSize,font,color});
  const wrap = (value,maxWidth,fontSize=9,font=regular) => {
    const words=clean(value).split(/\s+/).filter(Boolean), rows=[]; let row="";
    words.forEach(word=>{const next=row?`${row} ${word}`:word;if(font.widthOfTextAtSize(next,fontSize)<=maxWidth)row=next;else{if(row)rows.push(row);row=word;}});if(row)rows.push(row);return rows;
  };
  const ensure = height => { if(y-height<92){ footer(); newPage(); } };
  const footer = () => {
    page.drawLine({start:{x:margin,y:62},end:{x:size[0]-margin,y:62},thickness:1,color:line});
    text("Atry Lab",margin,45,9,navy,bold); text("Fabricación digital · Impresión 3D",margin,31,8,muted);
    text(settings.website || "AtryLab.com",size[0]-margin-regular.widthOfTextAtSize(settings.website||"AtryLab.com",8),38,8,cyan);
  };
  const section = title => { ensure(35); text(title.toUpperCase(),margin,y,9,cyan,bold); y-=20; };
  newPage();
  section("Cliente"); text(quote.client_name || request.customer_name,margin,y,13,navy,bold); y-=17;
  [quote.client_company,quote.client_phone,quote.client_email].filter(clean).forEach(v=>{text(v,margin,y,9,muted);y-=14;}); y-=12;
  section("Trabajo cotizado");
  items.forEach((item,index)=>{
    const details=[["Material",item.material],["Color",item.colors],["Dimensiones",item.dimensions],["Terminación",item.finish],["Personalización",item.personalization],["Diseño / modelado",item.design_description]].filter(([,v])=>clean(v));
    const descriptionRows=wrap(item.description,485,9);
    ensure(58+details.length*14+descriptionRows.length*12);
    page.drawRectangle({x:margin,y:y-18,width:499,height:22,color:soft});
    text(`${index+1}. ${item.product_name}`,margin+10,y-10,11,navy,bold); y-=32;
    descriptionRows.forEach(row=>{text(row,margin,y,9,muted);y-=12;});
    details.forEach(([label,value])=>{text(`${label}:`,margin,y,8,muted,bold);text(value,margin+93,y,8,navy);y-=14;});
    text(`${item.quantity} ${Number(item.quantity)===1?"unidad":"unidades"}`,margin,y,9,navy,bold);
    text(`Precio unitario: ${formatMoney(item.unit_price,quote.currency)}`,300,y,9,muted);
    text(formatMoney(item.subtotal,quote.currency),size[0]-margin-bold.widthOfTextAtSize(formatMoney(item.subtotal,quote.currency),10),y,10,navy,bold); y-=28;
  });
  ensure(185); section("Resumen económico");
  const rows=[["Subtotal",quote.items_subtotal],["Diseño / modelado",quote.design_fee],["Personalización",quote.personalization_fee],["Extras",quote.extras_fee],["Packaging",quote.packaging_fee],["Envío",quote.shipping_fee],["Otros cargos",quote.other_fee],["Descuento",-Number(quote.discount||0)]].filter(([,v])=>Number(v));
  rows.forEach(([label,value])=>{text(label,320,y,9,muted);const amount=formatMoney(value,quote.currency);text(amount,size[0]-margin-regular.widthOfTextAtSize(amount,9),y,9,value<0?rgb(.65,.25,.25):navy);y-=17;});
  y-=4; page.drawRectangle({x:300,y:y-19,width:247,height:34,color:navy}); text("TOTAL",315,y-7,11,rgb(1,1,1),bold);const total=formatMoney(quote.total,quote.currency);text(total,535-bold.widthOfTextAtSize(total,14),y-9,14,rgb(1,1,1),bold);y-=55;
  const blocks=[["Producción",quote.production_terms],["Entrega",quote.delivery_terms],["Pago",quote.payment_terms],["Observaciones",quote.observations]].filter(([,v])=>clean(v));
  blocks.forEach(([title,value])=>{const rows=wrap(value,499,9);ensure(32+rows.length*13);text(title.toUpperCase(),margin,y,8,cyan,bold);y-=17;rows.forEach(row=>{text(row,margin,y,9,navy);y-=13;});y-=10;});
  const disclaimer="Esta cotización es válida durante el período indicado. Cambios posteriores en cantidades, materiales, medidas, diseño u otras características pueden requerir una actualización del presupuesto.";
  const disclaimerRows=wrap(disclaimer,499,7);ensure(35+disclaimerRows.length*10);page.drawRectangle({x:margin,y:y-12-disclaimerRows.length*10,width:499,height:24+disclaimerRows.length*10,color:soft});y-=4;disclaimerRows.forEach(row=>{text(row,margin+10,y,7,muted);y-=10;});
  footer();
  const bytes=await pdf.save();
  const filename=`ATRY-Cotizacion-${quote.quote_number.split("-").pop()}-${safeName(quote.client_name||request.customer_name)}.pdf`;
  return {bytes,filename};
}
