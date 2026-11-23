"""Compact card component with preview support and anonymous event callbacks."""
import base64
import copy
import io
from pathlib import Path
from owner_features import Analytics

def flower():
    return '''<svg viewBox="0 0 160 170" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g stroke="currentColor" stroke-width="1.3"><path d="M78 106c-3-27-31-23-41-40-9-18 11-20 9-36-2-17 22-8 32-21 12-13 17 13 30 12 20-2 12 18 26 27 15 13-9 21-7 36 2 18-31 12-49 22Z"/><path d="M79 104C52 65 52 37 70 20M81 104c-2-42 7-62 28-76M80 104c11-33 27-48 49-48M78 104C51 79 39 71 35 58M80 105c-5 30 13 38 4 60M84 147c20-1 24-13 26-20-16 0-25 7-26 20M83 137c-19-1-22-10-24-16 12-1 21 5 24 16"/><path d="m70 100 1-22m7 24 4-28m3 30 12-25m-9 26 18-16"/><circle cx="71" cy="77" r="2"/><circle cx="83" cy="72" r="2"/><circle cx="98" cy="77" r="2"/></g></svg>'''


def render_card(st,data,vcard,store=None,preview=False):
    import streamlit.components.v1 as components
    st.markdown("""<style>
    .stApp{background:radial-gradient(ellipse at 10% 0%,#ecd0d5,transparent 65%),#f5efea;color:#302722}
    header[data-testid="stHeader"]{background:transparent!important}
    [data-testid="stMain"]{overflow-y:auto!important;overflow-x:hidden!important}
    [data-testid="stMainBlockContainer"]{max-width:560px!important;padding:12px 12px 10px!important;margin:0 auto!important;flex-shrink:0!important}
    iframe[title*="naf_compact_card"]{border:0!important}
    </style>""",unsafe_allow_html=True)
    card=copy.deepcopy(data)
    if not card['logo']:
        for name in ['logo.png','assets/logo.png','Logo for web.png']:
            path=Path(__file__).parent/name
            if path.is_file():
                card['logo']='data:image/png;base64,'+base64.b64encode(path.read_bytes()).decode()
                break
    qr=''
    if card['public_url']:
        import qrcode
        output=io.BytesIO()
        qrcode.make(card['public_url']).save(output,format='PNG')
        qr='data:image/png;base64,'+base64.b64encode(output.getvalue()).decode()
    component=components.declare_component('naf_compact_card',path=str(Path(__file__).parent/'frontend'))
    event=component(card=card,vcard=base64.b64encode(vcard(data)).decode(),qr=qr,flower=flower(),preview=preview,key='preview_card' if preview else 'public_card',default=None)
    if not preview and store and event and event.get('event') in ['view','social','contact','product','qr']:
        event_id=event.get('id')
        seen=st.session_state.setdefault('seen_card_events',[])
        if isinstance(event_id,str) and event_id not in seen:
            seen.append(event_id)
            del seen[:-100]
            if not Analytics(store).count(event['event']):
                st.session_state['analytics_unavailable']=True
