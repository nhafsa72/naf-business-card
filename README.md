# NAF by Nafees — compact business hub

Live card: https://naf-business-card.streamlit.app/

Owner panel: https://naf-business-card.streamlit.app/?page=admin

## Customer experience

A compact mobile card with Home, Collection, Order Info and Share tabs. Instagram ordering and Save Contact remain available at the bottom. Each tab scrolls independently only when needed. The card includes business details, social links, ordering steps, delivery/payment/return information, FAQs and a downloadable QR code. No wallet or email-order buttons are shown.

Delivery is across the United States, with no pickups. Orders ship within 3 days; transit time is additional. Payments are by Zelle or PayPal, arranged through Instagram. Returns are reviewed case by case.

## Owner setup

Set these values in Streamlit Cloud app settings → Secrets. Never commit actual passwords or tokens:

```toml
admin_password = "YOUR-UNIQUE-RANDOM-PASSWORD-AT-LEAST-16-CHARACTERS"
[github]
repository = "nhafsa72/naf-business-card"
branch = "main"
token = "YOUR-FINE-GRAINED-GITHUB-TOKEN"
```

Limit the token to this repository with Contents: Read and write permission. Set an expiration you can maintain. Public card data and anonymous aggregate totals are stored in this repository; do not put private customer information in the editor.

Without these secrets the public card works from bundled data, but owner saves and analytics recording are disabled. The owner password must be configured before the editor can be used.

## Editing

Sign into the owner panel. Upload your real NAF logo, or place it at logo.png in the repository root. A decorative floral placeholder appears until the original logo is supplied.

Add up to six real featured products with photos, USD prices, available sizes/details, product links, visibility, and Available/Sold out/Coming soon status. No example products are published as inventory. Unused slots stay hidden. Uploaded photos are compressed; keep the complete card under 900 KB.

Edit delivery details, ordering steps and FAQs. Announcements can be shown/hidden and given an optional expiry date (UTC). Keep announcements short for the compact layout.

Click Preview changes, review the interactive draft, then Publish preview. Drafts are session-only and do not reach customers until publication. Publish submits the exact preview, not any subsequent unpreviewed form changes. Discard preview removes it. Concurrent changes are protected by the GitHub file SHA; reload after a conflict.

## Activity dashboard

Counts approximate browser-session views, social link clicks, contact-download clicks, product-link clicks and QR-download clicks. It stores daily UTC totals only, with no IP addresses, customer names, contact information or persistent visitor IDs. It is not an exact unique-visitor count. Browser blockers and network/API failures may drop events. Preview interactions are not counted. Download a CSV in the owner panel. Totals begin after deployment, not retroactively.

Analytics requires the GitHub token above and uses a separate data/analytics.json file. It is created on the first successful event. Activity and content updates create commits and are intended for modest business-card traffic. High traffic should move counters to a dedicated database. Token expiration, API limits or branch restrictions can prevent saving/counting. An analytics failure does not block customer navigation.

## Files

app.py: public/owner routing, authentication and card persistence.
owner_features.py: product/business editors, validation and aggregate counters.
card_design.py: Python wrapper for the compact custom component.
frontend/: static HTML/CSS/JavaScript for the public card and event callbacks.
data/card.json: public business details, photos and links.
requirements.txt: Python dependencies.

## Local run

```sh
python -m pip install -r requirements.txt
streamlit run app.py
```

For local admin use, put the secrets above in .streamlit/secrets.toml and keep it out of Git. Streamlit Community Cloud can sleep after inactivity. Saved wallet passes are not issued by this app.
