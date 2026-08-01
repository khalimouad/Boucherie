# 🥩 Boucherie POS — application de caisse pour Windows

`BoucheriePOS.exe` fait tourner **toute la caisse sur le PC**, sans internet :

- il affiche l'application (aucun site à charger, aucune connexion nécessaire) ;
- il imprime les tickets **sans boîte de dialogue** ;
- il ouvre le **tiroir-caisse** ;
- il s'ouvre en **mode application** (fenêtre sans barre d'adresse).

Un seul fichier à copier, un double-clic pour démarrer.
Compatible **Windows 7, 10 et 11**.

---

## 1. Installer sur la caisse

1. Copiez `BoucheriePOS.exe` dans un dossier de la caisse,
   par exemple `C:\BoucheriePOS\`.
2. Double-cliquez dessus. Une fenêtre noire s'ouvre (c'est le témoin de
   fonctionnement) et la caisse apparaît dans une fenêtre d'application.
3. Au premier lancement, un fichier **`config.json`** est créé à côté de l'exe.
   Réglez-y l'imprimante (étape 2), puis relancez le programme.

> **Laissez la fenêtre noire ouverte pendant le service.**
> La fermer arrête la caisse. Vous pouvez la réduire sans problème.

Aucune installation de Python n'est nécessaire : tout est dans l'exe.

## 2. Régler l'imprimante — `config.json`

- **Imprimante réseau (câble LAN)** — recommandé :
  ```json
  "mode": "network",
  "printer_host": "192.168.1.50",
  "printer_port": 9100
  ```
  Pour trouver l'adresse IP de l'imprimante : faites un test d'impression
  depuis le menu de l'imprimante (bouton FEED maintenu à l'allumage sur la
  plupart des modèles Rongta), l'adresse IP est imprimée sur le ticket de
  test. Ou regardez la liste des appareils connectés dans l'interface de
  votre routeur/box internet.

- **Imprimante USB** :
  ```json
  "mode": "windows",
  "windows_printer_name": "POS-80"
  ```
  Remplacez `"POS-80"` par le nom exact de l'imprimante tel qu'il apparaît
  dans *Panneau de configuration → Périphériques et imprimantes*.

- **Jeton de sécurité** : mettez la même valeur que celle générée dans
  **Paramètres → Impression directe** de l'application, dans le champ `"token"`.

### Réglages d'affichage

| Clé | Effet |
|---|---|
| `open_browser` | Ouvrir la caisse automatiquement au démarrage (défaut : `true`) |
| `kiosk` | Plein écran sans bordure, pour un écran tactile dédié (défaut : `false`) |
| `dedicated_profile` | Profil de navigateur réservé à la caisse (défaut : `true`, voir ci-dessous) |
| `listen_port` | Port local, à changer seulement en cas de conflit (défaut : `9123`) |

## 3. Où sont les données — À LIRE

Les ventes sont enregistrées **dans le navigateur de la caisse**, pas dans un
fichier que l'on peut copier. Avec `dedicated_profile: true` (par défaut), elles
vivent dans le dossier **`navigateur-profil`** créé à côté de l'exe.

C'est volontaire et c'est le réglage sûr : les données de la caisse sont
isolées du navigateur personnel, et un « effacer les données de navigation »
fait par un employé **ne peut plus vider la base des ventes**.

⚠️ **Si vous utilisiez déjà la caisse dans votre navigateur habituel**, le
passage à l'exe démarre sur un profil neuf : les anciennes ventes sont toujours
dans l'ancien profil, mais l'application semblera vide. Avant de basculer :

- activez la **synchronisation cloud** sur l'ancienne installation, attendez que
  la pastille passe au vert, puis activez-la aussi dans l'exe — tout redescend ;
- ou, à défaut, exportez les CSV depuis **Rapports → Exporter CSV**.

Pour repartir du navigateur habituel malgré tout : mettez
`"dedicated_profile": false` dans `config.json`.

**Sauvegarde** : la meilleure sauvegarde reste la synchronisation cloud (voir
`supabase/README.md`). Sinon, copiez régulièrement le dossier
`navigateur-profil` quand la caisse est fermée.

## 4. Démarrage automatique avec Windows

1. `Windows + R`, tapez `shell:startup`, validez.
2. Clic droit dans le dossier → **Nouveau → Raccourci**.
3. Indiquez le chemin de l'exe, par exemple `C:\BoucheriePOS\BoucheriePOS.exe`.
4. La caisse démarrera à chaque ouverture de session.

Un second double-clic ne lance pas deux caisses : le programme détecte qu'il
tourne déjà et se contente de rouvrir la fenêtre.

## 5. Activer l'impression dans l'application

**Paramètres → Impression directe & tiroir-caisse** :

- activez le pont ;
- laissez l'adresse `http://127.0.0.1:9123` ;
- collez le même jeton que dans `config.json` ;
- **Tester la connexion**, puis **Test d'impression**.

