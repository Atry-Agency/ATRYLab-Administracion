import test from "node:test";
import assert from "node:assert/strict";
import {featuredUpdates,moveFeatured,orderedFeatured} from "../src/featured.js";

const rows=[
  {id:"a",name:"A",active:true,publication_status:"published",featured:true,sort_order:10,settings:{icon:"ph-cube"}},
  {id:"b",name:"B",active:true,publication_status:"published",featured:true,sort_order:20,settings:{icon:"ph-star",featured_order:5}},
  {id:"c",name:"C",active:true,publication_status:"published",featured:false,sort_order:30,settings:{}},
  {id:"d",name:"D",active:false,publication_status:"draft",featured:true,sort_order:1,settings:{}}
];

test("destacados usan orden propio y excluyen borradores",()=>{
  assert.deepEqual(orderedFeatured(rows).map(item=>item.id),["b","a"]);
});

test("mover conserva todos los productos sin duplicar",()=>{
  assert.deepEqual(moveFeatured(["a","b","c"],"c",0),["c","a","b"]);
  assert.deepEqual(moveFeatured(["a","b"],"x",0),["a","b"]);
});

test("guardar preserva otros ajustes y no modifica borradores",()=>{
  const updates=featuredUpdates(rows,["c","a"]);
  assert.deepEqual(updates.map(item=>item.id),["a","b","c"]);
  assert.deepEqual(updates.find(item=>item.id==="a").settings,{icon:"ph-cube",featured_order:20});
  assert.equal(updates.find(item=>item.id==="b").featured,false);
  assert.equal(updates.find(item=>item.id==="c").settings.featured_order,10);
  assert.throws(()=>featuredUpdates(rows,["d"]),/catálogo cambió/i);
});
