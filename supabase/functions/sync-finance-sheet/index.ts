import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Content-Type":"application/json"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const b64url=(value:string|ArrayBuffer)=>{
  const bytes=typeof value==="string"?new TextEncoder().encode(value):new Uint8Array(value);
  let binary="";for(const byte of bytes)binary+=String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
};
const pemBytes=(pem:string)=>{
  const body=pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,"");
  const binary=atob(body);return Uint8Array.from(binary,char=>char.charCodeAt(0)).buffer;
};

async function googleToken(serviceAccount:{client_email:string;private_key:string}){
  const now=Math.floor(Date.now()/1000),header=b64url(JSON.stringify({alg:"RS256",typ:"JWT"})),claims=b64url(JSON.stringify({iss:serviceAccount.client_email,scope:"https://www.googleapis.com/auth/spreadsheets",aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3600}));
  const unsigned=`${header}.${claims}`,key=await crypto.subtle.importKey("pkcs8",pemBytes(serviceAccount.private_key),{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
  const signature=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,new TextEncoder().encode(unsigned)),assertion=`${unsigned}.${b64url(signature)}`;
  const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion})});
  const payload=await response.json();if(!response.ok)throw new Error(payload.error_description||"Google no autorizó la cuenta de servicio");return payload.access_token as string;
}

