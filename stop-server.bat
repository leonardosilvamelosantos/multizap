@echo off
echo 🛑 Parando MultiZap Dashboard Unificado...
echo.

REM Procurar e finalizar processos na porta 3000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo 🛑 Finalizando processo PID %%a...
    taskkill /PID %%a /F >nul 2>&1
    if %errorlevel% == 0 (
        echo ✅ Processo finalizado com sucesso!
    ) else (
        echo ❌ Erro ao finalizar processo %%a
    )
)

echo.
echo ✅ Servidor parado!
pause
