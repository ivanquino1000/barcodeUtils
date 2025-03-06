const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

preBuild();

async function preBuild() {
    try {
        // Run `npm install` to install any dependencies
        console.log("Running npm install...");
        execSync("npm install", { stdio: "inherit" });

        console.log(
            "Setting PLAYWRIGHT_BROWSERS_PATH and installing Chromium..."
        );
        process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(__dirname, "browser"); // Set the browser path to './browser'
        execSync("npx playwright install chromium", {
            stdio: "inherit",
        });

        // Delete unnecessary temp folders or files
        const tempFolderList = [
            path.join(__dirname, "..", "labelPdfPrinter", "pdf-layout"),
            path.join(__dirname, "..", "labelPdfPrinter", "pdf-output"),
            path.join(__dirname, "..", "labelPdfPrinter", "node_modules"),
        ];
        tempFolderList.forEach((folder) => {
            if (fs.existsSync(folder)) {
                console.log("Cleaning up temp folders...");
                fs.rmdirSync(folder, { recursive: true });
            }
        });

        // Set env files
        const rootDir = path.resolve(__dirname);
        const subfolders = ["", "../LabelPdfPrinter"];

        subfolders.forEach((subfolder) => {
            const envFilePath = path.join(rootDir, subfolder, ".env");
            if (fs.existsSync(envFilePath)) {
                console.log(`Setting NODE_ENV=production in ${envFilePath}`);
                // Read the .env file and append or modify the NODE_ENV value
                let envContent = fs.readFileSync(envFilePath, "utf-8");
                if (!envContent.includes("NODE_ENV=")) {
                    envContent += "\nNODE_ENV=production\n";
                } else {
                    envContent = envContent.replace(
                        /NODE_ENV=[^\n]+/,
                        "NODE_ENV=production"
                    );
                }
                fs.writeFileSync(envFilePath, envContent, "utf-8");
            }
        });
        // Set env json excel Helper

        const envFilePath = path.join(__dirname, "..", "Src", "env.json");

        try {
            // Check if the env.json file exists
            if (fs.existsSync(envFilePath)) {
                // Read the contents of env.json
                const fileData = fs.readFileSync(envFilePath, "utf-8");

                // Parse the file data as JSON
                const jsonData = JSON.parse(fileData);

                // Modify the 'env' property to 'production'
                jsonData.env = "production";

                // Write the modified JSON data back to the file
                fs.writeFileSync(
                    envFilePath,
                    JSON.stringify(jsonData, null, 2),
                    "utf-8"
                );

                console.log("Successfully changed env to production!");
            } else {
                console.error("env.json file not found!");
            }
        } catch (error) {
            console.error("Error reading or modifying env.json:", error);
        }

        console.log("Pre-package tasks complete.");
    } catch (error) {
        console.error("Error during pre-package tasks:", error);
        process.exit(1); // Exit with error if something fails
    }
}