Chaque vente s'imprime alors sans boîte de dialogue, et le tiroir s'ouvre pour
les paiements en espèces. Le bouton 🗄️ dans la caisse l'ouvre à tout moment.

## 6. Windows 7 — à savoir

Windows 7 ne reçoit plus de navigateur à jour : Chrome y est figé à la version
109, Firefox ESR 115 est le dernier compatible. L'application est écrite pour
fonctionner sur ces versions, mais gardez en tête que ces postes ne reçoivent
plus de correctifs de sécurité. Pour une caisse qui reste sur le réseau du
magasin, c'est acceptable ; migrer vers Windows 10/11 reste préférable à terme.

L'exe fonctionne sur ces trois versions de Windows **à condition d'avoir été
construit avec Python 3.8 32 bits** (voir ci-dessous). Un exe construit avec
Python 3.9+ ne démarrera pas sous Windows 7.

## 7. Construire l'exe (développeur)

Sur une machine **Windows** (PyInstaller ne compile pas depuis Linux/macOS) :

```bat
cd print-bridge
build_exe.bat
```

Le script compile l'application web (`npm run build`), installe PyInstaller
puis produit `print-bridge\dist\BoucheriePOS.exe`.

Pour couvrir Windows 7, lancez-le avec **Python 3.8 32 bits** installé
([python.org](https://www.python.org/downloads/release/python-3810/), choisir
*Windows x86 executable installer*) et PyInstaller 5.13.2 — c'est la dernière
série compatible. L'exe obtenu fonctionne aussi sur Windows 10 et 11.

En développement, sans construire d'exe :

```bash
npm run build          # à la racine du dépôt
python print-bridge/bridge.py
```

`bridge.py` sert alors le dossier `dist/` de la racine. L'option
`--no-browser` démarre le serveur sans ouvrir de fenêtre.

## Sécurité

Le programme n'écoute que sur `127.0.0.1` : il n'est joignable ni depuis le
réseau du magasin, ni depuis internet. Le jeton évite qu'une autre page ouverte
par erreur dans le même navigateur ne déclenche une impression ou une ouverture
de tiroir. Les fichiers servis sont confinés au contenu embarqué dans l'exe.

## En cas de problème

| Symptôme | Piste |
|---|---|
| Rien ne s'ouvre au double-clic | Regardez la fenêtre noire : elle affiche l'erreur. Si elle se ferme trop vite, lancez l'exe depuis une invite de commandes. |
| « Impossible d'ouvrir le port 9123 » | Un autre programme l'utilise. Changez `listen_port` dans `config.json`, et l'adresse correspondante dans Paramètres → Impression directe. |
| Page blanche | Navigateur trop ancien. Sous Windows 7, installez Chrome 109 ou Firefox ESR 115. |
| L'impression échoue | Vérifiez `mode`, l'IP ou le nom Windows de l'imprimante, et que le jeton est identique des deux côtés. |
| La caisse semble vide après le passage à l'exe | Voir la section 3 : profil de navigateur dédié. |
