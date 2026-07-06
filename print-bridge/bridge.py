#!/usr/bin/env python3
"""Boucherie POS - pont d'impression.

Relaie les octets ESC/POS bruts envoyes par le site web vers l'imprimante
ticket, et peut declencher l'ouverture du tiroir-caisse. Doit tourner sur le
meme PC que le navigateur (n'ecoute que sur 127.0.0.1) car une page HTTPS ne
peut appeler une adresse http:// que si elle est locale (loopback).

Ne necessite aucune dependance externe : uniquement la bibliotheque standard
de Python 3 (compatible Python 3.8, la derniere version officiellement
supportee sous Windows 7).
"""
import json
import os
import socket
import subprocess
import tempfile
from http.server import BaseHTTPRequestHandler, HTTPServer

CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")

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
}


def load_config():
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            cfg = DEFAULT_CONFIG.copy()
            cfg.update(json.load(f))
            return cfg
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(DEFAULT_CONFIG, f, indent=2, ensure_ascii=False)
    print("Fichier config.json cree avec des valeurs par defaut.")
    print("Modifiez-le (adresse IP de l'imprimante, etc.) puis relancez ce programme.")
    return DEFAULT_CONFIG


CONFIG = load_config()


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


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", CONFIG.get("allowed_origin", "*"))
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Bridge-Token")

    def _authorized(self):
        token = CONFIG.get("token", "")
        return not token or self.headers.get("X-Bridge-Token") == token

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        self.send_response(200 if self.path == "/ping" else 404)
        self._cors()
        self.end_headers()
        if self.path == "/ping":
            self.wfile.write(b"ok")

    def do_POST(self):
        if not self._authorized():
            self.send_response(401)
            self._cors()
            self.end_headers()
            return
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length else b""
        try:
            if self.path == "/print":
                send_to_printer(body)
            elif self.path == "/drawer":
                send_to_printer(bytes([0x1B, 0x70, 0x00, 0x19, 0xFA]))
            else:
                self.send_response(404)
                self._cors()
                self.end_headers()
                return
            self.send_response(200)
            self._cors()
            self.end_headers()
            self.wfile.write(b"ok")
        except Exception as e:  # noqa: BLE001 - report any hardware/driver error to the caller
            self.send_response(500)
            self._cors()
            self.end_headers()
            self.wfile.write(str(e).encode("utf-8", "replace"))

    def log_message(self, fmt, *args):
        print("[pont]", fmt % args)


def main():
    port = CONFIG["listen_port"]
    server = HTTPServer(("127.0.0.1", port), Handler)
    print("=" * 60)
    print(f"Pont d'impression Boucherie POS demarre sur http://127.0.0.1:{port}")
    print(f"Mode: {CONFIG['mode']}")
    print("Laissez cette fenetre ouverte. Fermez-la pour arreter le pont.")
    print("=" * 60)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
