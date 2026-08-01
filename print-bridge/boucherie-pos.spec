# -*- mode: python ; coding: utf-8 -*-
"""Recette PyInstaller : produit un BoucheriePOS.exe autonome.

L'application compilee (dossier dist/ a la racine du depot) est embarquee dans
l'executable sous le nom "web" ; bridge.py la retrouve via sys._MEIPASS.

Construire depuis print-bridge\\ :   pyinstaller boucherie-pos.spec
Voir build_exe.bat pour la procedure complete.
"""
import os

# Le .spec est execute par PyInstaller : SPECPATH pointe sur print-bridge\
REPO = os.path.dirname(SPECPATH)  # noqa: F821
WEB = os.path.join(REPO, "dist")

if not os.path.isfile(os.path.join(WEB, "index.html")):
    raise SystemExit(
        "dist/index.html introuvable.\n"
        "Lancez d'abord la compilation de l'application :  npm install && npm run build"
    )

a = Analysis(  # noqa: F821
    ["bridge.py"],
    pathex=[SPECPATH],  # noqa: F821
    binaries=[],
    # (source, destination dans l'exe)
    datas=[(WEB, "web")],
    hiddenimports=[],
    hookspath=[],
    runtime_hooks=[],
    # Modules inutiles a la caisse : les exclure allege l'exe de plusieurs Mo.
    excludes=[
        "tkinter", "unittest", "pydoc", "doctest", "sqlite3",
        "xml", "email", "distutils", "lib2to3", "test",
    ],
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data)  # noqa: F821

exe = EXE(  # noqa: F821
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="BoucheriePOS",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    # console=True : la fenetre noire sert de temoin de fonctionnement et
    # affiche les erreurs d'imprimante. La fermer arrete la caisse, ce qui est
    # le comportement attendu par le personnel.
    console=True,
    disable_windowed_traceback=False,
    icon=None,
)
