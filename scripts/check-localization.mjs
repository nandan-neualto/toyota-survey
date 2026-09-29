import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
const require=createRequire(import.meta.url);
const memo=new Map();
function load(file){
  file=path.resolve(file);
  if(memo.has(file))return memo.get(file);
  const js=ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const m={exports:{}};
  new Function("require","module","exports",js)((id)=>id.startsWith(".")?load(path.resolve(path.dirname(file),id+".ts")):require(id),m,m.exports);
  memo.set(file,m.exports);return m.exports;
}
const {translations,formatMessage}=load("lib/i18n.ts");
const {feedbackSchema,highlights}=load("lib/survey.ts");
for(const language of ["en","ja","kn"]){
 const t=translations[language];
 assert.deepEqual(Object.keys(t).sort(),Object.keys(translations.en).sort());
 assert.deepEqual(Object.keys(t.highlights).sort(),[...highlights].sort());
 for(const [key,value] of Object.entries(t)){
   const source=translations.en[key];
   if(typeof value==="string"){
     assert(value.trim(),language+"."+key);
     assert.deepEqual(value.match(/\{\w+\}/g)||[],source.match(/\{\w+\}/g)||[],key);
   }else if(Array.isArray(value))assert.equal(value.length,source.length,key);
 }
 const payload={id:crypto.randomUUID(),kioskId:"local-language-check",kioskName:"Language check",surveyVersion:1,language,createdAt:new Date().toISOString(),overall:5,presentation:4,informative:4,highlights:["History & heritage","Other"],other:"日本語と ಕನ್ನಡ",recommendation:"yes",comment:"テスト — ಕನ್ನಡ ಪರೀಕ್ಷೆ"};
 const decoded=feedbackSchema.parse(JSON.parse(JSON.stringify(payload)));
 assert.deepEqual(decoded,payload);
 assert(!feedbackSchema.safeParse({...payload,language:"fr"}).success);
 assert(!feedbackSchema.safeParse({...payload,language:"ja-JP"}).success);
 assert(!feedbackSchema.safeParse({...payload,highlights:[t.highlights.Other==="Other"?"Unsupported":t.highlights.Other]}).success);
 assert.equal(formatMessage(t.step,{step:2}).includes("{step}"),false);
}
console.log("PASS: Complete translations, placeholders, answer keys, supported languages, and Unicode payloads.");

