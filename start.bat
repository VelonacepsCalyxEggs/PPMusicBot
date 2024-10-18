@echo off
:loop
echo Starting Discord bot...
node index.js
echo Bot crashed with exit code %errorlevel%. Restarting...
timeout /t 5
goto loop
