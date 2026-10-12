# System32 Portfolio

## Contact backend

The root portfolio contact form supports direct SMTP delivery through the Python backend, Gmail compose, or the visitor's default email app. Gmail and email-app options use the public `CONTACT_TO` address and stay disabled until it is configured. The server also serves the root portfolio page and its CSS/JavaScript assets, so open it through the local server instead of opening `index.html` directly.

### Windows setup

Install Python 3.11 or newer, then run these commands from the portfolio folder:

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `.env` with your SMTP provider settings. Use a provider-issued app password or SMTP credential; do not put secrets in frontend files or commit `.env`.

Start the local server:

```powershell
.venv\Scripts\python backend\server.py
```

Then open `http://127.0.0.1:8000`. The API is available at `/api/contact`; `/api/health` reports server health.

The included Flask server is for local development. For deployment, run the app with a production WSGI server such as Waitress behind HTTPS, configure a shared rate-limit store, and set the SMTP values in the hosting environment.