const sheetStatus=(status:string)=>({approved:"Pendiente",printing:"En producción",ready:"Listo",delivered:"Entregado",cancelled:"Cancelado"}[status]||"Pendiente");
const encodeRange=(value:string)=>encodeURIComponent(value);

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  let requestId="",action="upsert";
  try{
    const body=await req.json();requestId=String(body.request_id||"");action=String(body.action||"upsert");
    if(!requestId||!["upsert","cancel","delete","setup"].includes(action))return json({error:"Solicitud o acción inválida"},400);
    const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,authorization=req.headers.get("Authorization")||"";
    const userClient=createClient(url,anon,{global:{headers:{Authorization:authorization}}}),{data:{user},error:userError}=await userClient.auth.getUser();if(userError||!user)return json({error:"Sesión inválida"},401);
    const admin=createClient(url,serviceKey),{data:profile}=await admin.from("profiles").select("role,active").eq("id",user.id).single();
    if(!profile?.active||!["owner","operator"].includes(profile.role))return json({error:"No tenés permisos para sincronizar"},403);
    if(action==="delete"&&profile.role!=="owner")return json({error:"Sólo el propietario puede eliminar filas"},403);
    const serviceAccount=JSON.parse(Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON")||"{}"),token=await googleToken(serviceAccount);
    const {data:settings}=await admin.from("app_settings").select("value").eq("key","cost_parameters").maybeSingle(),sheetId=settings?.value?.finance_sheet_id||Deno.env.get("GOOGLE_SHEET_ID"),sheetName=settings?.value?.finance_sheet_name||"VENTAS";
    if(!sheetId)throw new Error("Falta configurar el ID de Google Sheet");
    const api=`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`,headers={Authorization:`Bearer ${token}`,"Content-Type":"application/json"};
    const values=async(range:string)=>{const response=await fetch(`${api}/values/${encodeRange(range)}`,{headers});const payload=await response.json();if(!response.ok)throw new Error(payload.error?.message||"No se pudo leer Google Sheets");return payload.values||[];};
    const update=async(range:string,rows:unknown[][])=>{const response=await fetch(`${api}/values/${encodeRange(range)}?valueInputOption=USER_ENTERED`,{method:"PUT",headers,body:JSON.stringify({range,majorDimension:"ROWS",values:rows})});const payload=await response.json();if(!response.ok)throw new Error(payload.error?.message||"No se pudo actualizar Google Sheets");return payload;};
    const batch=async(requests:unknown[])=>{const response=await fetch(`${api}:batchUpdate`,{method:"POST",headers,body:JSON.stringify({requests})});const payload=await response.json();if(!response.ok)throw new Error(payload.error?.message||"No se pudo modificar Google Sheets");return payload;};

    await update(`${sheetName}!U1:W1`,[["Costo calculado por el panel","ID interno ATRY","Última sincronización"]]);
    await update(`${sheetName}!K2`,[[`=ARRAYFORMULA(IF(A2:A1000="",,IF(U2:U1000<>"",U2:U1000,IFNA(F2:F1000*VLOOKUP(D2:D1000,PRODUCTOS!A:I,9,FALSE),""))))`]]);
    await Promise.all([
      update("RESUMEN!B4",[[`=SUMIFS(VENTAS!J2:J1000,VENTAS!T2:T1000,"<>Cancelado")`]]),
      update("RESUMEN!B6:B8",[[`=SUMIFS(VENTAS!K2:K1000,VENTAS!T2:T1000,"<>Cancelado")`],[`=SUMIFS(VENTAS!L2:L1000,VENTAS!T2:T1000,"<>Cancelado")`],[`=SUMIFS(VENTAS!N2:N1000,VENTAS!T2:T1000,"<>Cancelado")-SUM(GASTOS!G2:G1000)`]]),
      update("RESUMEN!B13",[[`=SUMIFS(VENTAS!S2:S1000,VENTAS!T2:T1000,"<>Cancelado")`]]),
      update("RESUMEN!B14",[[`=SUMIFS(VENTAS!N2:N1000,VENTAS!B2:B1000,">="&EOMONTH(TODAY(),-1)+1,VENTAS!B2:B1000,"<"&EOMONTH(TODAY(),0)+1,VENTAS!T2:T1000,"<>Cancelado")-SUMIFS(GASTOS!G2:G1000,GASTOS!B2:B1000,">="&EOMONTH(TODAY(),-1)+1,GASTOS!B2:B1000,"<"&EOMONTH(TODAY(),0)+1)`]])
    ]);
    const monthly=Array.from({length:12},(_,index)=>{const row=16+index;return[
      `=SUMIFS(VENTAS!J2:J1000,VENTAS!B2:B1000,">="&A${row},VENTAS!B2:B1000,"<"&EDATE(A${row},1),VENTAS!T2:T1000,"<>Cancelado")`,
      `=SUMIFS(GASTOS!G2:G1000,GASTOS!B2:B1000,">="&A${row},GASTOS!B2:B1000,"<"&EDATE(A${row},1))`,
      `=SUMIFS(VENTAS!K2:K1000,VENTAS!B2:B1000,">="&A${row},VENTAS!B2:B1000,"<"&EDATE(A${row},1),VENTAS!T2:T1000,"<>Cancelado")`,
      `=SUMIFS(VENTAS!N2:N1000,VENTAS!B2:B1000,">="&A${row},VENTAS!B2:B1000,"<"&EDATE(A${row},1),VENTAS!T2:T1000,"<>Cancelado")-SUMIFS(GASTOS!G2:G1000,GASTOS!B2:B1000,">="&A${row},GASTOS!B2:B1000,"<"&EDATE(A${row},1))`
    ];});
    await update("RESUMEN!B16:E27",monthly);
    const rows=await values(`${sheetName}!A2:W1000`),externalKey=`ATRY:${requestId}`;let rowIndex=rows.findIndex((row:unknown[])=>String(row[21]||"")===externalKey);let sheetRow=rowIndex>=0?rowIndex+2:-1;
    if(sheetRow<0){const empty=rows.findIndex((row:unknown[])=>!String(row[0]||"").trim());sheetRow=(empty>=0?empty:rows.length)+2;}

    if(action==="delete"){
      if(rowIndex<0)throw new Error("No encontramos la fila vinculada en Google Sheets");
      const metaResponse=await fetch(`${api}?fields=sheets.properties`,{headers}),meta=await metaResponse.json();const sheet=meta.sheets?.find((item:{properties:{title:string}})=>item.properties.title===sheetName);if(!sheet)throw new Error("No encontramos la pestaña de ventas");
      await batch([{deleteDimension:{range:{sheetId:sheet.properties.sheetId,dimension:"ROWS",startIndex:sheetRow-1,endIndex:sheetRow}}}]);
      await admin.from("finance_sync_records").upsert({request_id:requestId,sheet_id:sheetId,sheet_name:sheetName,external_key:externalKey,sync_status:"deleted",last_action:"delete",sheet_row:null,deleted_at:new Date().toISOString(),updated_at:new Date().toISOString(),created_by:user.id},{onConflict:"request_id"});
      return json({ok:true,action,row:sheetRow});
    }

    if(action==="cancel"){
      if(rowIndex<0)throw new Error("No encontramos la fila vinculada en Google Sheets");await update(`${sheetName}!T${sheetRow}`,[["Cancelado"]]);
      await admin.from("finance_sync_records").upsert({request_id:requestId,sheet_id:sheetId,sheet_name:sheetName,external_key:externalKey,sync_status:"cancelled",last_action:"cancel",sheet_row:sheetRow,cancelled_at:new Date().toISOString(),synced_at:new Date().toISOString(),updated_at:new Date().toISOString(),created_by:user.id},{onConflict:"request_id"});
      return json({ok:true,action,row:sheetRow});
    }

    const [{data:request,error:requestError},{data:quotes},{data:estimate}]=await Promise.all([
      admin.from("requests").select("*").eq("id",requestId).single(),admin.from("quotes").select("*").eq("request_id",requestId).order("version",{ascending:false}),admin.from("cost_estimates").select("*").eq("request_id",requestId).eq("status","active").order("version",{ascending:false}).limit(1).maybeSingle()
    ]);
    if(requestError||!request)throw new Error("No encontramos la solicitud");const quote=(quotes||[]).find((item:{status:string})=>item.status==="accepted")||(quotes||[]).find((item:{status:string})=>item.status!=="replaced");if(!quote)throw new Error("La solicitud todavía no tiene una cotización");if(!estimate)throw new Error("La solicitud todavía no tiene un costo calculado");
    const {data:items}=await admin.from("quote_items").select("*").eq("quote_id",quote.id).order("sort_order");const product=(items||[]).length===1?items![0].product_name:`Pedido mixto · ${(items||[]).map((item:{product_name:string})=>item.product_name).join(", ")}`;
    const quantity=(items||[]).length===1?Number(items![0].quantity||1):1,basePrice=(items||[]).length===1?Number(items![0].unit_price||0):Number(quote.total||0)+Number(quote.discount||0)-Number(quote.shipping_fee||0),now=new Date().toISOString();
    await Promise.all([
      update(`${sheetName}!A${sheetRow}:I${sheetRow}`,[[request.id,String(quote.accepted_at||quote.issue_date||now).slice(0,10),request.customer_name,product,request.category||"Otros",quantity,basePrice,Number(quote.discount||0),Number(quote.shipping_fee||0)]]),
      update(`${sheetName}!T${sheetRow}:W${sheetRow}`,[[sheetStatus(request.status),Number(estimate.total_cost||0),externalKey,now]])
    ]);
    if(rowIndex<0&&quote.payment_method)await update(`${sheetName}!P${sheetRow}`,[[quote.payment_method]]);
    await admin.from("finance_sync_records").upsert({request_id:requestId,quote_id:quote.id,sheet_id:sheetId,sheet_name:sheetName,external_key:externalKey,sheet_row:sheetRow,sync_status:"synced",last_action:"upsert",last_error:null,synced_at:now,updated_at:now,created_by:user.id},{onConflict:"request_id"});
    return json({ok:true,action,row:sheetRow,external_key:externalKey});
  }catch(error){
    try{if(requestId){const url=Deno.env.get("SUPABASE_URL")!,serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,admin=createClient(url,serviceKey);await admin.from("finance_sync_records").upsert({request_id:requestId,sheet_id:Deno.env.get("GOOGLE_SHEET_ID")||"pending",sheet_name:"VENTAS",external_key:`ATRY:${requestId}`,sync_status:"error",last_action:action,last_error:error instanceof Error?error.message:String(error),updated_at:new Date().toISOString()},{onConflict:"request_id"});}}catch{/* conserva el error original */}
    return json({error:error instanceof Error?error.message:String(error)},500);
  }
});
