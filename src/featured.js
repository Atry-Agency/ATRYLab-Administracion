export const isPublicProduct = item => item?.active !== false && (item?.publication_status || (item?.active ? "published" : "draft")) !== "draft";

export const featuredRank = item => {
  const value = item?.settings?.featured_order;
  return value !== null && value !== undefined && Number.isFinite(Number(value))
    ? Number(value)
    : Number(item?.sort_order || 0);
};

export function orderedFeatured(items){
  return items.filter(item => isPublicProduct(item) && item.featured).sort((a,b) =>
    featuredRank(a)-featuredRank(b) || Number(a.sort_order||0)-Number(b.sort_order||0) || String(a.name||"").localeCompare(String(b.name||""),"es")
  );
}

export function moveFeatured(ids,id,to){
  const from=ids.indexOf(id);
  if(from<0)return ids;
  const result=[...ids];result.splice(from,1);result.splice(Math.max(0,Math.min(to,result.length)),0,id);
  return result;
}

export function featuredUpdates(rows,ids){
  const publicRows=rows.filter(isPublicProduct),publicIds=new Set(publicRows.map(item=>item.id));
  if(ids.some(id=>!publicIds.has(id))||new Set(ids).size!==ids.length)throw new Error("El catálogo cambió. Recargá antes de guardar los destacados.");
  const positions=new Map(ids.map((id,index)=>[id,(index+1)*10]));
  return publicRows.flatMap(item=>{
    const selected=positions.has(item.id),settings={...(item.settings||{})};
    if(selected)settings.featured_order=positions.get(item.id);
    else delete settings.featured_order;
    if(Boolean(item.featured)===selected && JSON.stringify(item.settings||{})===JSON.stringify(settings))return [];
    return [{id:item.id,featured:selected,settings}];
  });
}
