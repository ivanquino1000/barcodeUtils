const { app, BrowserWindow, screen, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const child_process = require("child_process");


class FontInstaller{
    constructor() {
        // Define the path to the fonts directory and the system fonts directory
        this.winFontsDir = path.join(
            process.env.USERPROFILE,
            "AppData",
            "Local",
            "Microsoft",
            "Windows",
            "Fonts"
        );
        this.fontsDir = path.join(__dirname, "..", "Config", "fonts");
        this.batFilePath = path.join(
            __dirname,
            "..",
            "Config",
            "setup",
            "install__3__fontRegister.bat"
        );
    }
    // Function to check if a font is installed
    isFontInstalled(fontName) {
        try {
            const fonts = fs.readdirSync(this.winFontsDir);
            return fonts.some((file) =>
                file.toLowerCase().includes(fontName.toLowerCase())
            );
        } catch (e) {
            console.error("Error reading fonts from windows system \n ", e);
            return false;
        }
    }

    // Function to install the missing fonts by running the batch file
    installFonts() {
        try {
            // Run the batch file to install the font
            child_process.execSync(this.batFilePath, { stdio: "ignore" });
            console.log("Font installation initiated via batch file.");
        } catch (err) {
            console.error("Error executing batch file:", err);
        }
    }

    // Main function to check and install missing fonts
    init() {
        if (!fs.existsSync(this.fontsDir)) {
            console.log("Fonts folder does not exist.");
            return;
        }

        const fontFiles = fs.readdirSync(this.fontsDir);
        let missingFonts = fontFiles.filter(font => !this.isFontInstalled(font));

        if (missingFonts.length > 0) {
            console.log('Missing fonts:', missingFonts.join(', '));
            console.log('Installing missing fonts...');
            this.installFonts();
        } else {
            console.log('All fonts are already installed.');
        }
    }
}

module.exports = FontInstaller;
