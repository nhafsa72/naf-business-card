let config=null, activeTab='home', lastSignature='', viewed=false;
const $=id=>document.getElementById(id);
const send=(type,extra={})=>window.parent.postMessage({isStreamlitMessage:true,type,...extra},'*');
function event(kind){if(config?.preview)return;send('streamlit:setComponentValue',{value:{id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),event:kind},dataType:'json'});}
function text(tag,value,className=''){const e=document.createElement(tag);e.textContent=value;e.className=className;return e;}
function safeUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
function anchor(label,url,cls,eventKind='social'){const a=text('a',label,cls);a.href=safeUrl(url)||'https://www.instagram.com/nafbynafees/';a.target='_blank';a.rel='noopener noreferrer';a.addEventListener('click',()=>event(eventKind));return a;}
function setTab(id,focus=false){activeTab=id;document.querySelectorAll('[role=tabpanel]').forEach(p=>p.hidden=p.id!==id);document.querySelectorAll('[role=tab]').forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.tab===id));b.tabIndex=b.dataset.tab===id?0:-1});$('content').scrollTop=0;if(focus)$('tab-'+id).focus();}
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
document.querySelectorAll('[role=tab]').forEach(b=>b.addEventListener('keydown',e=>{const tabs=['home','collection','info','share'];let i=tabs.indexOf(activeTab);if(['ArrowRight','ArrowLeft','ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?3:(i+(['ArrowRight','ArrowDown'].includes(e.key)?1:3))%4;setTab(tabs[next],true)}}));
const icons={instagram:'<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',tiktok:'<path d="M14 3v12a4 4 0 1 1-4-4M14 3c0 4 3 6 6 6"/>',other:'<path d="m10 8 3-3a5 5 0 0 1 7 7l-3 3M14 16l-3 3a5 5 0 0 1-7-7l3-3M8 16l8-8"/>'};

// Convert venue-local times to UTC, including daylight saving transitions.
function eventInstant(date,time,zone){
  const [y,m,d]=date.split('-').map(Number),[h,n]=time.split(':').map(Number);
  const wall=Date.UTC(y,m-1,d,h,n);let instant=wall;
  const fmt=new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  for(let i=0;i<4;i++){const p=Object.fromEntries(fmt.formatToParts(new Date(instant)).map(x=>[x.type,x.value]));const represented=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);const delta=wall-represented;instant+=delta;if(!delta)break;}
  return new Date(instant);
}
function calendarText(item){
  const zone=item.timezone||'America/Chicago';
  const stamp=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
  const esc=s=>String(s||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
  const uid=encodeURIComponent(item.name+'-'+item.date+'-'+item.booth)+'@naf-business-card.streamlit.app';
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//NAF by Nafees//Stall Events//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT','UID:'+uid,'DTSTAMP:'+stamp(new Date()),'DTSTART:'+stamp(eventInstant(item.date,item.start_time,zone)),'DTEND:'+stamp(eventInstant(item.date,item.end_time,zone)),'SUMMARY:'+esc(item.name+' — NAF by Nafees'),'LOCATION:'+esc(item.venue+', '+item.address),'DESCRIPTION:'+esc('Visit NAF by Nafees at Stall '+item.booth+'.\n'+(config?.card?.public_url||'https://naf-business-card.streamlit.app/')),'END:VEVENT','END:VCALENDAR'];
  // RFC 5545 content lines are folded at 75 UTF-8 octets.
  return lines.map(line=>{let folded='',count=0;for(const c of line){const size=new TextEncoder().encode(c).length;if(count+size>75){folded+='\r\n ';count=1;}folded+=c;count+=size;}return folded;}).join('\r\n')+'\r\n';
}
let calendarUrls=[];
function updateEvents(card,now=new Date()){
  calendarUrls.forEach(u=>URL.revokeObjectURL(u));calendarUrls=[];
  const container=$('upcoming-events');container.replaceChildren();
  const items=card.upcoming_events??(card.upcoming_event?[card.upcoming_event]:[]);
  [...items].sort((a,b)=>(a.date+a.start_time).localeCompare(b.date+b.start_time)).forEach(item=>{
    if(!item?.visible||!item.name||!item.date||!item.venue||!item.address)return;
    try{
      const zone=item.timezone||'America/Chicago';
      if(now>=eventInstant(item.date,item.end_time,zone))return;
      const day=new Date(item.date+'T12:00:00Z');
      const box=text('aside','','event-card');box.setAttribute('aria-label',item.name+' stall event');
      const top=text('div','','event-top');top.append(text('span','MEET US IN PERSON','event-eyebrow'));
      if(item.booth)top.append(text('span','STALL '+item.booth,'event-booth'));
      const body=text('div','','event-body'),badge=text('div','','event-date-badge'),copy=text('div','','event-copy');
      badge.append(text('span',day.toLocaleDateString('en-US',{month:'short',timeZone:'UTC'}).toUpperCase()),text('strong',day.toLocaleDateString('en-US',{day:'numeric',timeZone:'UTC'})));
      const clock=v=>{if(v==='24:00')return 'midnight';const [h,m]=v.split(':').map(Number);return (h%12||12)+(m?':'+String(m).padStart(2,'0'):'')+(h>=12?' PM':' AM')};
      const label={'America/Chicago':'CT','America/New_York':'ET','America/Denver':'MT','America/Los_Angeles':'PT','America/Phoenix':'Arizona time','Pacific/Honolulu':'Hawaii time','America/Anchorage':'Alaska time'}[zone]||zone;
      copy.append(text('h3',item.name),text('p',day.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric',timeZone:'UTC'})+' · '+clock(item.start_time)+'–'+clock(item.end_time)+' '+label),text('p',item.venue,'event-venue'),text('p',item.address,'event-address'));
      body.append(badge,copy);const actions=text('div','','event-actions');
      actions.append(anchor('Get Directions','https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(item.venue+', '+item.address),''));
      const calendar=text('a','Add to Calendar');calendar.href=URL.createObjectURL(new Blob([calendarText(item)],{type:'text/calendar;charset=utf-8'}));calendarUrls.push(calendar.href);calendar.download=item.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.ics';actions.append(calendar);
      const details=safeUrl(item.details_url);if(details)actions.append(anchor('Event Details',details,''));
      box.append(top,body,actions);container.append(box);
    }catch(error){console.warn('Unable to display event',error);}
  });
}
setInterval(()=>{if(config)updateEvents(config.card)},60000);

function draw(args){config=args;document.body.classList.toggle('preview',!!args.preview);const d=args.card;document.documentElement.style.setProperty('--ink',d.foreground);document.documentElement.style.setProperty('--accent',d.accent);document.documentElement.style.setProperty('--blush',d.background);$('name').textContent=d.name;$('tagline').textContent=d.tagline;$('description').textContent=d.description;
  const logo=$('logo');logo.replaceChildren();if(d.logo){const img=document.createElement('img');img.src=d.logo;img.alt=d.name+' logo';logo.append(img);}else{logo.innerHTML=args.flower;}
  const note=d.announcement||{};const expired=note.expires&&new Date(note.expires+'T23:59:59Z')<new Date();$('announcement').hidden=!(note.visible&&note.text&&!expired);$('announcement').textContent=note.text||'';
  updateEvents(d);
  const socials=$('socials');socials.replaceChildren();let instagram='https://www.instagram.com/nafbynafees/';(d.links||[]).filter(r=>r.visible).forEach(row=>{if(!safeUrl(row.url))return;const key=row.url.includes('instagram.com')?'instagram':row.url.includes('tiktok.com')?'tiktok':'other';if(key==='instagram')instagram=row.url;const a=anchor('',row.url,'social');a.setAttribute('aria-label',row.label);a.title=row.label;const span=document.createElement('span');span.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+icons[key]+'</svg>';a.append(span);socials.append(a);});
  $('order').href=instagram;$('order').onclick=()=>event('social');$('contact').href='data:text/vcard;base64,'+args.vcard;$('contact').onclick=()=>event('contact');
  const grid=$('products');grid.replaceChildren();
  const collectionPhotos=[
    {src:'collection/gold-bangles.jpg',alt:'Gold-tone bangles with hanging charms'},
    {src:'collection/silver-bangles.jpg',alt:'Silver-tone bangles with hanging charms'},
    {src:'collection/red-pearl-bangles.jpg',alt:'Red bangles with pearl-style accents'}
  ];
  collectionPhotos.forEach(photo=>{const figure=document.createElement('figure');figure.className='product collection-photo';const img=document.createElement('img');img.src=photo.src;img.alt=photo.alt;img.loading='lazy';img.width=426;img.height=640;figure.append(img);grid.append(figure);});
  const products=(d.products||[]).filter(p=>p.visible);products.forEach(p=>{const item=document.createElement('article');item.className='product';if(p.image){const img=document.createElement('img');img.src=p.image;img.alt=p.name;img.loading='lazy';item.append(img);}else item.append(text('div','NAF','no-photo'));const body=document.createElement('div');body.className='body';body.append(text('h3',p.name));if(p.price)body.append(text('div',p.price,'price'));body.append(text('span',p.status,'badge'+(p.status==='Sold out'?' sold':'')));if(p.details)body.append(text('p',p.details));if(p.url)body.append(anchor('View product',p.url,'','product'));else if(p.status==='Available')body.append(anchor('Ask on Instagram',instagram,'','product'));item.append(body);grid.append(item);});if(!products.length&&!collectionPhotos.length){const empty=text('div','Discover the latest bangles, jhumkas, henna, and accessories on our social platforms.','empty');empty.append(anchor('Browse on Instagram',instagram,''));grid.append(empty);}
  $('steps').replaceChildren(...(d.order_steps||[]).map(s=>text('li',s)));const delivery=$('delivery'),policies=$('policies');delivery.replaceChildren();policies.replaceChildren();Object.entries(d.delivery||{}).forEach(([key,value])=>{if(!value)return;const p=document.createElement('p');const names={area:'Where we deliver',pickup:'Pickup',processing:'When we ship',payment:'Payment options',returns:'Returns'};p.append(text('strong',names[key]||key),document.createTextNode(value));(key==='payment'||key==='returns'?policies:delivery).append(p);});const faqs=$('faqs');faqs.replaceChildren();(d.faqs||[]).forEach(f=>{const details=document.createElement('details');details.append(text('summary',f.question),text('div',f.answer,'detail-body'));faqs.append(details);});
  $('qr').hidden=!args.qr;if(args.qr)$('qr').src=args.qr;$('qr-note').textContent=args.qr?'Scan to open our digital card.':'QR sharing becomes available after the published card URL is set.';$('qr-download').hidden=!args.qr;if(args.qr)$('qr-download').href=args.qr;$('qr-download').onclick=()=>event('qr');$('copy').disabled=!d.public_url;
  setTab(activeTab);send('streamlit:setFrameHeight',{height:610});if(!viewed&&!args.preview){viewed=true;event('view');}}
$('copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(config.card.public_url);$('share-status').textContent='Card link copied.';}catch{$('share-status').textContent=config.card.public_url||'Set the card URL first.';}});
window.addEventListener('message',e=>{if(e.source!==window.parent||e.data.type!=='streamlit:render')return;const signature=JSON.stringify(e.data.args);if(signature!==lastSignature){lastSignature=signature;draw(e.data.args);}else send('streamlit:setFrameHeight',{height:610});});send('streamlit:componentReady',{apiVersion:1});
