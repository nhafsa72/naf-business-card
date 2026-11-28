let config=null, activeTab='home', lastSignature='', viewed=false;
const $=id=>document.getElementById(id);
const send=(type,extra={})=>window.parent.postMessage({isStreamlitMessage:true,type,...extra},'*');
function event(kind){if(config?.preview)return;send('streamlit:setComponentValue',{value:{id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),event:kind},dataType:'json'});}
function text(tag,value,className=''){const e=document.createElement(tag);e.textContent=value;e.className=className;return e;}
function safeUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
function anchor(label,url,cls,eventKind='social'){const a=text('a',label,cls);a.href=safeUrl(url)||'https://www.instagram.com/nafbynafees/';a.target='_blank';a.rel='noopener noreferrer';a.addEventListener('click',()=>event(eventKind));return a;}
function setTab(id,focus=false){activeTab=id;document.querySelectorAll('[role=tabpanel]').forEach(p=>p.hidden=p.id!==id);document.querySelectorAll('[role=tab]').forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.tab===id));b.tabIndex=b.dataset.tab===id?0:-1});$('content').scrollTop=0;if(focus)$('tab-'+id).focus();}
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
document.querySelectorAll('[role=tab]').forEach(b=>b.addEventListener('keydown',e=>{const tabs=['home','collection','info','contact-us'];let i=tabs.indexOf(activeTab);if(['ArrowRight','ArrowLeft','ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?3:(i+(['ArrowRight','ArrowDown'].includes(e.key)?1:3))%4;setTab(tabs[next],true)}}));
function withFacebook(links=[]){const rows=[...links];if(!rows.some(row=>{try{return new URL(row.url).hostname.replace(/^www\./,'')==='facebook.com';}catch{return false;}}))rows.push({label:'Facebook',url:'https://www.facebook.com/profile.php?id=61597237701175',visible:true});return rows;}
const icons={facebook:'<path d="M14 21v-8h3l.5-4H14V7c0-1.2.4-2 2-2h2V1.5A25 25 0 0 0 15 1c-3 0-5 1.8-5 5v3H7v4h3v8"/>',instagram:'<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',tiktok:'<path d="M14 3v12a4 4 0 1 1-4-4M14 3c0 4 3 6 6 6"/>',other:'<path d="m10 8 3-3a5 5 0 0 1 7 7l-3 3M14 16l-3 3a5 5 0 0 1-7-7l3-3M8 16l8-8"/>'};

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
let calendarUrls=[], eventsExpanded=false, eventSignature='';
function eventEntries(card,now=new Date()){
  const items=card.upcoming_events??(card.upcoming_event?[card.upcoming_event]:[]);
  return items.filter(item=>item?.visible&&item.name&&item.date&&item.venue&&item.address).flatMap(item=>{
    try{
      const zone=item.timezone||'America/Chicago';
      const start=eventInstant(item.date,item.start_time,zone),end=eventInstant(item.date,item.end_time,zone);
      if(!Number.isFinite(+start)||!Number.isFinite(+end)||end<=start)return [];
      return [{item,start,end,state:now>=end?'ended':now>=start?'live':'upcoming'}];
    }catch{return [];}
  }).sort((a,b)=>(a.state==='ended')-(b.state==='ended') || (a.state==='ended'?b.end-a.end:a.start-b.start));
}
function countdownParts(start,now){
  let seconds=Math.max(0,Math.ceil((start-now)/1000));
  const days=Math.floor(seconds/86400);seconds%=86400;
  const hours=Math.floor(seconds/3600);seconds%=3600;
  const minutes=Math.floor(seconds/60);seconds%=60;
  return [days,hours,minutes,seconds];
}
function eventActionIcon(link,kind){
  const icon=document.createElement('span');icon.className='event-action-icon';icon.setAttribute('aria-hidden','true');
  const paths=kind==='directions'?'<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>':'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M12 14v4m-2-2h4"/>';
  icon.innerHTML='<svg viewBox="0 0 24 24" focusable="false">'+paths+'</svg>';
  link.prepend(icon);return link;
}
function renderEventCard(entry,teaser=false,showTimer=false){
  const {item,state}=entry,zone=item.timezone||'America/Chicago';
  const box=text('aside','','event-card'+(state==='ended'?' event-ended':'')+(teaser?' event-teaser':''));
  box.dataset.eventName=item.name;
  if(teaser){box.setAttribute('aria-hidden','true');box.setAttribute('inert','');}
  else box.setAttribute('aria-label',item.name+' stall event');
  if(teaser){box.append(text('p',(state==='ended'?'Event ended · ':'Next · ')+item.name,'event-peek'));return box;}
  const top=text('div','','event-top');
  top.append(text('span',state==='ended'?'EVENT ENDED':state==='live'?'HAPPENING NOW':'MEET US IN PERSON','event-eyebrow'));
  const badges=text('div','','event-badges');
  if(showTimer){
    const timer=text('span','','event-timer-badge');timer.id='event-countdown';
    timer.setAttribute('role','timer');timer.setAttribute('aria-live','off');badges.append(timer);
  }
  if(item.booth)badges.append(text('span','STALL '+item.booth,'event-booth'));
  top.append(badges);
  const body=text('div','','event-body'),badge=text('div','','event-date-badge'),copy=text('div','','event-copy');
  const day=new Date(item.date+'T12:00:00Z');
  badge.append(text('span',day.toLocaleDateString('en-US',{month:'short',timeZone:'UTC'}).toUpperCase()),text('strong',day.toLocaleDateString('en-US',{day:'numeric',timeZone:'UTC'})));
  const clock=v=>{if(v==='24:00')return 'midnight';const [h,m]=v.split(':').map(Number);return (h%12||12)+(m?':'+String(m).padStart(2,'0'):'')+(h>=12?' PM':' AM')};
  const label={'America/Chicago':'CT','America/New_York':'ET','America/Denver':'MT','America/Los_Angeles':'PT','America/Phoenix':'Arizona time','Pacific/Honolulu':'Hawaii time','America/Anchorage':'Alaska time'}[zone]||zone;
  copy.append(text('h3',item.name),text('p',day.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric',timeZone:'UTC'})+' · '+clock(item.start_time)+'–'+clock(item.end_time)+' '+label),text('p',item.venue,'event-venue'),text('p',item.address,'event-address'));
  body.append(badge,copy);box.append(top,body);
  if(state!=='ended'&&!teaser){
    const actions=text('div','','event-actions');
    actions.append(eventActionIcon(anchor('Get Directions','https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(item.venue+', '+item.address),''),'directions'));
    const calendar=text('a','Add to Calendar');calendar.href=URL.createObjectURL(new Blob([calendarText(item)],{type:'text/calendar;charset=utf-8'}));calendarUrls.push(calendar.href);calendar.download=item.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.ics';actions.append(eventActionIcon(calendar,'calendar'));
    const details=safeUrl(item.details_url);if(details)actions.append(anchor('Event Details',details,''));
    box.append(actions);
  }
  return box;
}
function updateEvents(card,now=new Date()){
  const entries=eventEntries(card,now),featured=entries.find(e=>e.state!=='ended');
  const signature=JSON.stringify([card.upcoming_events??card.upcoming_event,entries.map(e=>[e.item.name,e.state]),eventsExpanded]);
  const container=$('upcoming-events');
  if(signature!==eventSignature){
    eventSignature=signature;calendarUrls.forEach(u=>URL.revokeObjectURL(u));calendarUrls=[];
    container.replaceChildren();container.hidden=!entries.length;
    const stack=text('div','','event-stack'+(eventsExpanded?' is-expanded':'')+(!eventsExpanded&&entries.length>1?' has-more':''));
    stack.id='event-cards';
    if(eventsExpanded)entries.forEach(entry=>stack.append(renderEventCard(entry,false,entry===featured)));
    else{
      stack.append(renderEventCard(entries[0],false,entries[0]===featured));
      if(entries.length>1)stack.append(renderEventCard(entries[1],true));
    }
    container.append(stack);
    if(entries.length>1){
      const toggle=text('button',eventsExpanded?'Show featured event':'View all events ('+entries.length+')','events-toggle');
      toggle.type='button';toggle.setAttribute('aria-expanded',String(eventsExpanded));toggle.setAttribute('aria-controls','event-cards');
      toggle.onclick=()=>{eventsExpanded=!eventsExpanded;updateEvents(config.card);container.querySelector('.events-toggle')?.focus();};
      container.append(toggle);
    }
  }
  const timer=$('event-countdown');
  if(timer&&featured){
    const values=countdownParts(featured.start,now);
    timer.textContent=featured.state==='live'?'Live now':String(values[0]).padStart(2,'0')+'d '+values.slice(1).map(v=>String(v).padStart(2,'0')).join(':');
    timer.setAttribute('aria-label',featured.state==='live'?featured.item.name+' is happening now':featured.item.name+' starts in '+values[0]+' days, '+values[1]+' hours, '+values[2]+' minutes, '+values[3]+' seconds');
  }
}
setInterval(()=>{if(config)updateEvents(config.card)},1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&config)updateEvents(config.card)});
window.addEventListener('focus',()=>{if(config)updateEvents(config.card)});

function renderContact(card){
  const socials=$('contact-socials');socials.replaceChildren();
  withFacebook(card.links).filter(row=>row.visible&&safeUrl(row.url)).forEach(row=>{
    const a=anchor('',row.url,'contact-social-button');
    const host=new URL(row.url).hostname.replace(/^www\./,'');
    const key=host==='instagram.com'?'instagram':host==='tiktok.com'?'tiktok':host==='facebook.com'?'facebook':'other';
    const icon=document.createElement('span');icon.className='contact-social-icon';icon.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+icons[key]+'</svg>';
    const copy=text('span','','contact-social-copy');
    copy.append(text('strong',row.label),text('small',key==='instagram'?'Browse & message us to order':key==='tiktok'?'Watch our latest videos':key==='facebook'?'Follow our Page & updates':'Visit our page'));
    a.append(icon,copy);socials.append(a);
  });
  const email=String(card.email||'').trim(),valid=/^[^\s@\r\n]+@[^\s@\r\n]+\.[^\s@\r\n]+$/.test(email);
  $('email-contact').hidden=!valid;
  if(valid){$('email-address').textContent=email;$('email-button').href='mailto:'+email;}
}

function draw(args){config=args;document.body.classList.toggle('preview',!!args.preview);const d=args.card;document.documentElement.style.setProperty('--ink',d.foreground);document.documentElement.style.setProperty('--accent',d.accent);document.documentElement.style.setProperty('--blush',d.background);$('name').textContent=d.name;$('tagline').textContent=d.tagline;$('description').textContent=d.description;
  const logo=$('logo');logo.replaceChildren();if(d.logo){const img=document.createElement('img');img.src=d.logo;img.alt=d.name+' logo';logo.append(img);}else{logo.innerHTML=args.flower;}
  const note=d.announcement||{};const expired=note.expires&&new Date(note.expires+'T23:59:59Z')<new Date();$('announcement').hidden=!(note.visible&&note.text&&!expired);$('announcement').textContent=note.text||'';
  updateEvents(d);
  const socials=$('socials');socials.replaceChildren();let instagram='https://www.instagram.com/nafbynafees/';withFacebook(d.links).filter(r=>r.visible).forEach(row=>{if(!safeUrl(row.url))return;const key=row.url.includes('instagram.com')?'instagram':row.url.includes('tiktok.com')?'tiktok':new URL(row.url).hostname.replace(/^www\./,'')==='facebook.com'?'facebook':'other';if(key==='instagram')instagram=row.url;const a=anchor('',row.url,'social');a.setAttribute('aria-label',row.label);a.title=row.label;const span=document.createElement('span');span.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+icons[key]+'</svg>';a.append(span);socials.append(a);});
  $('order').href=instagram;$('order').onclick=()=>event('social');$('contact').href='data:text/vcard;base64,'+args.vcard;$('contact').onclick=()=>event('contact');
  const grid=$('products');grid.replaceChildren();
  const collectionPhotos=[
    {src:'collection/gold-bangles.jpg',alt:'Gold-tone bangles with hanging charms'},
    {src:'collection/silver-bangles.jpg',alt:'Silver-tone bangles with hanging charms'},
    {src:'collection/red-pearl-bangles.jpg',alt:'Red bangles with pearl-style accents'}
  ];
  collectionPhotos.forEach(photo=>{const figure=document.createElement('figure');figure.className='product collection-photo';const img=document.createElement('img');img.src=photo.src;img.alt=photo.alt;img.loading='lazy';img.width=426;img.height=640;figure.append(img);grid.append(figure);});
  const products=(d.products||[]).filter(p=>p.visible);products.forEach(p=>{
    const item=anchor('',safeUrl(p.url)||instagram,'product','product');
    item.setAttribute('aria-label',[p.name,p.price,p.status,p.details].filter(Boolean).join(' · '));
    item.title=p.name;
    if(p.image){const img=document.createElement('img');img.src=p.image;img.alt=p.name;img.loading='lazy';item.append(img);}
    else item.append(text('div',p.name||'NAF','no-photo'));
    grid.append(item);
  });if(!products.length&&!collectionPhotos.length){const empty=text('div','Discover the latest bangles, jhumkas, henna, and accessories on our social platforms.','empty');empty.append(anchor('Browse on Instagram',instagram,''));grid.append(empty);}
  $('steps').replaceChildren(...(d.order_steps||[]).map(s=>text('li',s)));const delivery=$('delivery'),policies=$('policies');delivery.replaceChildren();policies.replaceChildren();Object.entries(d.delivery||{}).forEach(([key,value])=>{if(!value)return;const p=document.createElement('p');const names={area:'Where we deliver',pickup:'Pickup',processing:'When we ship',payment:'Payment options',returns:'Returns'};p.append(text('strong',names[key]||key),document.createTextNode(value));(key==='payment'||key==='returns'?policies:delivery).append(p);});const faqs=$('faqs');faqs.replaceChildren();(d.faqs||[]).forEach(f=>{const details=document.createElement('details');details.append(text('summary',f.question),text('div',f.answer,'detail-body'));faqs.append(details);});
  renderContact(d);
  $('qr').hidden=!args.qr;if(args.qr)$('qr').src=args.qr;$('qr-note').textContent=args.qr?'Scan to open our digital card.':'QR sharing becomes available after the published card URL is set.';$('qr-download').hidden=!args.qr;if(args.qr)$('qr-download').href=args.qr;$('qr-download').onclick=()=>event('qr');$('copy').disabled=!d.public_url;
  setTab(activeTab);send('streamlit:setFrameHeight',{height:610});if(!viewed&&!args.preview){viewed=true;event('view');}}
$('copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(config.card.public_url);$('share-status').textContent='Card link copied.';}catch{$('share-status').textContent=config.card.public_url||'Set the card URL first.';}});
window.addEventListener('message',e=>{if(e.source!==window.parent||e.data.type!=='streamlit:render')return;const signature=JSON.stringify(e.data.args);if(signature!==lastSignature){lastSignature=signature;draw(e.data.args);}else send('streamlit:setFrameHeight',{height:610});});send('streamlit:componentReady',{apiVersion:1});
