import test from "node:test";
import assert from "node:assert/strict";
import {defaultExperiences,normalizeExperiences} from "../src/experiences.js";

test("conserva las cuatro historias actuales mientras no se editen",()=>{
  const value=normalizeExperiences();
  assert.equal(value.cards.length,4);
  assert.equal(value.title,"Ideas que ya tomaron forma.");
  value.cards.pop();
  assert.equal(defaultExperiences.cards.length,4);
});

test("permite vaciar la sección sin recuperar las historias predeterminadas",()=>{
  assert.deepEqual(normalizeExperiences({eyebrow:"Historias",title:"Nuestras piezas",cards:[]}),{eyebrow:"Historias",title:"Nuestras piezas",cards:[]});
});

test("limita la valoración y conserva el orden recibido",()=>{
  const value=normalizeExperiences({eyebrow:"A",title:"B",cards:[{id:"b",rating:8},{id:"a",rating:-1}]});
  assert.deepEqual(value.cards.map(card=>card.id),["b","a"]);
  assert.deepEqual(value.cards.map(card=>card.rating),[5,0]);
});
