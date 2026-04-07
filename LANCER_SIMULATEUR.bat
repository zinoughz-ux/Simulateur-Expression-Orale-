@echo off
title Simulateur Expression Orale TCF Canada 
setlocal enabledelayedexpansion

:: Force le repertoire de travail sur celui du script
cd /d "%~dp0"

echo --------------------------------------------------
echo      SIMULATEUR Expression Oral TCF CANADA - VERSION 1
echo --------------------------------------------------
echo [1/3] VERIFICATION DU PC...

:: Verification de Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERREUR] Node.js n'est pas installe.
    echo 1. Allez sur https://nodejs.org/
    echo 2. Téléchargez et installez la version "LTS".
    echo 3. Redémarrez ce script.
    echo.
    pause
    exit /b
)

:: Verification des dependances
if not exist "node_modules\" (
    echo [INFO] Les dependances sont absentes. Installation...
    echo (Cela necessite une connexion Internet)
    call npm install
    if %errorlevel% neq 0 (
        echo [ERREUR] L'installation a echoue. Verifiez votre connexion.
        pause
        exit /b
    )
)

echo.
echo [2/3] LANCEMENT DU SERVEUR...
start "Serveur TCF" cmd /k "npm start"

:: Attente compatible Windows 7
timeout /t 5 > nul

echo.
echo [3/3] OUVERTURE DU SIMULATEUR...
:: Lancement via localhost pour garantir un contexte securise (MICROPHONE)
start "" "http://127.0.0.1:3000"

echo.
echo --------------------------------------------------
echo ✅ SIMULATEUR PRET !
echo --------------------------------------------------
echo Gardez cette fenetre ouverte pendant votre session.
echo Vous pouvez maintenant utiliser l'application.
echo.
pause
