import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const cyan = rgb(0.02, .67, .80);
const navy = rgb(.025, .16, .20);
const muted = rgb(.38, .45, .47);
const line = rgb(.85, .89, .90);
const soft = rgb(.95, .98, .98);
const white = rgb(1, 1, 1);

const formatMoney = (value, currency) => new Intl.NumberFormat("es-UY", {style:"currency",currency,maximumFractionDigits:2}).format(Number(value || 0));
const date = value => value ? new Intl.DateTimeFormat("es-UY").format(new Date(`${String(value).slice(0,10)}T12:00:00`)) : "";
const clean = value => String(value || "").trim();
const safeName = value => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g,"-").replace(/^-|-$/g,"") || "Cliente";

export async function generateQuotePdf(quote, items, request, settings={}){
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const base = import.meta.env?.BASE_URL || "/";
  const [regularBytes, boldBytes, logoBytes] = await Promise.all([
    fetch(`${base}recursos/eurostile-medium.otf`).then(r=>r.arrayBuffer()),
    fetch(`${base}recursos/eurostile-bold-extended.otf`).then(r=>r.arrayBuffer()),
    fetch(`${base}recursos/atry-isotipo.png`).then(r=>r.arrayBuffer())
  ]);
  const regular = await pdf.embedFont(regularBytes, {subset:false});
  const bold = await pdf.embedFont(boldBytes, {subset:false});
  const logo = await pdf.embedPng(logoBytes);
  const size=[595.28,841.89], margin=45, page=pdf.addPage(size);

  const wrap = (value,maxWidth,fontSize=9,font=regular) => {
    const words=clean(value).split(/\s+/).filter(Boolean), rows=[]; let row="";
    words.forEach(word=>{const next=row?`${row} ${word}`:word;if(font.widthOfTextAtSize(next,fontSize)<=maxWidth)row=next;else{if(row)rows.push(row);row=word;}});
    if(row)rows.push(row); return rows;
  };
  const itemModels=items.map(item=>({
    ...item,
    descriptionRows:wrap(item.description,485,8.4),
    details:[["Material",item.material],["Color",item.colors],["Medidas",item.dimensions],["Terminación",item.finish],["Personalización",item.personalization],["Diseño",item.design_description]].filter(([,v])=>clean(v))
  }));
  const economicRows=[["Subtotal",quote.items_subtotal],["Diseño / modelado",quote.design_fee],["Personalización",quote.personalization_fee],["Extras",quote.extras_fee],["Packaging",quote.packaging_fee],["Envío",quote.shipping_fee],["Otros cargos",quote.other_fee],["Descuento",-Number(quote.discount||0)]].filter(([,v])=>Number(v));
  const conditionModels=[["Producción",quote.production_terms],["Entrega",quote.delivery_terms],["Pago",quote.payment_terms],["Observaciones",quote.observations]].filter(([,v])=>clean(v)).map(([title,value])=>({title,rows:wrap(value,225,8.2)}));
  const clientLines=[quote.client_company,quote.client_phone,quote.client_email].filter(clean);

  // La zona variable se comprime de forma proporcionada para conservar una única A4.
  // El contenido habitual queda al 100%; cotizaciones largas reducen espacios antes que legibilidad.
  const itemHeight=itemModels.reduce((sum,item)=>sum+54+item.descriptionRows.length*11+Math.ceil(item.details.length/2)*14,0);
  const conditionsHeight=conditionModels.length?24+Math.max(1,Math.ceil(conditionModels.length/2))*50:0;
  const estimated=54+clientLines.length*12+30+itemHeight+34+economicRows.length*14+51+conditionsHeight;
  const scale=Math.max(.72,Math.min(1,545/Math.max(545,estimated)));
  const s=value=>value*scale;
  const drawText=(value,x,y,fontSize=9,color=navy,font=regular) => page.drawText(clean(value),{x,y,size:s(fontSize),font,color});
  const drawWrapped=(rows,x,y,fontSize=8.4,color=muted,font=regular,lineHeight=11)=>{rows.forEach(row=>{drawText(row,x,y,fontSize,color,font);y-=s(lineHeight);});return y;};

  page.drawRectangle({x:0,y:820,width:size[0],height:22,color:navy});
  page.drawImage(logo,{x:margin,y:778,width:25,height:25});
  page.drawText("ATRY LAB",{x:80,y:786,size:14,font:bold,color:navy});
  page.drawText("COTIZACIÓN",{x:margin,y:734,size:27,font:bold,color:navy});
  page.drawText(quote.quote_number,{x:margin,y:712,size:11,font:bold,color:cyan});
  page.drawText(`V${quote.version}`,{x:margin+bold.widthOfTextAtSize(quote.quote_number,11)+8,y:712,size:8,font:bold,color:muted});
  page.drawText(`Fecha: ${date(quote.issue_date)}`,{x:389,y:736,size:8.5,font:regular,color:muted});
  page.drawText(`Válida hasta: ${date(quote.valid_until)}`,{x:389,y:719,size:8.5,font:regular,color:muted});
  page.drawLine({start:{x:margin,y:690},end:{x:size[0]-margin,y:690},thickness:1,color:line});

  let y=668;
  const section = title => {drawText(title.toUpperCase(),margin,y,8,cyan,bold);y-=s(18);};
  section("Cliente"); drawText(quote.client_name || request.customer_name,margin,y,12.5,navy,bold); y-=s(16);
  clientLines.forEach(v=>{drawText(v,margin,y,8.3,muted);y-=s(11.5);}); y-=s(9);

  section("Trabajo cotizado");
  itemModels.forEach((item,index)=>{
    page.drawRectangle({x:margin,y:y-s(18),width:505,height:s(24),color:soft});
    drawText(`${String(index+1).padStart(2,"0")}  ${item.product_name}`,margin+10,y-s(10),10.2,navy,bold);
    const subtotal=formatMoney(item.subtotal,quote.currency);
    drawText(subtotal,size[0]-margin-bold.widthOfTextAtSize(subtotal,s(9.5)),y-s(10),9.5,navy,bold); y-=s(31);
    y=drawWrapped(item.descriptionRows,margin,y,8.4,muted,regular,11);
    for(let i=0;i<item.details.length;i+=2){
      item.details.slice(i,i+2).forEach(([label,value],column)=>{
        const x=margin+column*255; drawText(`${label}:`,x,y,6.7,muted,bold); drawText(value,x+110,y,7.6,navy);
      }); y-=s(13);
    }
    drawText(`${item.quantity} ${Number(item.quantity)===1?"unidad":"unidades"}`,margin,y,8.3,navy,bold);
    drawText(`Unitario ${formatMoney(item.unit_price,quote.currency)}`,300,y,8,muted); y-=s(22);
  });

  section("Resumen económico");
  economicRows.forEach(([label,value])=>{drawText(label,315,y,8.1,muted);const amount=formatMoney(value,quote.currency);drawText(amount,size[0]-margin-regular.widthOfTextAtSize(amount,s(8.1)),y,8.1,value<0?rgb(.65,.25,.25):navy);y-=s(13);});
  y-=s(2); page.drawRectangle({x:300,y:y-s(20),width:250,height:s(29),color:navy}); drawText("TOTAL",314,y-s(10),10.5,white,bold);const total=formatMoney(quote.total,quote.currency);drawText(total,535-bold.widthOfTextAtSize(total,s(13.5)),y-s(12),13.5,white,bold);y-=s(45);

  if(conditionModels.length){
    const columns=[margin,310];
    for(let i=0;i<conditionModels.length;i+=2){
      const pair=conditionModels.slice(i,i+2),rowHeight=Math.max(...pair.map(block=>17+block.rows.length*11))+10;
      pair.forEach((block,column)=>{let blockY=y;drawText(block.title.toUpperCase(),columns[column],blockY,7.4,cyan,bold);blockY-=s(15);drawWrapped(block.rows,columns[column],blockY,8,navy,regular,10.5);});
      y-=s(rowHeight);
    }
  }

  const disclaimer="Esta cotización es válida durante el período indicado. Cambios en cantidades, materiales, medidas o diseño pueden requerir una actualización del presupuesto.";
  const disclaimerRows=wrap(disclaimer,485,6.5);
  const disclaimerY=Math.max(79,y-s(9+disclaimerRows.length*9));
  page.drawRectangle({x:margin,y:disclaimerY-7,width:505,height:15+disclaimerRows.length*8,color:soft});
  drawWrapped(disclaimerRows,margin+9,disclaimerY+disclaimerRows.length*8-3,6.5,muted,regular,8);

  page.drawLine({start:{x:margin,y:55},end:{x:size[0]-margin,y:55},thickness:1,color:line});
  page.drawText("ATRY LAB",{x:margin,y:39,size:8.5,font:bold,color:navy});
  page.drawText("Fabricación digital · Impresión 3D",{x:margin,y:26,size:7.4,font:regular,color:muted});
  const website=settings.website || "AtryLab.com";
  page.drawText(website,{x:size[0]-margin-regular.widthOfTextAtSize(website,7.5),y:33,size:7.5,font:regular,color:cyan});

  const bytes=await pdf.save();
  const filename=`ATRY-Cotizacion-${quote.quote_number.split("-").pop()}-${safeName(quote.client_name||request.customer_name)}.pdf`;
  return {bytes,filename};
}
