"""NAF by Nafees: public card + private editor. Run: streamlit run app.py."""
import base64
import copy
import hashlib
import hmac
import html
import io
import json
import re
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urlparse
from urllib.request import Request, urlopen

DEFAULT = {
    "name": "NAF by Nafees",
    "tagline": "A little tradition. A little sparkle. All you.",
    "description": "Bangles, jhumkas, bracelets, henna cones, and hair accessories for everyday beauty and special occasions.",
    "email": "nafbynafees@gmail.com", "phone": "", "public_url": "",
    "background": "#F4E3E3", "foreground": "#302722", "accent": "#70552C",
    "logo": "", "apple_wallet": "", "samsung_wallet": "",
    "links": [
        {"label": "Instagram", "url": "https://www.instagram.com/nafbynafees/", "visible": True},
        {"label": "TikTok", "url": "https://www.tiktok.com/@nafbynafees", "visible": True},
    ],
}


def https_url(value):
    value = str(value or "").strip()
    parsed = urlparse(value)
    if (parsed.scheme != "https" or not parsed.hostname or parsed.username
            or parsed.password or any(c.isspace() for c in value)):
        raise ValueError("Links must be complete https:// addresses without spaces or embedded credentials.")
    return value


def validate(data):
    result = copy.deepcopy(DEFAULT)
    result.update({k: v for k, v in data.items() if k in DEFAULT})
    for field in ("name", "tagline", "description", "email", "phone", "public_url", "logo", "apple_wallet", "samsung_wallet"):
        if not isinstance(result[field], str):
            raise ValueError(f"Invalid {field}.")
        result[field] = result[field].strip()
    if not result["name"] or len(result["name"]) > 100:
        raise ValueError("Business name is required (up to 100 characters).")
    if len(result["description"]) > 1500 or len(result["tagline"]) > 200:
        raise ValueError("Please shorten the description or tagline.")
    if result["email"] and not re.fullmatch(r"[^\s@\r\n]+@[^\s@\r\n]+\.[^\s@\r\n]+", result["email"]):
        raise ValueError("Enter a valid email address.")
    if result["phone"] and not re.fullmatch(r"[+\d() .-]{5,30}", result["phone"]):
        raise ValueError("Phone numbers may contain digits, +, spaces, parentheses, periods, or hyphens.")
    for field in ("background", "foreground", "accent"):
        if not re.fullmatch(r"#[0-9a-fA-F]{6}", str(result[field])):
            raise ValueError("Colors must have six-digit HEX values.")
    for field in ("public_url", "apple_wallet", "samsung_wallet"):
        if result[field]:
            result[field] = https_url(result[field])
    if result["logo"]:
        if not result["logo"].startswith("data:image/png;base64,") or len(result["logo"]) > 500_000:
            raise ValueError("Upload the logo through the image uploader.")
        try:
            raw = base64.b64decode(result["logo"].split(",", 1)[1], validate=True)
        except ValueError:
            raise ValueError("Invalid logo image.") from None
        if not raw.startswith(b"\x89PNG\r\n\x1a\n"):
            raise ValueError("Invalid PNG logo.")
    links = []
    if not isinstance(result["links"], list) or len(result["links"]) > 40:
        raise ValueError("Use up to 40 links.")
    for row in result["links"]:
        label, url = str(row.get("label") or "").strip(), str(row.get("url") or "").strip()
        if not label and not url:
            continue
        if not label or len(label) > 80:
            raise ValueError("Each link needs a label of up to 80 characters.")
        links.append({"label": label, "url": https_url(url), "visible": bool(row.get("visible", True))})
    result["links"] = links
    return result


