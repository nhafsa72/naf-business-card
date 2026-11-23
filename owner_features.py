"""Business content, owner controls, and anonymous aggregate counters."""
import base64
import copy
import io
import json
import time
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

EXTRA = {
    'announcement': {'text': '', 'visible': False, 'expires': ''},
    'products': [],
    'delivery': {
        'area': 'Delivery across the United States.',
        'pickup': 'Delivery only. No pickup available.',
        'processing': 'Orders are shipped within 3 days of ordering. Transit time is additional.',
        'payment': 'Zelle or PayPal. Message us on Instagram to confirm payment details.',
        'returns': 'Return requests are reviewed case by case, depending on the item and situation. Message us on Instagram to discuss your order.'},
    'order_steps': ['Screenshot your favorite item.', 'Message us on Instagram to confirm availability, sizing, delivery charges, and your order total.', 'Confirm payment and delivery details with us.'],
    'faqs': [
        {'question': 'How do I choose my bangle size?', 'answer': 'Message us on Instagram with the item you like and your usual bangle size. We will help confirm the available sizes.'},
        {'question': 'How should I store my henna cones?', 'answer': 'Message us for the storage instructions and ingredients for the specific cone before ordering.'},
    ],
}


def clean_extra(data, https_url):
    result = copy.deepcopy(EXTRA)
    for key in EXTRA:
        if key in data:
            result[key] = copy.deepcopy(data[key])
    def text(value, limit=1500):
        if not isinstance(value, str) or len(value) > limit:
            raise ValueError('Please shorten the business information and use plain text.')
        return value.strip()
    note = result['announcement']
    result['announcement'] = {'text': text(note.get('text',''),240), 'visible': bool(note.get('visible',False)), 'expires': text(note.get('expires',''),10)}
    if result['announcement']['expires']:
        datetime.strptime(result['announcement']['expires'], '%Y-%m-%d')
    result['delivery'] = {k:text(result['delivery'].get(k,'')) for k in EXTRA['delivery']}
    if not isinstance(result['order_steps'],list) or len(result['order_steps']) > 6:
        raise ValueError('Use up to six ordering steps.')
    result['order_steps'] = [text(v,500) for v in result['order_steps'] if v]
    if not isinstance(result['faqs'],list) or len(result['faqs']) > 12:
        raise ValueError('Use up to twelve FAQs.')
    result['faqs'] = [{'question':text(v.get('question',''),160),'answer':text(v.get('answer',''))} for v in result['faqs'] if v.get('question') and v.get('answer')]
    if not isinstance(result['products'],list) or len(result['products']) > 6:
        raise ValueError('Use up to six featured products.')
    products=[]
    for item in result['products']:
        p={k:text(item.get(k,''),limit) for k,limit in [('name',100),('price',60),('details',400),('image',160000),('url',500)]}
        p['status']=item.get('status','Available')
        if p['status'] not in ['Available','Sold out','Coming soon']:
            raise ValueError('Choose a valid product status.')
        p['visible']=bool(item.get('visible',False))
        if p['visible'] and not p['name']:
            raise ValueError('Published products need a name.')
        if p['url']:
            p['url']=https_url(p['url'])
        if p['image']:
            if not p['image'].startswith('data:image/jpeg;base64,'):
                raise ValueError('Use the product photo uploader.')
            raw=base64.b64decode(p['image'].split(',',1)[1],validate=True)
            if not raw.startswith(b'\xff\xd8'):
                raise ValueError('Invalid product image.')
        if p['name'] or p['image']:
            products.append(p)
    result['products']=products
    return result


def product_photo(upload):
    from PIL import Image, ImageOps
    if upload.size>5*1024*1024:
        raise ValueError('Use a product photo under 5 MB.')
    with Image.open(upload) as original:
        if original.width*original.height>20_000_000:
            raise ValueError('Use a photo under 20 megapixels.')
        image=ImageOps.exif_transpose(original).convert('RGB')
        image.thumbnail((640,640))
        for quality in (78,62,45):
            out=io.BytesIO();image.save(out,'JPEG',quality=quality,optimize=True)
            encoded='data:image/jpeg;base64,'+base64.b64encode(out.getvalue()).decode()
            if len(encoded)<160000:
                return encoded
    raise ValueError('Please use a smaller product photo.')


