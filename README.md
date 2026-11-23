# NAF by Nafees — fresh Python business card

This is a separate Streamlit project. It does not use or change your previous GitHub Pages card.

## Files to upload to your new GitHub repository

- `app.py`
- `requirements.txt`
- `data/card.json` (keep it inside the `data` folder)
- `.gitignore`
- `README.md`
- `secrets.example.toml` contains placeholders only and is safe to keep, but is not the active configuration.

## Publish

1. Create your new repository and upload the files above. Make sure the branch is `main`.
2. In Streamlit Community Cloud, create an app from that repository. Set the main file to `app.py`. Deploy.
3. The public business card works immediately with your current business email, Instagram, and TikTok. The initial logo is a text mark; upload your floral logo through the admin panel after setup.

## Enable the private admin panel

1. In GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens, generate a token limited to this new repository with Repository permissions → Contents: Read and write. Set an expiration you can maintain. Do not give access to all repositories.
2. In Streamlit app settings → Secrets, copy `secrets.example.toml`, replacing the password, repository name, and token. Use a unique random admin password at least 16 characters long. Do not send or commit those values.
3. Open `https://YOUR-APP.streamlit.app/?page=admin` and sign in. The admin uses password authentication; the URL alone does not unlock editing. For a larger team or public launch with stronger identity controls, replace this simple login with an identity provider and account allowlist.
4. Add the actual published Streamlit address in the Published app URL field. Upload your original floral logo and click Save changes to GitHub.
5. Return to the main app URL without `?page=admin` to view the card. Expand Share this card to download its QR code.

The account email used to sign into Streamlit can differ from the public business email.

## How updates are saved

The editor writes public card settings and the resized logo to `data/card.json` through GitHub's Contents API. Changes survive app restarts; the app does not depend on Streamlit's temporary local disk. The token remains in Streamlit Secrets. Each save creates a commit and can cause Streamlit to reload/redeploy the app. Keep code deployment in mind when saving during busy times.

Saving uses the file SHA from when the editor loaded. If another session changes that file, saving fails rather than overwriting those changes. Use Reload saved card after resolving a conflict. Only one user should edit at a time. The public card loads the saved data on each fresh visit or rerun; already-open pages do not receive live updates.

Without GitHub Secrets, the public card reads the initial bundled JSON, and admin saving is disabled. No silent temporary save is used. A token or configuration problem causes an error instead of replacing saved data with defaults.

## Wallet support — what is and is not included

The app supports actual provider-issued Apple Wallet and Samsung Wallet links. Add them in the editor to show the corresponding buttons. The links must be tested on supported phones first. A Wallat profile/share link is not necessarily an Add to Wallet link; obtain the exact issuer-provided action URL.

This project does not create signed Apple `.pkpass` files, enroll your business with Samsung, bypass certificate requirements, or automatically update passes already saved on customers' phones. Those need a wallet issuer or separate signing and update service. Save Contact downloads a vCard to Contacts; it is not a wallet pass. There are no payments.

Use a stable public card URL as the QR destination inside an issued pass. Then new links on the webpage remain available without replacing the pass. Changing the text/artwork inside a previously saved wallet pass still needs the issuer's update mechanism.

## Print and availability

Generate a fresh QR only after setting and checking the final Streamlit URL. The QR remains usable while that URL remains available. Streamlit Community Cloud can sleep after inactivity, so visitors may see a wake-up delay. This app does not provide an always-on wallet update API.

## Local run

```sh
python -m pip install -r requirements.txt
streamlit run app.py
```

For local admin use, copy the example settings into `.streamlit/secrets.toml` and fill in your actual values. Keep that file out of Git.
