@echo off
echo Iniciando push para GitHub...
cd /d "C:\Users\lsilv\Desktop\multi zap"

echo Verificando status do Git...
git status

echo Fazendo push para o repositório remoto...
git push -u origin master

echo Push concluído!
pause
