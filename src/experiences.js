export const defaultExperiences = {
  eyebrow: "EXPERIENCIAS ATRY",
  title: "Ideas que ya tomaron forma.",
  cards: [
    {id:"llaveros",image:"recursos/imagenes/productos/llaveros.png",rating:4,quote:"Pedimos una tanda de llaveros para acompañar nuestros pedidos. Quedaron prolijos, resistentes y cada diseño se distinguía muy bien.",client:"Emprendimiento local",product:"Llaveros personalizados"},
    {id:"trofeos",image:"recursos/imagenes/productos/trofeos-atry.png",rating:4.5,quote:"Necesitábamos un trofeo especial para un torneo y nos ayudaron a llevar la idea a una pieza real. El resultado superó lo que imaginábamos.",client:"Organización de torneo",product:"Trofeo personalizado"},
    {id:"porta-qr",image:"recursos/imagenes/productos/porta-qr-atry.png",rating:5,quote:"El porta QR quedó firme, fácil de limpiar y combinó perfecto con el mostrador. La atención fue clara desde el principio.",client:"Comercio gastronómico",product:"Porta QR para mostrador"},
    {id:"souvenirs",image:"recursos/imagenes/productos/souvenirs-atry.png",rating:4.5,quote:"Los souvenirs del bautismo quedaron delicados y tal como los habíamos pensado. Además, estuvieron prontos para la fecha acordada.",client:"Bautismo familiar",product:"Souvenirs para bautismo"}
  ]
};

export function normalizeExperiences(value){
  if(!value || !Array.isArray(value.cards))return structuredClone(defaultExperiences);
  return {
    eyebrow:String(value.eyebrow||""),title:String(value.title||""),
    cards:value.cards.filter(card=>card&&typeof card==="object").map(card=>({
      id:String(card.id||""),image:String(card.image||""),rating:Math.min(5,Math.max(0,Number(card.rating)||0)),
      quote:String(card.quote||""),client:String(card.client||""),product:String(card.product||"")
    }))
  };
}
