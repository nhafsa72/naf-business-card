let config=null, activeTab='home', lastSignature='', viewed=false;
const $=id=>document.getElementById(id);
const send=(type,extra={})=>window.parent.postMessage({isStreamlitMessage:true,type,...extra},'*');
function event(kind){if(config?.preview)return;send('streamlit:setComponentValue',{value:{id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),event:kind},dataType:'json'});}
function text(tag,value,className=''){const e=document.createElement(tag);e.textContent=value;e.className=className;return e;}
function safeUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
function anchor(label,url,cls,eventKind='social'){const a=text('a',label,cls);a.href=safeUrl(url)||'https://www.instagram.com/nafbynafees/';a.target='_blank';a.rel='noopener noreferrer';a.addEventListener('click',()=>event(eventKind));return a;}
function setTab(id,focus=false){activeTab=id;document.querySelectorAll('[role=tabpanel]').forEach(p=>p.hidden=p.id!==id);document.querySelectorAll('[role=tab]').forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.tab===id));b.tabIndex=b.dataset.tab===id?0:-1});$('content').scrollTop=0;if(focus)$('tab-'+id).focus();}
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
document.querySelectorAll('[role=tab]').forEach(b=>b.addEventListener('keydown',e=>{const tabs=['home','collection','info','share'];let i=tabs.indexOf(activeTab);if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();setTab(tabs[(i+(e.key==='ArrowRight'?1:3))%4],true)}}));
const icons={instagram:'<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',tiktok:'<path d="M14 3v12a4 4 0 1 1-4-4M14 3c0 4 3 6 6 6"/>',other:'<path d="m10 8 3-3a5 5 0 0 1 7 7l-3 3M14 16l-3 3a5 5 0 0 1-7-7l3-3M8 16l8-8"/>'};

function updateEvent(item,now=new Date()){
  const box=$('upcoming-event');box.hidden=true;
  if(!item?.visible||!item.name||!item.date||!item.venue||!item.address)return;
  const zone=item.timezone||'America/Chicago';
  try{
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
    const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
    if(p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute>item.date+'T'+item.end_time)return;
    const day=new Date(item.date+'T12:00:00Z');
    $('event-month').textContent=day.toLocaleDateString('en-US',{month:'short',timeZone:'UTC'}).toUpperCase();
    $('event-day').textContent=day.toLocaleDateString('en-US',{day:'numeric',timeZone:'UTC'});
    $('event-name').textContent=item.name;
    const clock=value=>{const [h,m]=value.split(':').map(Number);return (h%12||12)+(m?':'+String(m).padStart(2,'0'):'')+(h>=12?' PM':' AM')};
    const label={'America/Chicago':'CT','America/New_York':'ET','America/Denver':'MT','America/Los_Angeles':'PT','America/Phoenix':'Arizona time','Pacific/Honolulu':'Hawaii time','America/Anchorage':'Alaska time'}[zone]||zone;
    $('event-when').textContent=day.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric',timeZone:'UTC'})+' · '+clock(item.start_time)+'–'+clock(item.end_time)+' '+label;
    $('event-venue').textContent=item.venue;$('event-address').textContent=item.address;
    $('event-booth').textContent=item.booth?'STALL '+item.booth:'';$('event-booth').hidden=!item.booth;
    $('event-directions').href='https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(item.venue+', '+item.address);
    const details=safeUrl(item.details_url);$('event-details').hidden=!details;if(details)$('event-details').href=details;
    box.hidden=false;
  }catch{box.hidden=true;}
}
setInterval(()=>{if(config)updateEvent(config.card.upcoming_event)},60000);

