#!/usr/bin/env python3
"""Boucherie POS - serveur local de la caisse.

Ce programme fait tourner la caisse sur le PC, sans internet :

  1. il sert l'application (les fichiers du dossier "web") sur 127.0.0.1 ;
  2. il relaie les octets ESC/POS vers l'imprimante ticket ;
  3. il declenche l'ouverture du tiroir-caisse ;
  4. il ouvre le navigateur de la machine en mode application.

Comme l'application et le pont partagent la meme adresse, il n'y a ni probleme
de CORS ni de contenu mixte, et 127.0.0.1 est considere comme une origine
securisee par les navigateurs (crypto.subtle, stockage persistant).

Aucune dependance externe : uniquement la bibliotheque standard de Python 3
(compatible Python 3.8, la derniere version supportee sous Windows 7).
"""
import json
import os
import posixpath
import socket
import subprocess
import sys
import tempfile
import urllib.parse
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

APP_NAME = "Boucherie POS"


def app_dir():
    """Dossier de l'executable (ou du script) - la ou vivent config.json et les logs.

    Sous PyInstaller, __file__ pointe vers un dossier temporaire qui disparait a
    la fermeture : la configuration doit etre ecrite a cote de l'exe, pas dedans.
    """
    if getattr(sys, "frozen", False):
        return os.path.dirname(os.path.abspath(sys.executable))
    return os.path.dirname(os.path.abspath(__file__))


def web_root():
    """Dossier des fichiers de l'application (index.html, assets/...)."""
    if getattr(sys, "frozen", False):
        # PyInstaller extrait les donnees embarquees dans sys._MEIPASS
        return os.path.join(sys._MEIPASS, "web")  # type: ignore[attr-defined]
    # En developpement : le "npm run build" de la racine du depot
    return os.path.join(os.path.dirname(app_dir()), "dist")


CONFIG_PATH = os.path.join(app_dir(), "config.json")

DEFAULT_CONFIG = {
    "listen_port": 9123,
    "token": "",
    "allowed_origin": "*",
    # "network" : imprimante reseau (LAN), on lui envoie les octets directement.
    # "windows" : imprimante installee sous Windows (USB), on passe par le
    #             spouleur d'impression Windows en mode brut (RAW).
    "mode": "network",
    "printer_host": "192.168.1.50",
    "printer_port": 9100,
    "windows_printer_name": "POS-80",
    # --- affichage de la caisse ---
    # Ouvrir automatiquement le navigateur au demarrage.
    "open_browser": True,
    # Plein ecran sans bordure (utile sur un ecran tactile dedie).
    "kiosk": False,
    # Profil de navigateur dedie a la caisse, range a cote de l'exe.
    # Fortement recommande : les donnees de la caisse sont ainsi isolees du
    # navigateur personnel, et un "effacer les donnees de navigation" ne peut
    # plus vider la base des ventes.
    "dedicated_profile": True,
}


def load_config():
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                cfg = DEFAULT_CONFIG.copy()
                cfg.update(json.load(f))
                return cfg
        except (ValueError, OSError) as e:
            print("config.json illisible (%s), valeurs par defaut utilisees." % e)
            return DEFAULT_CONFIG.copy()
    try:
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(DEFAULT_CONFIG, f, indent=2, ensure_ascii=False)
        print("Fichier config.json cree avec des valeurs par defaut.")
    except OSError as e:
        print("Impossible d'ecrire config.json (%s)." % e)
    return DEFAULT_CONFIG.copy()


CONFIG = load_config()


# -----------------------------------------------------------------------------
# Imprimante
# -----------------------------------------------------------------------------
def send_to_printer(data: bytes):
    if CONFIG["mode"] == "network":
        with socket.create_connection((CONFIG["printer_host"], CONFIG["printer_port"]), timeout=5) as s:
            s.sendall(data)
        return
    # Mode "windows" : on envoie les octets bruts au spouleur Windows. Cela
    # fonctionne quand le port de l'imprimante est configure en mode RAW
    # (reglage par defaut de la plupart des pilotes d'imprimantes tickets).
    fd, path = tempfile.mkstemp(suffix=".prn")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
        subprocess.run(
            ["cmd", "/c", "copy", "/b", path, "\\\\localhost\\" + CONFIG["windows_printer_name"]],
            check=True,
            capture_output=True,
        )
    finally:
        os.remove(path)


