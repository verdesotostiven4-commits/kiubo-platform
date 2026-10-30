import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';
import pg from 'pg';
import {localEnvironment} from './hakuna-local-test-env.mjs';

const env=localEnvironment(process.argv[2]),root=path.resolve('products/catalogos/web');
const output='/tmp/hakuna-integration/screenshots';mkdirSync(output,{recursive:true});
const server=http.createServer((req,res)=>{
  let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname==='/')pathname='/index.html';if(['/panel','/pedido'].includes(pathname))pathname+='.html';
  const file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)||!existsSync(file)){res.writeHead(404);res.end();return;}
  const types={'.js':'text/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
  res.setHeader('content-type',types[path.extname(file)]||'application/octet-stream');
  if(pathname==='/config.js'){
    const cfg={...JSON.parse('{}'),supabaseUrl:env.API_URL,publishableKey:env.ANON_KEY,apiUrl:env.API_URL+'/functions/v1/catalog-router',notifyUrl:env.API_URL+'/functions/v1/catalog-notify',defaultSlug:'hakuna-matata',version:'10.20.1',brandLogoUrl:'/assets/hakuna-logo-192.png'};
    // Keep all real application code; replace only isolated URLs/keys and the logo URL.
    let source=readFileSync(file,'utf8');const begin=source.indexOf('Object.freeze('),end=source.indexOf('\n});',begin);
    assert.ok(begin>=0&&end>begin);source=source.slice(0,begin)+'Object.freeze('+JSON.stringify(cfg)+')'+source.slice(end+3);res.end(source);return;
  }
  res.end(readFileSync(file));
});
await new Promise(r=>server.listen(4173,'127.0.0.1',r));
const sql=new pg.Client({connectionString:env.DB_URL});await sql.connect();
const browser=await chromium.launch({headless:true,...(process.env.HAKUNA_CHROMIUM_EXECUTABLE?{executablePath:process.env.HAKUNA_CHROMIUM_EXECUTABLE}:{}),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:900},geolocation:{latitude:-1.6701,longitude:-78.6501},permissions:['geolocation']});
try{
  const page=await context.newPage(),errors=[],tiles=[];
  await context.route('http://kong:8000/**',async route=>{
    const response=await route.fetch({url:route.request().url().replace('http://kong:8000',env.API_URL)});
    await route.fulfill({response});
  });
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.ok()&&/tiles\.openfreemap\.org.*(?:pbf|planet)|tile\.openstreetmap.*\.png/.test(r.url()))tiles.push(r.url())});
  await page.goto('http://localhost:4173/',{waitUntil:'domcontentloaded'});
  await page.locator('button[data-view="catalog"]:visible').first().waitFor({timeout:30000});
  const dismiss=page.getByRole('button',{name:'Ahora no',exact:true});
  if(await dismiss.isVisible().catch(()=>false))await dismiss.click();
  await page.locator('button[data-view="catalog"]:visible').first().click();
  await page.locator('[data-open]:visible').first().waitFor({timeout:30000});
  const products=(await sql.query("select * from public.catalog_products where name in ('Cola editada','Agua integración') order by name")).rows;
  const cola=products.find(x=>x.name==='Cola editada'),agua=products.find(x=>x.name==='Agua integración');
  const ps=(await sql.query('select * from public.catalog_product_presentations where product_id=$1',[cola.id])).rows;
  const unit=ps.find(x=>x.units_per_presentation===1),jaba=ps.find(x=>x.units_per_presentation===9);
  await page.locator(`[data-open="${cola.id}"]:visible`).first().click();
  await page.locator(`[data-pick-plus="${jaba.id}"]`).click();await page.locator(`[data-pick-plus="${unit.id}"]`).click();
  assert.equal(await page.locator(`[data-pick-qty="${jaba.id}"]`).innerText(),'1');
  await page.locator('#detailAdd').click();await page.locator('[data-view="cart"]:visible').first().click();
  await page.locator('#checkoutStart').click();
  await page.locator('#cBusiness').fill('Cliente navegador aislado');await page.locator('#cPhone').fill('0999999999');
  await page.locator('#cAddress').fill('Referencia de prueba ESPOCH');
  const tileLoaded=page.waitForResponse(r=>r.ok()&&/tiles\.openfreemap\.org\/planet\/.*\.pbf|tile\.openstreetmap.*\.png/.test(r.url()),{timeout:30000});
  await page.locator('#locationBtn').click();
  await page.locator('#hmLocMap').waitFor({timeout:25000});
  assert.ok((await page.locator('#hmLocMap').boundingBox()).height>=170,'Dynamically loaded map styles cannot collapse the map canvas');
  await page.waitForFunction(()=>!document.querySelector('#hmLocLoading'),{},{timeout:30000});
  await tileLoaded;
  assert.ok(tiles.length>0,'Real map tiles must load; a simulated map does not pass');
  const canvas=page.locator('#hmLocMap');await canvas.click({position:{x:100,y:100}});
  await page.locator('#hmLocConfirm').click();
  await page.locator('[data-payment="credit"]').click();await page.locator('#reviewOrder').click();
  assert.match(await page.locator('#cartView').innerText(),/Crédito/);
  const response=page.waitForResponse(r=>r.url().endsWith('/catalog-router')&&r.request().postData()?.includes('create_order'));
  await page.locator('#submitOrder').click();const created=await (await response).json();assert.ok(created.order?.id,JSON.stringify(created));
  assert.equal(Number((await sql.query('select stock_quantity from public.catalog_products where id=$1',[cola.id])).rows[0].stock_quantity),12);
  await page.screenshot({path:output+'/customer-desktop.png',fullPage:true});
  await page.goto('http://localhost:4173/panel',{waitUntil:'domcontentloaded'});
  await page.locator('[data-pin="1"]').waitFor();for(const digit of '1234')await page.locator(`[data-pin="${digit}"]`).click();
  await page.locator('#adminApp').waitFor({state:'visible',timeout:25000});
  await page.locator('[data-nav="orders"]:visible').first().click();
  await page.locator(`[data-open-order="${created.order.id}"]:visible`).first().click();
  assert.equal(await page.locator('#orderModal button[aria-label="Cerrar"]:visible').count(),1,'Order detail must have one close button');
  await page.locator('#hmOrderEdit').click();await page.locator('[data-product-select]').selectOption(agua.id);
  await page.locator('[data-add-line]').click();await page.locator('[data-edit-reason]').fill('Agregar agua solicitada por el cliente');
  await page.locator('.hm-order-editor [type="submit"]').click();
  await page.locator('#hmOrderAdvance').waitFor();assert.match(await page.locator('#orderModalContent').innerText(),/Agua integración/);
  assert.match(await page.locator('#hmOrderAdvance').innerText(),/Confirmar pedido/);
  await page.screenshot({path:output+'/order-editor-desktop.png',fullPage:true});
  await page.locator('#orderModal [data-close-modal]').click();
  await page.locator('[data-nav="products"]:visible').first().click();
  await page.locator(`[data-edit-product="${cola.id}"]:visible`).first().click();
  await page.locator('#productName').fill('Cola verificada en navegador');
  await page.locator('#productImage').setInputFiles('products/catalogos/web/assets/hakuna-logo-192.png');
  await page.locator('#saveProductBtn').click();await page.locator('#productModal').waitFor({state:'hidden',timeout:30000});
  await page.reload({waitUntil:'domcontentloaded'});await page.locator('#adminApp').waitFor({state:'visible'});
  assert.ok((await sql.query('select image_path from public.catalog_products where id=$1',[cola.id])).rows[0].image_path);
  for(const [width,height] of [[390,844],[1366,650]]){
    await page.setViewportSize({width,height});await page.goto('http://localhost:4173/',{waitUntil:'domcontentloaded'});
    await page.locator('button[data-view="catalog"]:visible').first().click();
    await page.locator('[data-open]:visible').first().waitFor();
    await page.screenshot({path:output+`/customer-${width}.png`,fullPage:true});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'No horizontal page overflow');
  }
  const manifest=await (await fetch('http://localhost:4173/manifest.webmanifest')).json();assert.ok(manifest.icons.some(x=>x.src.includes('hakuna-logo-512.png')));
  assert.deepEqual(errors,[],'No uncaught browser application errors');
  console.log('✓ Real Chromium desktop/mobile: mixed cart, real map tiles, location, credit checkout, admin edit/add, one close button, photo save/reload, responsive and PWA logo.');
}finally{await context.close();await browser.close();await sql.end();await new Promise(r=>server.close(r))}
