@echo off

echo Opening Fonts for Installation

:: Define the folder where the .ttf font files are located
set "fontDir=%~dp0..\fonts"

:: Print the folder where the font files are located
echo Fonts Directory: %fontDir%

:: Iterate through each .ttf file in the font directory and open it for the user
for %%f in ("%fontDir%\*.ttf") do (
    echo Opening font: %%f
    start %%f
)

echo All fonts opened for installation. Please click "Install" in the font preview window.
