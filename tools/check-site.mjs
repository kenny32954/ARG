import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root=process.cwd();
const ignore=new Set([".git","node_modules"]);
const files=[];

function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(ignore.has(entry.name)) continue;
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()) walk(full);
    else files.push(full);
  }
}
walk(root);

const rel=p=>path.relative(root,p).replaceAll(path.sep,"/");
const errors=[];

function checkScript(code,label){
  try{new vm.Script(code,{filename:label})}
  catch(err){errors.push(`${label}: JavaScript syntax error: ${err.message}`)}
}

function targetPath(from,url){
  if(!url||url.startsWith("#")||url.startsWith("data:")||url.startsWith("mailto:")||url.startsWith("tel:")||/^[a-z]+:\/\//i.test(url)) return null;
  let clean=url.split("#")[0].split("?")[0];
  if(!clean) return null;
  if(clean==="/ARG/"||clean==="/ARG") clean="index.html";
  else if(clean.startsWith("/ARG/")) clean=clean.slice(5);
  else if(clean.startsWith("/")) return null;
  let dest=clean.startsWith("/")?path.join(root,clean):path.resolve(path.dirname(from),clean);
  if(dest.endsWith(path.sep)||!path.extname(dest)) {
    const index=path.join(dest,"index.html");
    if(fs.existsSync(index)) dest=index;
  }
  return dest;
}

for(const file of files){
  const ext=path.extname(file).toLowerCase();
  if(ext===".js"||ext===".mjs"){
    if(rel(file)!=="tools/check-site.mjs") checkScript(fs.readFileSync(file,"utf8"),rel(file));
  }
  if(ext!==".html") continue;
  const html=fs.readFileSync(file,"utf8");

  for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)){
    const code=match[1].trim();
    if(code) checkScript(code,`${rel(file)} <inline script>`);
  }

  for(const match of html.matchAll(/(?:href|src)=["']([^"']+)["']/gi)){
    const url=match[1],dest=targetPath(file,url);
    if(dest&&!fs.existsSync(dest)) errors.push(`${rel(file)}: broken internal reference "${url}" -> ${rel(dest)}`);
  }
}

if(errors.length){
  console.error("ECHO-1 static validation failed:\n");
  for(const e of errors) console.error(" - "+e);
  process.exit(1);
}

console.log(`ECHO-1 static validation passed: ${files.length} files checked.`);