# -----------------------------------------------------------------------------
# Fichiers statiques
#
# Les types MIME sont codes en dur plutot que devines via le module mimetypes :
# sous Windows celui-ci lit la base de registre, ou .js est frequemment associe
# a "text/plain". Le navigateur refuserait alors d'executer le module ES et la
# caisse resterait sur une page blanche.
# -----------------------------------------------------------------------------
MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".map": "application/json; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".webmanifest": "application/manifest+json",
}

WEB_ROOT = web_root()
HAS_WEB = os.path.isfile(os.path.join(WEB_ROOT, "index.html"))


def resolve_static(url_path: str):
    """Traduit un chemin d'URL en fichier du dossier web, ou None.

    Refuse tout chemin qui sortirait du dossier (../, chemins absolus, liens
    symboliques) : le serveur n'ecoute que sur la loopback, mais un navigateur
    compromis ne doit pas pouvoir lire le disque.
    """
    path = urllib.parse.urlsplit(url_path).path
    path = urllib.parse.unquote(path)
    # Un ".." dans l'URL n'a aucune raison d'exister ici : on refuse au lieu de
    # normaliser en silence, pour que la tentative soit visible et sans effet.
    if ".." in path.replace("\\", "/").split("/"):
        return None
    path = posixpath.normpath(path)
    if path in ("/", "", "."):
        path = "/index.html"

    parts = [p for p in path.split("/") if p not in ("", ".", "..")]
    candidate = os.path.realpath(os.path.join(WEB_ROOT, *parts))
    root = os.path.realpath(WEB_ROOT)
    if candidate != root and not candidate.startswith(root + os.sep):
        return None
    if os.path.isfile(candidate):
        return candidate
    # Chemin sans extension : on renvoie l'application, qui gere sa navigation.
    # Un fichier manquant (image, script) reste un vrai 404.
    looks_like_a_file = bool(parts) and "." in parts[-1]
    if not looks_like_a_file:
        index = os.path.join(root, "index.html")
        return index if os.path.isfile(index) else None
    return None


class Handler(BaseHTTPRequestHandler):
    server_version = "BoucheriePOS"

    # ---- utilitaires ----
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", CONFIG.get("allowed_origin", "*"))
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Bridge-Token")

    def _authorized(self):
        token = CONFIG.get("token", "")
        return not token or self.headers.get("X-Bridge-Token") == token

    def _reply(self, status: int, body: bytes = b"", ctype: str = "text/plain; charset=utf-8", cache: str = None):
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        if cache:
            self.send_header("Cache-Control", cache)
        self.end_headers()
        if body and self.command != "HEAD":
            self.wfile.write(body)

    # ---- verbes ----
    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        # --- Private Network Access ---
        # Quand la caisse est ouverte depuis un site en ligne (Vercel, HTTPS) et
        # appelle 127.0.0.1, Chrome ajoute un controle supplementaire : il envoie
        # "Access-Control-Request-Private-Network: true" et exige la reponse
        # ci-dessous. Sans elle, l'impression est bloquee par le navigateur alors
        # meme que le pont tourne. Le cas ne se pose pas avec BoucheriePOS.exe,
        # ou la page et le pont partagent la meme origine.
        if self.headers.get("Access-Control-Request-Private-Network") == "true":
            self.send_header("Access-Control-Allow-Private-Network", "true")
        # Evite un prevol avant chaque ticket.
        self.send_header("Access-Control-Max-Age", "86400")
        self.end_headers()

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        if self.path == "/ping" or self.path.startswith("/ping?"):
            self._reply(200, b"ok")
            return

        if not HAS_WEB:
            self._reply(404, b"introuvable")
            return

        target = resolve_static(self.path)
        if not target:
            self._reply(404, b"introuvable")
            return

        try:
            with open(target, "rb") as f:
                body = f.read()
        except OSError:
            self._reply(404, b"introuvable")
            return

        ext = os.path.splitext(target)[1].lower()
        ctype = MIME_TYPES.get(ext, "application/octet-stream")
        # Les noms des fichiers de assets/ contiennent une empreinte : ils ne
        # changent jamais et peuvent etre gardes en cache. index.html, lui,
        # doit etre relu a chaque demarrage pour prendre les mises a jour.
        cache = "public, max-age=31536000, immutable" if "/assets/" in self.path else "no-store"
        self._reply(200, body, ctype, cache)

    def do_POST(self):
        if not self._authorized():
            self._reply(401, b"non autorise")
            return
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length else b""
        try:
            if self.path == "/print":
                send_to_printer(body)
            elif self.path == "/drawer":
                send_to_printer(bytes([0x1B, 0x70, 0x00, 0x19, 0xFA]))
            else:
                self._reply(404, b"introuvable")
                return
            self._reply(200, b"ok")
        except Exception as e:  # noqa: BLE001 - report any hardware/driver error to the caller
            self._reply(500, str(e).encode("utf-8", "replace"))

    def log_message(self, fmt, *args):
        # Les requetes de fichiers noieraient la fenetre : on ne trace que
        # l'activite du pont (impression, tiroir, test de connexion).
        path = getattr(self, "path", "")
        if path.startswith(("/print", "/drawer", "/ping")):
            print("[caisse]", fmt % args)

    def log_error(self, fmt, *args):
        print("[caisse] erreur:", fmt % args)


