// Put the catalog immediately after the compact introduction on every screen.
setIndoorFallback=function(img){img.onerror=null;img.src='device-placeholder.svg';img.alt='رسم توضيحي — صورة الموديل غير متاحة';};
document.querySelectorAll('header img').forEach(img=>{img.addEventListener('error',()=>{img.src='fast-group-icon.svg';},{once:true});if(img.complete&&!img.naturalWidth)img.src='fast-group-icon.svg';});
const catalogSection=document.getElementById('products');
document.getElementById('top').after(catalogSection);
const searchField=document.getElementById('searchInput');
const mainSearch=searchField.parentElement.parentElement;
const searchPanel=mainSearch.parentElement;
mainSearch.classList.add('catalog-main-search');searchPanel.classList.add('catalog-search-panel');
const options=document.createElement('details');options.className='catalog-options';
const summary=document.createElement('summary');summary.textContent='الفلاتر والترتيب';options.append(summary);
const extra=document.createElement('div');extra.className='extra-filters';
[...mainSearch.children].slice(1).forEach(el=>extra.append(el));options.append(extra);
if(mainSearch.nextElementSibling)options.append(mainSearch.nextElementSibling);
searchPanel.append(options);
const quoteButton=document.createElement('button');quoteButton.type='button';quoteButton.className='mobile-share';quoteButton.textContent='طلب عرض سعر';quoteButton.onclick=()=>openQuoteModal();options.append(quoteButton);
// Draw cached products immediately, independent of a slow network handshake.
loadProducts();applyFilters();
window.addEventListener('load',()=>{
  if(location.hash)document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
});
