import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createOpenApi, operations, responseExamples, sampleProduct, sampleScenario } from '../lib/integration/openapi';
import * as c from '../lib/integration/contracts';
import { artifactResponse } from '../lib/integration/public-artifacts';
import { llmsIndex } from '../lib/integration/docs-content';

test('public request contracts reject unknown fields, duplicate identities and invalid fee state', () => {
  assert.equal(c.productBatchSchema.safeParse({products:[sampleProduct]}).success,true);
  assert.equal(c.productBatchSchema.safeParse({products:[sampleProduct,sampleProduct]}).success,false);
  assert.equal(c.productBatchSchema.safeParse({products:[{...sampleProduct,storeId:'foreign'}]}).success,false);
  assert.equal(c.productBatchSchema.safeParse({products:[{...sampleProduct,sourceVersion:Number.MAX_SAFE_INTEGER+1}]}).success,false);
  assert.equal(c.productBatchSchema.safeParse({products:[{...sampleProduct,externalId:' SKU'}]}).success,false);
  assert.equal(c.analysisRequestSchema.safeParse({scenario:sampleScenario}).success,true);
  assert.equal(c.analysisRequestSchema.safeParse({scenario:{...sampleScenario,feeEnabled:false}}).success,false);
  const {barcode,...withoutBarcode}=sampleProduct; void barcode;
  assert.equal(c.productInputSchema.parse(withoutBarcode).barcode,null);
});
test('OpenAPI describes all nine operations with valid references and runtime-valid examples', () => {
  const spec=createOpenApi();assert.equal(spec.openapi,'3.1.1');
  assert.equal(operations.length,9);assert.equal(new Set(operations.map(op=>op.operationId)).size,9);
  const mapping={Me:c.meSchema,BatchResult:c.batchResultSchema,Product:c.productSchema,ProductPage:c.productPageSchema,ChangePage:c.changePageSchema,AnalysisAccepted:c.analysisAcceptedSchema,Analysis:c.analysisSchema,AnalysisPage:c.analysisPageSchema,AnalysisItemsPage:c.analysisItemsPageSchema};
  for(const [name,schema] of Object.entries(mapping)) assert.equal(schema.safeParse(responseExamples[name]).success,true,`${name} example matches runtime`);
  function walk(value: unknown) { if(!value||typeof value!=='object')return;for(const [key,entry]of Object.entries(value)){if(key==='$ref'){assert.equal(typeof entry,'string');const name=String(entry).replace('#/components/schemas/','');assert.ok(name in spec.components.schemas,`resolved ${entry}`);}else walk(entry);} }
  walk(spec);
  for(const op of operations){const operation=spec.paths[op.path][op.method] as { security: unknown[]; 'x-required-scopes':string[] };assert.ok(operation.security.length);assert.deepEqual(operation['x-required-scopes'],op.scope?[op.scope]:[]);}
});
test('published contract and downloadable skill have no release drift', () => {
  assert.equal(readFileSync('public/docs/api/v1/openapi.json','utf8'),JSON.stringify(createOpenApi(),null,2)+'\n');
  const metadata=JSON.parse(readFileSync('public/downloads/raio-x-margem-api-skill.json','utf8'));
  const bytes=readFileSync('public/downloads/raio-x-margem-api-skill.zip');
  assert.equal(metadata.contractVersion,c.API_VERSION);assert.equal(metadata.bytes,bytes.length);
  assert.equal(metadata.sha256,createHash('sha256').update(bytes).digest('hex'));
  assert.deepEqual(bytes,readFileSync('public'+metadata.file));
});
test('public artifacts support cross-origin discovery and conditional ETag revalidation', async()=>{
  const request=new Request('http://127.0.0.1:3103/llms.txt');
  const text=llmsIndex(new URL(request.url).origin);
  assert.match(text,/http:\/\/127\.0\.0\.1:3103\/docs\/api\/quickstart\.md/);
  const first=artifactResponse(request,text,'text/plain');assert.equal(first.status,200);assert.equal(first.headers.get('access-control-allow-origin'),'*');
  const second=artifactResponse(new Request(request.url,{headers:{'If-None-Match':first.headers.get('etag')!}}),text,'text/plain');assert.equal(second.status,304);assert.equal(await second.text(),'');
});