def vcard(data):
    def escape(value):
        return str(value).replace("\\", "\\\\").replace("\r", "").replace("\n", "\\n").replace(";", "\\;").replace(",", "\\,")
    lines = ["BEGIN:VCARD", "VERSION:3.0", "N:;" + escape(data["name"]) + ";;;", "FN:" + escape(data["name"]), "ORG:" + escape(data["name"])]
    if data["email"]:
        lines.append("EMAIL;TYPE=INTERNET,WORK:" + escape(data["email"]))
    if data["phone"]:
        lines.append("TEL;TYPE=WORK:" + escape(data["phone"]))
    if data["public_url"]:
        lines.append("URL:" + escape(data["public_url"]))
    for row in data["links"]:
        if row["visible"]:
            lines.append("URL:" + escape(row["url"]))
    lines += ["NOTE:" + escape(data["description"]), "END:VCARD"]
    # Fold lines at 75 UTF-8 octets, including the continuation space.
    folded = []
    for line in lines:
        current = ""
        for char in line:
            if len((current + char).encode("utf-8")) > 75:
                folded.append(current)
                current = " "
            current += char
        folded.append(current)
    return ("\r\n".join(folded) + "\r\n").encode("utf-8")


class CardStore:
    """Save public content in a single GitHub file using optimistic concurrency."""
    def __init__(self, settings):
        self.repo = str(settings.get("repository", "")).strip()
        self.token = str(settings.get("token", ""))
        self.branch = str(settings.get("branch", "main"))
        self.path = "data/card.json"
        if self.repo and not re.fullmatch(r"[\w.-]+/[\w.-]+", self.repo):
            raise ValueError("Repository must be owner/repository.")

    @property
    def ready(self):
        return bool(self.repo and self.token)

    def request(self, method, body=None):
        endpoint = f"https://api.github.com/repos/{self.repo}/contents/{self.path}"
        if method == "GET":
            endpoint += "?" + urlencode({"ref": self.branch})
        headers = {"Accept": "application/vnd.github+json", "Authorization": f"Bearer {self.token}", "User-Agent": "NAF-card-admin"}
        raw = json.dumps(body).encode() if body is not None else None
        if raw is not None:
            headers["Content-Type"] = "application/json"
        try:
            with urlopen(Request(endpoint, data=raw, headers=headers, method=method), timeout=15) as response:
                return json.load(response)
        except HTTPError as error:
            if error.code == 404 and method == "GET":
                raise RuntimeError("Card data was not found. Check the repository, branch, token access, and data/card.json upload.") from None
            if error.code in (409, 422):
                raise RuntimeError("The saved card changed or GitHub rejected the update. Reload the editor before saving again.") from None
            raise RuntimeError(f"GitHub request failed ({error.code}). Check repository permissions and branch rules.") from None
        except (URLError, TimeoutError):
            raise RuntimeError("Could not reach GitHub. Please try again; no successful save has been confirmed.") from None

    def load(self):
        if not self.ready:
            local = Path(__file__).parent / self.path
            return validate(json.loads(local.read_text("utf-8"))) if local.exists() else copy.deepcopy(DEFAULT), None
        response = self.request("GET")
        data = json.loads(base64.b64decode(response["content"]).decode("utf-8"))
        return validate(data), response["sha"]

    def save(self, data, expected_sha):
        if not self.ready or not expected_sha:
            raise RuntimeError("Configure durable GitHub storage before saving.")
        data = validate(data)
        payload = base64.b64encode((json.dumps(data, indent=2, ensure_ascii=False) + "\n").encode()).decode()
        return self.request("PUT", {"message": "Update NAF business card from admin panel", "content": payload, "sha": expected_sha, "branch": self.branch})


def logo_data(upload):
    from PIL import Image, ImageOps
    if upload.size > 5 * 1024 * 1024:
        raise ValueError("Please upload a logo smaller than 5 MB.")
    with Image.open(upload) as original:
        if original.width * original.height > 20_000_000:
            raise ValueError("Please upload a smaller image (under 20 megapixels).")
        image = ImageOps.exif_transpose(original).convert("RGBA")
        image.thumbnail((500, 500))
        output = io.BytesIO()
        image.save(output, format="PNG", optimize=True)
    encoded = "data:image/png;base64," + base64.b64encode(output.getvalue()).decode()
    if len(encoded) > 500_000:
        raise ValueError("Please use a simpler or smaller logo image.")
    return encoded


