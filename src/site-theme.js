export const siteThemePresets=[
  {id:"original",name:"Original ATRY",description:"La web tal como está hoy.",icon:"ph-sparkle",colors:["#faf9f7","#181719","#00a5e2"]},
  {id:"valentines",name:"San Valentín",description:"Cálido, delicado y romántico.",icon:"ph-heart",colors:["#fff9fb","#181719","#a6325e"]},
  {id:"halloween",name:"Halloween",description:"Ámbar, creativo y elegante.",icon:"ph-moon-stars",colors:["#fcf9f4","#181719","#a34d16"]},
  {id:"christmas",name:"Navidad",description:"Festivo, luminoso y sobrio.",icon:"ph-star",colors:["#f8fbf8","#181719","#246b54"]}
];

const campaign=()=>({line_1:"",line_2:"",description:"",featured_ids:[]});
const themes=siteThemePresets.filter(preset=>preset.id!=="original");
export function normalizeSiteTheme(raw){
  const source=raw&&typeof raw==="object"?raw:{};
  const selected=siteThemePresets.some(preset=>preset.id===source.selected)?source.selected:"original";
  const campaigns=Object.fromEntries(themes.map(preset=>{
    const item=source.campaigns?.[preset.id]||{};
    return [preset.id,{
      line_1:String(item.line_1||"").trim().slice(0,70),
      line_2:String(item.line_2||"").trim().slice(0,70),
      description:String(item.description||"").trim().slice(0,220),
      featured_ids:[...new Set((Array.isArray(item.featured_ids)?item.featured_ids:[]).filter(id=>typeof id==="string"))].slice(0,8)
    }];
  }));
  return {selected,starts_at:typeof source.starts_at==="string"?source.starts_at:"",ends_at:typeof source.ends_at==="string"?source.ends_at:"",campaigns};
}

export function effectiveSiteTheme(raw,now=Date.now()){
  const config=normalizeSiteTheme(raw);
  if(config.selected==="original")return "original";
  if(config.starts_at&&(!Number.isFinite(Date.parse(config.starts_at))||now<Date.parse(config.starts_at)))return "original";
  if(config.ends_at&&(!Number.isFinite(Date.parse(config.ends_at))||now>=Date.parse(config.ends_at)))return "original";
  return config.selected;
}

export const emptySiteThemeCampaign=campaign;
