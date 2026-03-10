@echo off
cd /d "%~dp0"
node preBuild.js
npm run make 