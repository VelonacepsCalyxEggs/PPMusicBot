@echo off
:loop
:: CHANGE THIS CD TO YOUR DIRECTORY!!!
cd C:\Server\DSMBot\PP_DMB_TS
echo Starting Discord bot...
node index.js
echo Bot crashed with exit code %errorlevel%. Restarting...
timeout /t 5
goto loop
