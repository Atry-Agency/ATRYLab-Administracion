import test from "node:test";
import assert from "node:assert/strict";
import {normalizeSiteTheme,effectiveSiteTheme} from "../src/site-theme.js";

test("Original no recibe sobrescrituras",()=>{
  const config=normalizeSiteTheme({selected:"original",campaigns:{original:{line_1:"Otro título"}}});
  assert.equal(config.selected,"original");
  assert.equal(config.campaigns.original,undefined);
  assert.equal(effectiveSiteTheme(config),"original");
});

test("una campaña sin textos ni destacados sigue siendo estética",()=>{
  const config=normalizeSiteTheme({selected:"valentines"});
  assert.equal(effectiveSiteTheme(config),"valentines");
  assert.deepEqual(config.campaigns.valentines.featured_ids,[]);
  assert.equal(config.campaigns.valentines.line_1,"");
});

test("programación vuelve a Original antes y después del período",()=>{
  const config={selected:"christmas",starts_at:"2026-12-01T00:00:00.000Z",ends_at:"2026-12-27T00:00:00.000Z"};
  assert.equal(effectiveSiteTheme(config,Date.parse("2026-11-30T23:00:00Z")),"original");
  assert.equal(effectiveSiteTheme(config,Date.parse("2026-12-24T12:00:00Z")),"christmas");
  assert.equal(effectiveSiteTheme(config,Date.parse("2026-12-27T00:00:00Z")),"original");
});
