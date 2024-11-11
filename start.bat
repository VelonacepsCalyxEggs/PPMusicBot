@echo off
:loop
cd C:\Server\DSMBot\PP_DMB
echo Starting Discord bot...
node index.js
echo Bot crashed with exit code %errorlevel%. Restarting...
timeout /t 5
goto loop
