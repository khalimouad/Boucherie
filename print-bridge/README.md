# 🖨️ Pont d'impression Boucherie POS

Ce petit programme permet au site web de la caisse d'imprimer les tickets
**sans boîte de dialogue** et d'**ouvrir le tiroir-caisse**. Il doit être
installé **une seule fois** sur l'ordinateur de la caisse (celui qui affiche
le site dans le navigateur).

Il ne modifie rien sur votre machine : c'est un seul fichier Python qui tourne
en arrière-plan et transmet les tickets à l'imprimante.

## 1. Installer Python (si nécessaire)

- Windows 7 : installez **Python 3.8** (dernière version compatible avec
  Windows 7) depuis https://www.python.org/downloads/release/python-3810/
  (choisissez "Windows x86 executable installer" pour la version 32 bits).
- Windows 10/11 ou plus récent : installez la dernière version de Python 3
  depuis https://www.python.org/downloads/
- Pendant l'installation, cochez la case **"Add Python to PATH"**.

## 2. Configurer le pont

Ouvrez le fichier `config.json` (créé automatiquement au premier lancement,
voir étape 3) avec le Bloc-notes et adaptez :

- **Si l'imprimante est branchée en réseau (câble LAN)** — recommandé :
  ```json
  "mode": "network",
  "printer_host": "192.168.1.50",   // adresse IP de l'imprimante
  "printer_port": 9100
  ```
  Pour trouver l'adresse IP de l'imprimante : faites un test d'impression
  depuis le menu de l'imprimante (bouton FEED maintenu à l'allumage sur la
  plupart des modèles Rongta), l'adresse IP est imprimée sur le ticket de
  test. Ou regardez la liste des appareils connectés dans l'interface de
  votre routeur/box internet.

- **Si l'imprimante est branchée en USB** :
  ```json
  "mode": "windows",
  "windows_printer_name": "POS-80"
  ```
  Remplacez `"POS-80"` par le nom exact de l'imprimante tel qu'il apparaît
  dans *Panneau de configuration → Périphériques et imprimantes*.

- **Jeton de sécurité** : copiez la même valeur que celle générée dans
  l'écran **Paramètres → Impression directe** du site, dans le champ
  `"token"` du fichier `config.json`.

## 3. Lancer le pont

Double-cliquez sur `bridge.py`, ou ouvrez une invite de commandes dans ce
dossier et tapez :

```
python bridge.py
```

Une fenêtre s'ouvre avec le message *"Pont d'impression Boucherie POS
démarré..."* — laissez-la ouverte. Le fichier `config.json` est créé
automatiquement à ce moment si vous ne l'avez pas fait à l'étape 2.

Pour vérifier que ça fonctionne, ouvrez cette adresse dans le navigateur de
la caisse : http://127.0.0.1:9123/ping — vous devez voir `ok`.

## 4. Démarrage automatique avec Windows (recommandé)

Pour ne pas avoir à relancer le pont à chaque redémarrage de la caisse :

1. Appuyez sur `Windows + R`, tapez `shell:startup`, validez.
2. Faites un clic droit dans le dossier qui s'ouvre → **Nouveau → Raccourci**.
3. Indiquez le chemin vers `pythonw.exe` suivi du chemin vers `bridge.py`,
   par exemple :
   ```
   C:\Python38\pythonw.exe C:\BoucheriePOS\print-bridge\bridge.py
   ```
   (`pythonw.exe` au lieu de `python.exe` évite d'afficher une fenêtre noire).
4. Le pont démarrera automatiquement à chaque ouverture de session Windows.

## 5. Activer dans l'application

Dans le site, allez dans **Paramètres → Impression directe & tiroir-caisse** :
- Activez le pont
- Vérifiez l'adresse (`http://127.0.0.1:9123` par défaut)
- Collez le même jeton que dans `config.json`
- Cliquez sur **Tester la connexion**, puis **Test d'impression**

Une fois validé, chaque vente s'imprime automatiquement sans aucune boîte de
dialogue, et le tiroir-caisse s'ouvre pour les paiements en espèces (réglable
dans les paramètres). Le bouton 🗄️ dans la caisse permet de l'ouvrir à
tout moment (par exemple pour rendre la monnaie sans vente).

## Sécurité

Le pont n'écoute que sur `127.0.0.1` (cette machine uniquement) — il n'est
pas accessible depuis le réseau ni depuis Internet. Le jeton évite qu'une
autre page ouverte par erreur dans le même navigateur ne déclenche une
impression ou une ouverture de tiroir.
