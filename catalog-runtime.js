/* Model-specific catalog data and conservative migration, 2026-10-21. */
(function(){
  'use strict';
  const data=window.FG_CATALOG_DATA;
  if(!data || typeof defaultProducts==='undefined') return;
  const clone=v=>JSON.parse(JSON.stringify(v));
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const key=p=>[p.brand,String(p.model||'').toUpperCase().replace(/\s+/g,''),p.hp??''].join('|');
  const oldDefaults=clone(defaultProducts);
  const core=oldDefaults.filter(p=>!String(p.id).startsWith('catalog-')).map(p=>({...p,gallery:[p.img].filter(Boolean)}));
  const defaults=[...core,...data.products];
  defaultProducts.splice(0,defaultProducts.length,...clone(defaults));
  const legacy=[...data.legacy,...(data.history||[]),...oldDefaults];
  const byKey=new Map(defaults.map(p=>[key(p),p]));
  const byId=new Map(defaults.map(p=>[String(p.id),p]));
  const legacyCore=new Set(core.map(key));
  const deletionKey='fg_catalog_deleted_models_v1';
  const readJson=(k,f)=>{try{const value=JSON.parse(localStorage.getItem(k)||'null');return Array.isArray(value)?value:f;}catch{return f;}};
  function merge(saved){
    if(!Array.isArray(saved))return clone(defaults);
    const deleted=new Set(readJson(deletionKey,[]));
    const deletedIds=new Set(readJson('fg_product_deletes_v1',[]).map(String));
    const seen=new Set();
    const result=saved.filter(p=>p&&typeof p==='object').map(p=>{
      // Match the model first: old releases used different numeric IDs.
      let current=byKey.get(key(p));
      if(!current && String(p.id).startsWith('catalog-'))current=byId.get(String(p.id));
      if(!current)return clone(p);
      seen.add(key(current));
      const previous=p._catalogBaseline ? [p._catalogBaseline] : legacy.filter(x=>key(x)===key(p)||(String(x.id).startsWith('catalog-')&&x.id===p.id));
      // A changed model/brand/capacity is an owner's replacement, not an old default to repair.
      if(key(p)!==key(current)&&!previous.some(old=>key(old)===key(p)))return clone(p);
      const next=clone(p);
      for(const [field,value] of Object.entries(current)){
        if(field==='id')continue;
        if(p[field]===undefined || previous.some(old=>same(p[field],old[field])))next[field]=clone(value);
      }
      // A manually changed main photo takes precedence over an untouched legacy gallery.
      const customImage=p.img && previous.length && previous.every(old=>p.img!==old.img);
      if(customImage && previous.some(old=>same(p.gallery,old.gallery)))next.gallery=[p.img];
      if(!next.refrigerant || String(next.refrigerant).includes('غير مذكور'))next.refrigerant=current.refrigerant||'R410A';
      next._catalogBaseline=clone(current);
      return next;
    }).filter(p=>!deleted.has(key(p))&&!deletedIds.has(String(p.id)));
    for(const p of defaults){
      // Missing original products may have been intentionally deleted before tombstones existed.
      if(seen.has(key(p))||deleted.has(key(p))||deletedIds.has(String(p.id))||(saved.length&&legacyCore.has(key(p))))continue;
      result.push({...clone(p),_catalogBaseline:clone(p)});
    }
    return result;
  }
  function recordDelete(p){
    const deleted=new Set(readJson(deletionKey,[]));deleted.add(key(p));
    localStorage.setItem(deletionKey,JSON.stringify([...deleted]));
  }
  function load(){
    let raw;
    try{raw=localStorage.getItem(STORAGE_KEYS.products);}catch{products=clone(defaults);return;}
    let saved;
    try{saved=raw?JSON.parse(raw):null;}catch{
      products=clone(defaults);
      console.warn('Catalog storage is invalid; original data retained without overwriting.');return;
    }
    if(raw&&!Array.isArray(saved)){products=clone(defaults);console.warn('Catalog storage has an invalid shape; original retained.');return;}
    products=saved?merge(saved):clone(defaults);
    if(raw&&JSON.stringify(products)!==raw){
      try{
        const backup='fg_products_before_catalog_20261021';
        if(!localStorage.getItem(backup))localStorage.setItem(backup,raw);
        localStorage.setItem(STORAGE_KEYS.products,JSON.stringify(products));
      }catch{console.warn('Catalog usable in memory; original storage retained because migration backup/save could not fit.');}
    }
  }
  window.FGCatalog={merge,load,recordDelete,version:'2026-10-21',defaults};
  if(typeof normalizeProductsList==='function')normalizeProductsList=merge;
  if(typeof mergeCatalogProducts==='function')mergeCatalogProducts=merge;
  loadProducts=load;

  const brands={all:'كل الماركات',Carrier:'كاريير',Midea:'ميديا',Sharp:'شارب',Tornado:'تورنادو',Haier:'هاير',LG:'LG', 'Free Air':'فري إير',Fresh:'فريش'};
  const categories={wall:'حائطي',ducted:'مخفي',cassette:'كاسيت',floor:'أرضي',purifier:'منقي هواء',curtain:'ستارة هوائية'};
  const e=escapeHtml;
  const type=p=>p.type==='Inverter'?'إنفرتر':p.type==='Fixed'?'عادي':p.type==='Other'?'': 'النظام غير محدد بالقائمة';
  const price=p=>Number(p.price)>0?formatPrice(p.price)+' ج.م':'السعر عند الطلب';
  const priceLabel=p=>Number(p.price)?'السعر شامل التركيب المجاني':'التركيب مجاني — تواصل لتأكيد السعر والتوفر';
  const safeUrl=u=>/^(https?:\/\/|data:image\/|\.\/|catalog-images\/)/.test(String(u||''))?u:'';
  const photo=p=>(Array.isArray(p.gallery)?p.gallery:[]).find(Boolean)||p.img||'';
  const style=document.createElement('style');style.id='fg-catalog-style';style.textContent=`
  #brandFilterButtons{display:flex!important;flex-wrap:wrap!important;overflow:visible!important;gap:8px;margin:0 0 18px;opacity:1!important;transform:none!important}
  #brandFilterButtons button{border:1px solid #cbd5e1;border-radius:14px;background:#fff;color:#334155;padding:11px 18px;min-height:44px;font:inherit;font-weight:800;cursor:pointer}
  #brandFilterButtons button[aria-pressed=true]{background:#0369a1;color:#fff;border-color:#0369a1;box-shadow:0 3px 12px #0369a124}
  #brandFilterButtons button:focus-visible,.fgc-actions button:focus-visible,.fgc-actions a:focus-visible{outline:3px solid #38bdf8;outline-offset:3px}
  #productsGrid{display:grid;align-items:stretch}
  .fgc-card{border:1px solid #dbe4ee;border-radius:24px;background:white;overflow:hidden;display:flex;flex-direction:column;min-width:0;color:#0f172a}
  .fgc-media{height:205px;padding:22px;background:#f8fafc;display:flex;align-items:center;justify-content:center;position:relative;border-bottom:1px solid #eef2f6}
  .fgc-media img{width:100%;height:155px;object-fit:contain;mix-blend-mode:multiply}
  .fgc-no-photo{text-align:center;color:#64748b;font-size:14px;line-height:1.8;padding:28px 15px}
  .fgc-body{padding:20px;display:flex;flex:1;flex-direction:column;gap:10px;min-width:0}
  .fgc-tags{display:flex;gap:6px;flex-wrap:wrap;font-size:12px;font-weight:800}.fgc-tags span{background:#eef6fb;border-radius:7px;padding:4px 8px}
  .fgc-card h3{font-size:20px;line-height:1.5;font-weight:900;margin:0;overflow-wrap:anywhere}
  .fgc-model{font-size:12px;color:#64748b;direction:ltr;text-align:right;overflow-wrap:anywhere;line-height:1.6}
  .fgc-specs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:3px 0}.fgc-specs div{background:#f8fafc;padding:9px 11px;border-radius:12px;font-size:14px}.fgc-specs small{display:block;color:#64748b;font-size:11px;margin-bottom:4px}
  .fgc-price{margin-top:auto;padding-top:8px}.fgc-price strong{font-size:25px;display:block;color:#0369a1}.fgc-price small{font-size:11px;color:#64748b}
  .fgc-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}.fgc-actions button,.fgc-actions a{border:0;border-radius:12px;padding:11px 14px;font:inherit;font-size:14px;font-weight:800;cursor:pointer;text-align:center;text-decoration:none;flex:1;background:#e2e8f0;color:#0f172a;min-height:44px}.fgc-actions .fgc-primary{background:#0f172a;color:#fff}.fgc-actions .fgc-whatsapp{background:#059669;color:#fff}
  .fgc-note{font-size:12px;color:#92400e;background:#fffbeb;padding:9px 12px;border-radius:10px;line-height:1.8}
  .fgc-details{padding:28px;display:grid;grid-template-columns:1fr 1fr;gap:25px;color:#0f172a}.fgc-details h2{font-size:25px;font-weight:900;margin:10px 0}.fgc-details .fgc-media{height:320px;border-radius:18px}.fgc-details .fgc-media img{height:280px}.fgc-details ul{padding-right:20px;line-height:1.9;list-style:disc}.fgc-details table{width:100%;font-size:14px;margin:18px 0;border-collapse:collapse}.fgc-details th,.fgc-details td{text-align:right;padding:10px;border-bottom:1px solid #e2e8f0;overflow-wrap:anywhere}.fgc-details th{color:#64748b;width:38%;font-weight:500}.fgc-details a.fgc-source{color:#0369a1;text-decoration:underline;font-size:12px}
  .fgc-colors{display:flex;flex-wrap:wrap;gap:7px;margin:12px 0}.fgc-colors button{border:1px solid #cbd5e1;border-radius:10px;padding:8px 12px;cursor:pointer}.fgc-colors button[aria-pressed=true]{border:2px solid #0284c7}
  .fgc-close{display:block;position:sticky;top:8px;margin:10px 10px 0 auto;border:1px solid #cbd5e1;background:white;color:#0f172a;border-radius:12px;padding:10px 18px;min-height:44px;z-index:2;font:inherit;font-weight:800;cursor:pointer}
  .dark .fgc-card,.dark #brandFilterButtons button{background:#0f172a;color:#e2e8f0;border-color:#334155}.dark .fgc-body,.dark .fgc-details{color:#e2e8f0}.dark .fgc-tags span{background:#1e293b}.dark #brandFilterButtons button[aria-pressed=true]{background:#0284c7;color:white}.dark .fgc-specs div{background:#1e293b}.dark .fgc-model{color:#94a3b8}
  @media(max-width:580px){.fgc-details{grid-template-columns:1fr;padding:18px}.fgc-details .fgc-media{height:230px}.fgc-details .fgc-media img{height:200px}#brandFilterButtons button{padding:10px 13px;font-size:14px}}

  html,body{overflow-x:clip}
  body>header{position:sticky!important;top:0!important;z-index:110;background:#fffffff5}
  .dark body>header{background:#020617f5}
  #mobileMenu{max-height:calc(100dvh - 70px);overflow-y:auto}
  #brandFilterButtons{position:sticky;top:var(--fg-header-height,80px);z-index:40;background:#f8fafc;padding:8px 0}
  .dark #brandFilterButtons{background:#020617}
  @media(max-width:1023px){
    #productsGrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    #productsGrid .fgc-media{height:135px;padding:20px 10px 10px}
    #productsGrid .fgc-media img{height:85px;margin-top:8px}
    #productsGrid .fgc-body{padding:10px;gap:6px}
    #productsGrid .fgc-card h3{font-size:14px;line-height:1.45;min-height:40px}
    #productsGrid .fgc-tags{font-size:10px;gap:3px}
    #productsGrid .fgc-tags span{padding:3px 5px}
    #productsGrid .fgc-price strong{font-size:20px}
    #productsGrid .fgc-actions{gap:4px}
    #productsGrid .fgc-actions a,#productsGrid .fgc-actions button{font-size:12px;padding:8px 5px}
    #brandFilterButtons{gap:4px;margin-bottom:10px}
    #brandFilterButtons button{padding:6px 9px;font-size:12px;min-height:44px;border-radius:10px}
  }
  @media(max-width:340px){#productsGrid{grid-template-columns:minmax(0,1fr)}}
  `;document.head.append(style);
  const header=document.querySelector('body>header');
  if(header){const measure=()=>document.documentElement.style.setProperty('--fg-header-height',header.getBoundingClientRect().height+'px');new ResizeObserver(measure).observe(header);measure();}

  function media(p){const src=safeUrl(photo(p));return `<div class="fgc-media">${src?`<img loading="lazy" src="${e(src)}" alt="${e([brands[p.brand]||p.brand,p.model,p.color].filter(Boolean).join(' — '))}" onerror="FGCatalog.imageFailed(this)">`:'<div class="fgc-no-photo">صورة هذا الموديل غير متاحة حاليًا<br>اطلب صورة الكود قبل الشراء</div>'}</div>`;}
  window.FGCatalog.imageFailed=img=>{const parent=img.parentNode;img.remove();const msg=document.createElement('div');msg.className='fgc-no-photo';msg.textContent='تعذّر تحميل صورة هذا الموديل';parent.append(msg);};
  setIndoorFallback=window.FGCatalog.imageFailed;
  categoryName=v=>categories[v]||v;
  publicPriceMarkup=p=>`<div class="fgc-price">${Number(p.originalPrice)>Number(p.price)&&Number(p.price)>0?`<s>${e(formatPrice(p.originalPrice))} ج.م</s>`:''}<strong>${e(price(p))}</strong><small>${e(priceLabel(p))}</small></div>`;
  function wa(p){return waLink(`السلام عليكم، أريد طلب المنتج والاستفسار عن:\n${brands[p.brand]||p.brand} ${p.name}\nالموديل: ${p.model}${p.color?'\nاللون: '+p.color:''}\nالسعر الحالي: ${price(p)}\nالسعر شامل التركيب المجاني.\nبرجاء تأكيد السعر والتوفر وتفاصيل التوريد والضمان.`);}
  renderProducts=list=>{
    document.getElementById('resultsCount').textContent=list.length;
    document.getElementById('noResults').classList.toggle('hidden',!!list.length);
    document.getElementById('productsGrid').innerHTML=list.map(p=>`<article class="fgc-card" data-model="${e(p.model)}" data-brand="${e(p.brand)}">${media(p)}<div class="fgc-body"><div class="fgc-tags"><span>${e(brands[p.brand]||p.brand)}</span><span>${e(categories[p.category]||p.category)}</span>${p.hp?`<span>${e(p.hp)} حصان</span>`:''}${p.color?`<span>${e(p.color)}</span>`:''}${type(p)?`<span>${e(type(p))}</span>`:''}</div><h3>${e(p.name)}</h3><div class="fgc-model">${e(p.model)}</div><div class="fgc-specs"><div><small>${p.hp?'القدرة':'الفئة'}</small><b>${e(p.hp?p.hp+' حصان':categories[p.category])}</b></div><div><small>الغاز</small><b>${e(p.refrigerant||'R410A')}</b></div>${p.color?`<div><small>اللون</small><b>${e(p.color)}</b></div>`:''}<div><small>التشغيل</small><b>${e(p.cooling||'غير مذكور')}</b></div></div>${p.modelNeedsConfirmation?'<div class="fgc-note">كود هذه القدرة يحتاج تأكيدًا من المورد</div>':''}${publicPriceMarkup(p)}<div class="fgc-actions"><button class="fgc-primary" type="button" data-detail="${e(p.id)}">التفاصيل</button><a class="fgc-whatsapp" target="_blank" rel="noopener" href="${e(wa(p))}">واتساب</a><button type="button" data-compare="${e(p.id)}">قارن</button></div></div></article>`).join('');
  };
  document.getElementById('productsGrid').addEventListener('click',event=>{const b=event.target.closest('button');if(!b)return;if(b.dataset.detail)openProductModal(b.dataset.detail);if(b.dataset.compare)addToCompare(b.dataset.compare);});
  const colorFamily=p=>p.brand==='Sharp'&&/^AY-XP\d+YHE[BSR]?$/.test(p.model)?p.model.replace(/[BSR]$/,''):'';
  openProductModal=id=>{
    const p=products.find(x=>String(x.id)===String(id));if(!p)return;
    const family=colorFamily(p),variants=family?products.filter(x=>colorFamily(x)===family):[];
    const specs=[['الموديل',p.model],['الماركة',brands[p.brand]||p.brand],['القدرة',p.hp?p.hp+' حصان':'لا ينطبق'],['السلسلة',p.series||p.name],['السعة بالقائمة',p.capacityBtu?formatPrice(p.capacityBtu)+' BTU/h':'غير مذكورة'],['الفئة',categories[p.category]],['النظام',type(p)||'لا ينطبق'],['التشغيل',p.cooling],['الغاز',p.refrigerant||'R410A'],['اللون',p.color||'غير موثق'],['المساحة التقريبية',p.area||'تحتاج معاينة'],...(p.modelAlias?[['كود المصنع المطابق',p.modelAlias]]:[]),...(p.ean?[['EAN',p.ean]]:[]),...(p.catalogDate?[['تاريخ قائمة الأسعار',p.catalogDate]]:[])];
    document.getElementById('productModalBody').innerHTML=`<div class="fgc-details"><div>${media(p)}${variants.length>1?`<div class="fgc-colors" aria-label="الألوان المتاحة بأكواد مستقلة">${variants.map(v=>`<button type="button" data-color-id="${e(v.id)}" aria-pressed="${v.id===p.id}">${e(v.color||v.model)}</button>`).join('')}</div>`:''}${p.photoSource?`<p><a class="fgc-source" href="${e(p.photoSource)}" target="_blank" rel="noopener">مصدر صورة الموديل</a></p>`:''}</div><div><h2>${e(brands[p.brand]||p.brand)} — ${e(p.name)}</h2>${publicPriceMarkup(p)}<table>${specs.map(([k,v])=>`<tr><th>${e(k)}</th><td>${e(v??'غير مذكور')}</td></tr>`).join('')}</table>${p.warranty?`<p><b>الضمان حسب القائمة:</b> ${e(p.warranty)}</p>`:''}<ul>${[...(p.features||[]),...(p.notes||[]).filter(t=>!t.includes('تركيب'))].map(t=>`<li>${e(t)}</li>`).join('')}</ul>${p.catalogSource?`<p class="fgc-model">المصدر: ${e(p.catalogSource)}</p>`:''}<div class="fgc-actions"><a class="fgc-whatsapp" target="_blank" rel="noopener" href="${e(wa(p))}">واتساب</a><button type="button" data-quote="${e(p.id)}">طلب عرض سعر</button><button type="button" data-copy-model="${e(p.id)}">نسخ الموديل</button><button type="button" data-compare="${e(p.id)}">أضف للمقارنة</button></div></div></div>`;
    const body=document.getElementById('productModalBody');
    body.insertAdjacentHTML('afterbegin','<button type="button" class="fgc-close" data-close-detail>إغلاق ✕</button>');
    body.setAttribute('role','dialog');body.setAttribute('aria-modal','true');body.setAttribute('aria-label','تفاصيل '+p.model);
    document.getElementById('productModal').classList.remove('hidden');document.getElementById('productModal').classList.add('flex');document.body.style.overflow='hidden';
    body.querySelector('[data-close-detail]').focus({preventScroll:true});
  };
  document.getElementById('productModalBody').addEventListener('click',event=>{const b=event.target.closest('button');if(b?.hasAttribute('data-close-detail'))closeProductModal();if(b?.dataset.quote){const p=products.find(p=>String(p.id)===b.dataset.quote);if(p){closeProductModal();prefillQuote(p.name,p.model);}}if(b?.dataset.copyModel){const p=products.find(p=>String(p.id)===b.dataset.copyModel);if(p)copyText(p.model);}if(b?.dataset.colorId)openProductModal(b.dataset.colorId);if(b?.dataset.compare)addToCompare(b.dataset.compare);});
  function installFilters(){
    const select=document.getElementById('brandFilter');if(!select)return;
    select.innerHTML=Object.entries(brands).map(([k,v])=>`<option value="${e(k)}">${e(v)}</option>`).join('');
    select.parentElement.style.display='none';
    let bar=document.getElementById('brandFilterButtons');
    if(!bar){bar=document.createElement('div');bar.id='brandFilterButtons';const panel=document.querySelector('.product-filter-panel,.catalog-search-panel')||document.getElementById('searchInput').parentElement.parentElement.parentElement;panel.before(bar);}
    bar.className='fg-brandbar';bar.setAttribute('role','group');bar.setAttribute('aria-label','فلتر الماركة');
    bar.innerHTML=Object.entries(brands).map(([k,v])=>`<button type="button" data-brand="${e(k)}" aria-pressed="${k==='all'}">${e(v)}</button>`).join('');
    bar.addEventListener('click',event=>{const b=event.target.closest('button[data-brand]');if(b)setBrandFilter(b.dataset.brand);});
    for(const id of ['categoryFilter','apCategory']){const s=document.getElementById(id);if(s)for(const k of ['purifier','curtain'])if(![...s.options].some(o=>o.value===k))s.add(new Option(categories[k],k));}
    for(const id of ['apBrand']){const s=document.getElementById(id);if(s)for(const [k,v]of Object.entries(brands))if(k!=='all'&&![...s.options].some(o=>o.value===k))s.add(new Option(v,k));}
    for(const id of ['typeFilter','apType']){const s=document.getElementById(id);if(s)for(const [k,v]of [['Unknown','غير محدد بالقائمة'],['Other','أخرى']])if(![...s.options].some(o=>o.value===k))s.add(new Option(v,k));}
    const range=document.getElementById('priceRange');if(range)range.min='0';
  }
  window.setBrandFilter=brand=>{document.getElementById('brandFilter').value=brand;applyFilters();};
  applyFilters=()=>{
    const brand=document.getElementById('brandFilter').value;
    document.querySelectorAll('#brandFilterButtons button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.brand===brand)));
    const search=document.getElementById('searchInput').value.toLowerCase().trim(), t=document.getElementById('typeFilter').value,c=document.getElementById('categoryFilter').value,max=Number(document.getElementById('priceRange').value);
    let filtered=products.filter(p=>(brand==='all'||p.brand===brand)&&(t==='all'||p.type===t)&&(c==='all'||p.category===c)&&(currentHP==='all'||String(p.hp)===String(currentHP))&&(!Number(p.price)||Number(p.price)<=max)&&(!search||[p.model,p.name,p.series,p.brand,brands[p.brand],p.modelAlias,p.color,p.cooling,...(p.features||[])].join(' ').toLowerCase().includes(search)));
    filtered.sort((a,b)=>currentSort==='priceAsc'?(Number(a.price)||Infinity)-(Number(b.price)||Infinity):currentSort==='priceDesc'?(Number(b.price)||0)-(Number(a.price)||0):scoreProduct(b)-scoreProduct(a)||(Number(a.price)||Infinity)-(Number(b.price)||Infinity));
    renderProducts(filtered);
  };
  installFilters();
})();
