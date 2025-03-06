@echo off


REM : Execute 'npx playwright install chromium' in src/node_modules/electron

REM : Current Directory $/Config/PreSetup 
set "first_directory=%CD%"

echo Installing Chromium with Playwright...
cd "..\..\WebUploader\node_modules\electron"
powershell -Command "npx playwright install chromium"
echo Installation Completed: Chromium for NPX

pause

REM Iterate through each TTF file in the directory
REM for %%f in ("%first_directory%\..\RequiredFonts\*.ttf") do (
REM    start "" "%%f"
REM    pause
REM )
REM pause

echo Installation completed: Chromium for NPX

pause