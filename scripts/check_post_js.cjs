const fs=require('fs');
const path='js/post.js';
const s=fs.readFileSync(path,'utf8');
const total=(s.match(/`/g)||[]).length;
console.log('total backticks:',total);
const lines=s.split('\n');
for(let i=0;i<lines.length;i++){const c=(lines[i].match(/`/g)||[]).length;if(c%2!==0)console.log('odd backticks on line',i+1,'count',c)}

function simpleBalance(str){
  const opens=[];
  const pairs={'}':'{',')':'(',']':'['};
  for(let i=0;i<str.length;i++){
    const ch=str[i];
    if(ch==='{'||ch==='('||ch==='[') opens.push({ch,i});
    else if(ch==='}'||ch===')'||ch===']'){
      const last=opens.pop();
      if(!last) return {type:'unmatched_close',ch,i};
      if(last.ch!==pairs[ch]) return {type:'mismatch',open:last,ch,i};
    }
  }
  return {type:'ok',remaining:opens.length,remainingTop:opens.slice(-5)};
}
console.log(simpleBalance(s));
// If there's a remaining open brace, show its line/column for convenience
const res = simpleBalance(s);
if (res.type === 'ok' && res.remaining && res.remainingTop && res.remainingTop.length) {
  const last = res.remainingTop[res.remainingTop.length-1];
  const upTo = s.slice(0, last.i);
  const line = upTo.split('\n').length;
  const col = last.i - upTo.lastIndexOf('\n');
  console.log('last open brace at index', last.i, 'line', line, 'col', col);
}