# -----------------------------------------------------------------------------
# Navigateur
# -----------------------------------------------------------------------------
BROWSERS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    os.path.join(os.environ.get("LOCALAPPDATA", ""), r"Google\Chrome\Application\chrome.exe"),
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]


def find_browser():
    for path in BROWSERS:
        if path and os.path.isfile(path):
            return path
    return None


def open_app_window(url: str):
    """Ouvre la caisse en mode application (sans barre d'adresse) si possible."""
    exe = find_browser()
    if not exe:
        # Pas de Chrome/Edge : on ouvre le navigateur par defaut (Firefox ESR
        # sous Windows 7, par exemple). L'application fonctionne pareil, avec
        # la barre d'adresse en plus.
        webbrowser.open(url)
        return

    args = [exe, "--app=" + url, "--no-first-run", "--no-default-browser-check"]
    if CONFIG.get("kiosk"):
        args.append("--start-fullscreen")
    if CONFIG.get("dedicated_profile", True):
        profile = os.path.join(app_dir(), "navigateur-profil")
        args.append("--user-data-dir=" + profile)
    try:
        subprocess.Popen(args, close_fds=True)
    except OSError as e:
        print("Ouverture du navigateur impossible (%s), essai par defaut." % e)
        webbrowser.open(url)


def port_is_taken(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.4)
        return s.connect_ex(("127.0.0.1", port)) == 0


# -----------------------------------------------------------------------------
def main():
    port = int(CONFIG.get("listen_port", 9123))
    url = "http://127.0.0.1:%d/" % port
    no_browser = "--no-browser" in sys.argv

    # Deja lance (double-clic en trop, ou demarrage automatique) : on se
    # contente de ramener la fenetre de la caisse au premier plan.
    if port_is_taken(port):
        print("%s tourne deja sur le port %d." % (APP_NAME, port))
        if not no_browser and CONFIG.get("open_browser", True):
            open_app_window(url)
        return

    try:
        server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    except OSError as e:
        print("Impossible d'ouvrir le port %d : %s" % (port, e))
        print("Modifiez \"listen_port\" dans config.json puis relancez.")
        input("Appuyez sur Entree pour fermer...")
        return
    server.daemon_threads = True

    print("=" * 62)
    print(" %s" % APP_NAME)
    print("=" * 62)
    print(" Caisse    : %s" % (url if HAS_WEB else "(fichiers de l'application absents)"))
    print(" Impression: mode %s" % CONFIG["mode"])
    print(" Config    : %s" % CONFIG_PATH)
    print("-" * 62)
    print(" Laissez cette fenetre ouverte pendant le service.")
    print(" La fermer arrete la caisse.")
    print("=" * 62)

    if HAS_WEB and not no_browser and CONFIG.get("open_browser", True):
        open_app_window(url)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nArret de la caisse.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