def main():
    import streamlit as st
    st.set_page_config(page_title="NAF by Nafees", page_icon="🌸", layout="centered")
    try:
        settings = dict(st.secrets)
    except FileNotFoundError:
        settings = {}
    store = CardStore(settings.get("github", {}))
    admin = st.query_params.get("page") == "admin"
    if admin:
        render_admin(st, store, settings)
    else:
        try:
            data, _ = store.load()
        except (RuntimeError, ValueError, KeyError, json.JSONDecodeError):
            st.error("The card is temporarily unavailable. Please refresh in a moment.")
            st.stop()
        render_card(st, data)


def render_card(st, data):
    esc = html.escape
    st.markdown(f"""<style>
    .stApp {{ background: {data['background']}; color: {data['foreground']}; }}
    .block-container {{max-width:560px;padding-top:2.5rem;padding-bottom:2rem;}}
    .brand {{text-align:center;padding:1rem 0 1.7rem;}}
    .brand img {{width:170px;height:170px;object-fit:contain;border-radius:50%;background:white;padding:12px;}}
    .monogram {{font:70px Georgia,serif;color:{data['accent']};margin:0;}}
    .brand h1 {{font:36px Georgia,serif;color:{data['foreground']};margin:20px 0 14px;}}
    .tagline {{font:italic 23px/1.35 Georgia,serif;color:{data['accent']};}}
    .description {{font-size:17px;line-height:1.7;max-width:410px;margin:20px auto 0;}}
    .card-link {{display:block;background:#fffdf9;color:{data['foreground']} !important;text-decoration:none !important;border:1px solid #0002;border-radius:12px;padding:18px 22px;margin:12px 0;font-size:17px;}}
    .card-link:hover {{box-shadow:0 3px 12px #0001;}}
    .card-link:focus-visible {{outline:3px solid {data['accent']};outline-offset:3px;}}
    .contact-link {{background:{data['accent']};color:#fff !important;}}
    </style>""", unsafe_allow_html=True)
    logo = f'<img src="{esc(data["logo"], quote=True)}" alt="Business logo">' if data["logo"] else '<div class="monogram">NAF</div>'
    st.markdown(f'<div class="brand">{logo}<h1>{esc(data["name"])}</h1><p class="tagline">{esc(data["tagline"])}</p><p class="description">{esc(data["description"])}</p></div>', unsafe_allow_html=True)
    def link(label, url, primary=False):
        st.markdown(f'<a class="card-link {"contact-link" if primary else ""}" href="{esc(url, quote=True)}" target="_blank" rel="noopener noreferrer">{esc(label)}</a>', unsafe_allow_html=True)
    if data["email"]:
        link("Email to order", "mailto:" + quote(data["email"], safe="@.+") + "?subject=NAF%20Order%20Inquiry", True)
    if data["phone"]:
        link("Call us", "tel:" + re.sub(r"[^+\d]", "", data["phone"]))
    for row in data["links"]:
        if row["visible"]:
            link(row["label"], row["url"])
    st.download_button("Save contact", vcard(data), "NAF-by-Nafees.vcf", "text/vcard", use_container_width=True)
    if data["apple_wallet"]:
        st.link_button("Add to Apple Wallet", data["apple_wallet"], use_container_width=True)
    if data["samsung_wallet"]:
        st.link_button("Add to Samsung Wallet", data["samsung_wallet"], use_container_width=True)
    if data["public_url"]:
        with st.expander("Share this card"):
            import qrcode
            output = io.BytesIO()
            qrcode.make(data["public_url"]).save(output, format="PNG")
            st.image(output.getvalue(), width=230)
            st.code(data["public_url"], language=None)
            st.download_button("Download QR code", output.getvalue(), "NAF-QR.png", "image/png")
    st.caption("A little tradition. A little sparkle. All you.")


