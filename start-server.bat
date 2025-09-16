@echo off
echo 🚀 Iniciando MultiZap Dashboard Unificado...
echo.

REM Verificar se a porta 3000 está em uso
netstat -ano | findstr :3000 >nul
if %errorlevel% == 0 (
    echo ⚠️  Porta 3000 já está em uso!
    echo 🔍 Procurando processo que está usando a porta...
    
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
        echo 🛑 Finalizando processo PID %%a...
        taskkill /PID %%a /F >nul 2>&1
    )
    
    echo ⏳ Aguardando liberação da porta...
    timeout /t 2 /nobreak >nul
)

echo 🚀 Iniciando servidor...
npm start

pause
