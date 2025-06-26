@echo off
:loop
:: CHANGE THIS CD TO YOUR DIRECTORY!!!
:: This better be nuked sooner or later...
cd C:\Server\DSMBot\PP_DMB_TS
echo Starting Discord bot...
npm run start
echo Bot crashed with exit code %errorlevel%. Restarting...
timeout /t 5
goto loop