def render_admin(st, store, settings):
    st.title("NAF card studio")
    password = str(settings.get("admin_password", ""))
    if len(password) < 16:
        st.info("Admin setup required: set admin_password (at least 16 characters) in Streamlit Secrets. Public visitors can still view your card.")
        return
    fingerprint = hashlib.sha256(password.encode()).hexdigest()
    if st.session_state.get("admin_auth") != fingerprint:
        with st.form("login"):
            entered = st.text_input("Admin password", type="password")
            submitted = st.form_submit_button("Sign in")
        if submitted:
            if time.time() < st.session_state.get("retry_after", 0):
                st.error("Please wait a few seconds before trying again.")
            elif hmac.compare_digest(entered.encode(), password.encode()):
                st.session_state.admin_auth = fingerprint
                st.rerun()
            else:
                st.session_state.retry_after = time.time() + 5
                st.error("Incorrect password.")
        return
    if st.button("Sign out"):
        st.session_state.clear()
        st.rerun()
    if not store.ready:
        st.warning("Configure the GitHub repository and token in Streamlit Secrets to enable durable saving.")
        return
    if st.button("Reload saved card"):
        st.session_state.pop("editor_data", None)
        st.session_state.pop("editor_sha", None)
        st.session_state.editor_version = st.session_state.get("editor_version", 0) + 1
        st.rerun()
    if "editor_data" not in st.session_state:
        try:
            st.session_state.editor_data, st.session_state.editor_sha = store.load()
        except (RuntimeError, ValueError, KeyError) as error:
            st.error(str(error))
            return
    data = copy.deepcopy(st.session_state.editor_data)
    version = st.session_state.get("editor_version", 0)
    if st.session_state.pop("saved_notice", False):
        st.success("Saved to GitHub. Your public card will use these details on its next load.")
    st.caption("Only public business information belongs here. Your repository may be public.")
    with st.form(f"editor_{version}"):
        data["name"] = st.text_input("Business name", data["name"])
        data["tagline"] = st.text_input("Tagline", data["tagline"])
        data["description"] = st.text_area("Business description", data["description"])
        data["email"] = st.text_input("Public contact email", data["email"])
        data["phone"] = st.text_input("Public phone (optional)", data["phone"])
        data["public_url"] = st.text_input("Published Streamlit app URL (for QR code)", data["public_url"], placeholder="https://your-card.streamlit.app/")
        st.subheader("Branding")
        upload = st.file_uploader("Upload your logo", type=["png", "jpg", "jpeg", "webp"])
        remove_logo = st.checkbox("Remove saved logo")
        for field, label in (("background", "Background"), ("foreground", "Text"), ("accent", "Accent / order button")):
            data[field] = st.color_picker(label, data[field])
        st.subheader("Links")
        st.caption("Add or delete rows. Row order sets display order. Uncheck Visible to hide a link.")
        rows = data["links"] or [{"label": "", "url": "", "visible": True}]
        data["links"] = st.data_editor(rows, num_rows="dynamic", hide_index=True, use_container_width=True,
            column_config={"label": st.column_config.TextColumn("Button label", required=True),
                           "url": st.column_config.TextColumn("HTTPS destination", required=True),
                           "visible": st.column_config.CheckboxColumn("Visible", default=True)}, key=f"links_{version}")
        st.subheader("Wallet passes")
        st.caption("These fields connect issued wallet passes. This app does not issue, sign, or automatically update passes saved in a wallet. Leave blank until tested; no wallet button will appear.")
        data["apple_wallet"] = st.text_input("Apple Wallet pass download / issuer link", data["apple_wallet"])
        data["samsung_wallet"] = st.text_input("Samsung Wallet Add to Wallet link", data["samsung_wallet"])
        save = st.form_submit_button("Save changes to GitHub", type="primary")
    if save:
        try:
            if remove_logo:
                data["logo"] = ""
            elif upload:
                data["logo"] = logo_data(upload)
            data = validate(data)
            store.save(data, st.session_state.editor_sha)
        except (RuntimeError, ValueError, OSError) as error:
            st.error(str(error))
        else:
            st.session_state.pop("editor_data", None)
            st.session_state.pop("editor_sha", None)
            st.session_state.editor_version = version + 1
            st.session_state.saved_notice = True
            st.rerun()


if __name__ == "__main__":
    main()
