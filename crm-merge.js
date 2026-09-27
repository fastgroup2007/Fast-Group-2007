/* Three-way record merge. Remote-only records and unknown fields survive updates. */
(function(root){
  const copy=x=>JSON.parse(JSON.stringify(x));
  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  function merge(base, local, remote){
    if(equal(base,local)) return copy(remote === undefined ? local : remote);
    if(Array.isArray(local)){
      if(!local.every(x=>x && typeof x==='object' && x.id) ||
         (Array.isArray(remote) && !remote.every(x=>x && typeof x==='object' && x.id))) return copy(local);
      const old=new Map((Array.isArray(base)?base:[]).map(x=>[x.id,x]));
      const next=new Map((Array.isArray(remote)?remote:[]).map(x=>[x.id,x]));
      const ids=new Set(local.map(x=>x.id));
      // Only an explicit removal relative to a known baseline is a deletion.
      for(const id of old.keys()) if(!ids.has(id)) next.delete(id);
      for(const item of local){
        if(old.has(item.id) && equal(item,old.get(item.id))) continue;
        next.set(item.id,merge(old.get(item.id),item,next.get(item.id)));
      }
      return [...next.values()].map(copy);
    }
    if(local && typeof local==='object'){
      const result={...(remote||{})};
      for(const key of Object.keys(local)){
        if(!base || !equal(base[key],local[key])) result[key]=merge(base?.[key],local[key],remote?.[key]);
      }
      return result;
    }
    return local;
  }
  root.mergeCrmChanges=merge;
  if(typeof module!=='undefined') module.exports={mergeCrmChanges:merge};
})(globalThis);