function draw(args){config=args;document.body.classList.toggle('preview',!!args.preview);const d=args.card;document.documentElement.style.setProperty('--ink',d.foreground);document.documentElement.style.setProperty('--accent',d.accent);document.documentElement.style.setProperty('--blush',d.background);$('name').textContent=d.name;$('tagline').textContent=d.tagline;$('description').textContent=d.description;
  const logo=$('logo');logo.replaceChildren();if(d.logo){const img=document.createElement('img');img.src=d.logo;img.alt=d.name+' logo';logo.append(img);}else{logo.innerHTML=args.flower;}
  const note=d.announcement||{};const expired=note.expires&&new Date(note.expires+'T23:59:59Z')<new Date();$('announcement').hidden=!(note.visible&&note.text&&!expired);$('announcement').textContent=note.text||'';
  updateEvent(d.upcoming_event);
  const socials=$('socials');socials.replaceChildren();let instagram='https://www.instagram.com/nafbynafees/';(d.links||[]).filter(r=>r.visible).forEach(row=>{if(!safeUrl(row.url))return;const key=row.url.includes('instagram.com')?'instagram':row.url.includes('tiktok.com')?'tiktok':'other';if(key==='instagram')instagram=row.url;const a=anchor('',row.url,'social');const span=document.createElement('span');span.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+icons[key]+'</svg>';a.append(span,text('span',row.label));socials.append(a);});
  $('order').href=instagram;$('order').onclick=()=>event('social');$('contact').href='data:text/vcard;base64,'+args.vcard;$('contact').onclick=()=>event('contact');
  const grid=$('products');grid.replaceChildren();const products=(d.products||[]).filter(p=>p.visible);products.forEach(p=>{const item=document.createElement('article');item.className='product';if(p.image){const img=document.createElement('img');img.src=p.image;img.alt=p.name;img.loading='lazy';item.append(img);}else item.append(text('div','NAF','no-photo'));const body=document.createElement('div');body.className='body';body.append(text('h3',p.name));if(p.price)body.append(text('div',p.price,'price'));body.append(text('span',p.status,'badge'+(p.status==='Sold out'?' sold':'')));if(p.details)body.append(text('p',p.details));if(p.url)body.append(anchor('View product',p.url,'','product'));else if(p.status==='Available')body.append(anchor('Ask on Instagram',instagram,'','product'));item.append(body);grid.append(item);});if(!products.length){const empty=text('div','Discover the latest bangles, jhumkas, henna, and accessories on our social platforms.','empty');empty.append(anchor('Browse on Instagram',instagram,''));grid.append(empty);}
  $('steps').replaceChildren(...(d.order_steps||[]).map(s=>text('li',s)));const delivery=$('delivery'),policies=$('policies');delivery.replaceChildren();policies.replaceChildren();Object.entries(d.delivery||{}).forEach(([key,value])=>{if(!value)return;const p=document.createElement('p');const names={area:'Where we deliver',pickup:'Pickup',processing:'When we ship',payment:'Payment options',returns:'Returns'};p.append(text('strong',names[key]||key),document.createTextNode(value));(key==='payment'||key==='returns'?policies:delivery).append(p);});const faqs=$('faqs');faqs.replaceChildren();(d.faqs||[]).forEach(f=>{const details=document.createElement('details');details.append(text('summary',f.question),text('div',f.answer,'detail-body'));faqs.append(details);});
  $('qr').hidden=!args.qr;if(args.qr)$('qr').src=args.qr;$('qr-note').textContent=args.qr?'Scan to open our digital card.':'QR sharing becomes available after the published card URL is set.';$('qr-download').hidden=!args.qr;if(args.qr)$('qr-download').href=args.qr;$('qr-download').onclick=()=>event('qr');$('copy').disabled=!d.public_url;
  setTab(activeTab);send('streamlit:setFrameHeight',{height:610});if(!viewed&&!args.preview){viewed=true;event('view');}}
$('copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(config.card.public_url);$('share-status').textContent='Card link copied.';}catch{$('share-status').textContent=config.card.public_url||'Set the card URL first.';}});
window.addEventListener('message',e=>{if(e.source!==window.parent||e.data.type!=='streamlit:render')return;const signature=JSON.stringify(e.data.args);if(signature!==lastSignature){lastSignature=signature;draw(e.data.args);}else send('streamlit:setFrameHeight',{height:610});});send('streamlit:componentReady',{apiVersion:1});