def owner_fields(st,data,version):
    data.update({k:copy.deepcopy(data.get(k,v)) for k,v in EXTRA.items()})
    with st.expander('Announcement / holiday deadline'):
        a=data['announcement']
        a['visible']=st.checkbox('Show announcement',value=a['visible'])
        a['text']=st.text_input('Announcement text',value=a['text'],max_chars=240)
        a['expires']=st.text_input('Hide after date (optional, YYYY-MM-DD)',value=a['expires'])
    with st.expander('Delivery, payments and returns'):
        for key,label in [('area','Delivery area'),('pickup','Pickup availability'),('processing','Shipping / processing time'),('payment','Payment options'),('returns','Returns policy')]:
            data['delivery'][key]=st.text_area(label,value=data['delivery'][key])
        steps=st.text_area('How to order (one step per line)',value='\n'.join(data['order_steps']))
        data['order_steps']=[s.strip() for s in steps.splitlines() if s.strip()]
    with st.expander('Frequently asked questions'):
        data['faqs']=st.data_editor(data['faqs'] or [{'question':'','answer':''}],num_rows='dynamic',hide_index=True,key=f'faq_{version}',use_container_width=True)
    st.subheader('Featured collection')
    st.caption('Up to six real products. Leave unused slots blank. Prices are text, for example $12. Product photos are compressed before saving.')
    saved=list(data['products']);products=[]
    for i in range(6):
        p=copy.deepcopy(saved[i]) if i<len(saved) else {'name':'','price':'','details':'','image':'','url':'','visible':False,'status':'Available'}
        with st.expander(f"Product {i+1}"+(' · '+p['name'] if p['name'] else ' · empty')):
            p['name']=st.text_input('Product name',p['name'],key=f'pname_{i}_{version}')
            p['price']=st.text_input('Price (USD)',p['price'],key=f'pprice_{i}_{version}')
            p['details']=st.text_area('Short details / available sizes',p['details'],key=f'pdetails_{i}_{version}')
            p['status']=st.selectbox('Availability',['Available','Sold out','Coming soon'],index=['Available','Sold out','Coming soon'].index(p['status']),key=f'pstatus_{i}_{version}')
            p['url']=st.text_input('Product post link (optional)',p['url'],key=f'purl_{i}_{version}')
            p['visible']=st.checkbox('Show this product',p['visible'],key=f'pvisible_{i}_{version}')
            photo=st.file_uploader('Product photo',type=['jpg','jpeg','png','webp'],key=f'pphoto_{i}_{version}')
            if photo:
                p['image']=product_photo(photo)
            if p['image']:
                st.image(base64.b64decode(p['image'].split(',',1)[1]),width=100)
            if st.checkbox('Clear product photo',key=f'pclear_{i}_{version}'):
                p['image']=''
        products.append(p)
    data['products']=products
    return data


class Analytics:
    """Only daily aggregate events, no customer identifiers or contact data."""
    def __init__(self,store):
        self.store=store
        self.url=f'https://api.github.com/repos/{store.repo}/contents/data/analytics.json'
    def request(self,method,payload=None):
        headers={'Authorization':f'Bearer {self.store.token}','Accept':'application/vnd.github+json','User-Agent':'NAF-card-analytics'}
        url=self.url+('?ref='+quote(self.store.branch,safe='') if method=='GET' else '')
        raw=json.dumps(payload).encode() if payload is not None else None
        if raw:headers['Content-Type']='application/json'
        with urlopen(Request(url,data=raw,headers=headers,method=method),timeout=8) as response:
            return json.load(response)
    def load(self):
        try:
            obj=self.request('GET')
            return json.loads(base64.b64decode(obj['content'])),obj['sha']
        except HTTPError as error:
            if error.code==404:return {'days':{}},None
            raise
    def count(self,event):
        if not self.store.ready:return False
        for attempt in range(2):
            try:
                data,sha=self.load()
                day=datetime.now(timezone.utc).date().isoformat()
                counts=data.setdefault('days',{}).setdefault(day,{})
                counts[event]=counts.get(event,0)+1
                data['days']={k:v for k,v in sorted(data['days'].items())[-180:]}
                payload={'message':'Update anonymous card activity totals','content':base64.b64encode(json.dumps(data).encode()).decode(),'branch':self.store.branch}
                if sha:payload['sha']=sha
                self.request('PUT',payload)
                return True
            except HTTPError as error:
                if error.code not in (409,422):return False
            except (URLError,TimeoutError,ValueError,KeyError):return False
        return False


def analytics_panel(st,store):
    with st.expander('Activity dashboard'):
        st.caption('Approximate browser-session views, social clicks and contact downloads. No customer names, IP addresses or identifiers are stored. Counts begin after this upgrade; they are not historical or guaranteed unique visitors.')
        try:
            data,_=Analytics(store).load()
        except (HTTPError,URLError,TimeoutError,ValueError,KeyError):
            st.info('Activity totals are temporarily unavailable. Check GitHub storage access.')
            return
        totals={}
        rows=[]
        for day,counts in sorted(data.get('days',{}).items(),reverse=True):
            rows.append({'Date (UTC)':day,**counts})
            for k,v in counts.items():totals[k]=totals.get(k,0)+v
        cols=st.columns(3)
        for col,label,key in zip(cols,['Card views','Social clicks','Contact downloads'],['view','social','contact']):col.metric(label,totals.get(key,0))
        if rows:st.dataframe(rows,use_container_width=True,hide_index=True)
        else:st.info('No activity recorded yet.')
        st.download_button('Export activity CSV',csv_totals(rows),'NAF-activity.csv','text/csv')


def csv_totals(rows):
    import csv
    output=io.StringIO()
    keys=['Date (UTC)','view','social','contact','product']
    writer=csv.DictWriter(output,fieldnames=keys,extrasaction='ignore');writer.writeheader();writer.writerows(rows)
    return output.getvalue()
