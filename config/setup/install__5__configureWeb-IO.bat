@echo off

REM : Open JSON files 
echo Opening WEB Config JSON files...

set "first_directory=%CD%"
echo CurrentDir %first_directory%

REM : electron .exe Export 
start notepad "%first_directory%\..\..\app\WebExportUrls.json"

REM : Excel Call Upload Export
start notepad "%first_directory%\..\..\WebUploader\WebExportUrls.json"
start notepad "%first_directory%\..\..\WebUploader\WebUploadUrls.json"
start notepad "%first_directory%\..\..\Src\LabelBussinessInfo.json"


echo Process completed: Json Web Config 
pause