@echo off
REM ===================================================================
REM  Boucherie POS - construction de BoucheriePOS.exe
REM
REM  A lancer sur une machine WINDOWS (PyInstaller ne compile pas pour
REM  Windows depuis Linux ou macOS).
REM
REM  Pour un exe qui tourne AUSSI sous Windows 7, construisez avec
REM  Python 3.8 32 bits : l'exe produit fonctionnera alors sur Windows
REM  7, 10 et 11, en 32 comme en 64 bits.
REM  https://www.python.org/downloads/release/python-3810/
REM ===================================================================
setlocal
cd /d "%~dp0.."

echo.
echo [1/3] Compilation de l'application web...
call npm install || goto :erreur
call npm run build || goto :erreur

echo.
echo [2/3] Installation de PyInstaller...
REM PyInstaller 5.13 est la derniere serie compatible Python 3.8 / Windows 7.
python -m pip install --upgrade pip || goto :erreur
python -m pip install "pyinstaller==5.13.2" || goto :erreur

echo.
echo [3/3] Construction de l'executable...
cd print-bridge
python -m PyInstaller --noconfirm --clean boucherie-pos.spec || goto :erreur

echo.
echo ===================================================================
echo  Termine : print-bridge\dist\BoucheriePOS.exe
echo.
echo  Copiez CE SEUL FICHIER sur la caisse et double-cliquez dessus.
echo  Au premier lancement il cree config.json a cote de lui : reglez-y
echo  l'imprimante, puis relancez.
echo ===================================================================
pause
exit /b 0

:erreur
echo.
echo *** La construction a echoue. Lisez le message d'erreur ci-dessus. ***
pause
exit /b 1
