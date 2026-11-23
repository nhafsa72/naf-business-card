"""Branded presentation for the NAF Streamlit card."""
import base64
import html
import io
import re
from pathlib import Path
from urllib.parse import quote


def icon(name):
    paths = {
        'email': '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>',
        'instagram': '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',
        'tiktok': '<path d="M14 3v12a4 4 0 1 1-4-4M14 3c0 4 3 6 6 6"/>',
        'phone': '<path d="m7 3 3 5-3 3c1 3 3 5 6 6l3-3 5 3c-1 5-5 5-9 3C6 17 2 12 3 7c0-2 2-4 4-4Z"/>',
        'link': '<path d="m10 8 3-3a5 5 0 0 1 7 7l-3 3M14 16l-3 3a5 5 0 0 1-7-7l3-3M8 16l8-8"/>',
    }
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths.get(name, paths['link'])+'</svg>'


def flower():
    return '''<svg viewBox="0 0 160 170" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g stroke="currentColor" stroke-width="1.3"><path d="M78 106c-3-27-31-23-41-40-9-18 11-20 9-36-2-17 22-8 32-21 12-13 17 13 30 12 20-2 12 18 26 27 15 13-9 21-7 36 2 18-31 12-49 22Z"/><path d="M79 104C52 65 52 37 70 20M81 104c-2-42 7-62 28-76M80 104c11-33 27-48 49-48M78 104C51 79 39 71 35 58M80 105c-5 30 13 38 4 60M84 147c20-1 24-13 26-20-16 0-25 7-26 20M83 137c-19-1-22-10-24-16 12-1 21 5 24 16"/><path d="m70 100 1-22m7 24 4-28m3 30 12-25m-9 26 18-16"/><circle cx="71" cy="77" r="2"/><circle cx="83" cy="72" r="2"/><circle cx="98" cy="77" r="2"/></g></svg>'''


def render_card(st, data, vcard):
    esc = html.escape
    css = (Path(__file__).parent/'design.css').read_text('utf-8')
    css = css.replace('ACCENT_COLOR', data['accent']).replace('TEXT_COLOR', data['foreground']).replace('BLUSH_COLOR', data['background'])
    st.markdown('<style>'+css+'</style>', unsafe_allow_html=True)
    image = data['logo']
    if not image:
        for filename in ('logo.png', 'assets/logo.png', 'Logo for web.png'):
            local = Path(__file__).parent/filename
            if local.is_file():
                image = 'data:image/png;base64,'+base64.b64encode(local.read_bytes()).decode()
                break
    logo = '<img src="'+esc(image, quote=True)+'" alt="NAF by Nafees logo">' if image else '<div class="floral-mark">'+flower()+'</div>'
    st.markdown('<div class="naf-topline"><span>NAF BY NAFEES</span><span>THE LITTLE DETAILS</span></div>', unsafe_allow_html=True)
    st.markdown('''<section class="naf-hero"><div class="hero-wash wash-one"></div><div class="hero-wash wash-two"></div><span class="sparkle sparkle-one">✦</span><span class="sparkle sparkle-two">✧</span><div class="logo-medallion">'''+logo+'''</div><p class="naf-kicker">JEWELRY · HENNA · ACCESSORIES</p><h1>'''+esc(data['name'])+'''</h1><div class="fine-divider"><span></span>✧<span></span></div><p class="naf-tagline">'''+esc(data['tagline'])+'''</p><p class="naf-description">'''+esc(data['description'])+'''</p></section>''', unsafe_allow_html=True)
    st.markdown('<div class="naf-section-label">A LITTLE SOMETHING FOR EVERY OCCASION</div><div class="naf-chips"><span>Bangles</span><span>Jhumkas</span><span>Henna</span><span>Hair accessories</span></div>', unsafe_allow_html=True)
    if data['email']:
        url = 'mailto:'+quote(data['email'], safe='@.+')+'?subject=NAF%20Order%20Inquiry'
        st.markdown('<a class="naf-order" href="'+esc(url, quote=True)+'"><span class="naf-icon">'+icon('email')+'</span><span><strong>Find your next little favorite</strong><small>Email us to order or ask a question</small></span><span class="order-label">LET’S TALK</span></a>', unsafe_allow_html=True)
    st.markdown('<div class="naf-section-heading"><span></span><h2>Let’s stay connected</h2><span></span></div>', unsafe_allow_html=True)
    rows = []
    for row in data['links']:
        if not row['visible']:
            continue
        name = row['label'].lower()
        kind = 'instagram' if 'instagram' in name else 'tiktok' if 'tiktok' in name else 'link'
        subtitle = 'The details, up close' if kind == 'instagram' else 'A little style inspiration' if kind == 'tiktok' else 'Explore more from NAF'
        rows.append('<a class="naf-social" href="'+esc(row['url'], quote=True)+'" target="_blank" rel="noopener noreferrer"><span class="naf-icon">'+icon(kind)+'</span><span><strong>'+esc(row['label'])+'</strong><small>'+subtitle+'</small></span><span class="naf-visit">VISIT</span></a>')
    if data['phone']:
        rows.append('<a class="naf-social" href="tel:'+esc(re.sub(r'[^+\d]', '', data['phone']), quote=True)+'"><span class="naf-icon">'+icon('phone')+'</span><span><strong>Call us</strong><small>'+esc(data['phone'])+'</small></span></a>')
    st.markdown('<div class="naf-socials">'+''.join(rows)+'</div>', unsafe_allow_html=True)
    st.markdown('<div class="naf-keep"><span class="naf-kicker">KEEP US CLOSE</span><h2>A little sparkle.<br><em>Always within reach.</em></h2><p>Save NAF to your contacts for your next occasion.</p></div>', unsafe_allow_html=True)
    st.download_button('＋  Save NAF to contacts', vcard(data), 'NAF-by-Nafees.vcf', 'text/vcard', use_container_width=True)
    for field, label in [('apple_wallet','Add to Apple Wallet'), ('samsung_wallet','Add to Samsung Wallet')]:
        if data[field]:
            st.link_button(label, data[field], use_container_width=True)
    if data['public_url']:
        with st.expander('Share a little sparkle · QR code'):
            import qrcode
            output = io.BytesIO()
            qrcode.make(data['public_url']).save(output,format='PNG')
            st.image(output.getvalue(),width=230)
            st.code(data['public_url'],language=None)
            st.download_button('Download QR code',output.getvalue(),'NAF-QR.png','image/png')
    st.markdown('<footer class="naf-footer"><span>NAF BY NAFEES</span><p>Tradition, with a personal touch.</p></footer>', unsafe_allow_html=True)
