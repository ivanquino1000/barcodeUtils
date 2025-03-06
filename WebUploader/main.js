require("dotenv").config();
const { exec } = require("child_process");
const { app, BrowserWindow, screen, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const child_process = require("child_process");

const { Downloader } = require("./WebExport");
const { Uploader } = require("./WebUpload");
const FontInstaller = require("./installFont");
const { triggerAsyncId } = require("async_hooks");

//  * shell parameter operation => download | upload
// - Default = Download
const ipc = ipcMain;

//  Calling from exe  - > app.exe upload
//  Calling from node - > electron . upload

const operationProcess = app.isPackaged
    ? process.argv[1] || "download"
    : process.argv[2] || "download";

console.log("In Production: ", app.isPackaged);
console.log("Operation Mode\n", operationProcess);

let mainWindow;

app.on("ready", () => {
    createWindow();
    //  * Upload Specification Handler
    if (operationProcess == "upload") {
        webUpload_init();
    } else {
        webDownload_init();
    }
});

const createWindow = async () => {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    mainWindow = new BrowserWindow({
        width: 500,
        height: 380,
        alwaysOnTop: true,
        autoHideMenuBar: false,
        //maximizable:false,
        //minimizable:false,
        frame: false,
        //roundedCorners:true,
        //titleBarStyle:'hidden',
        webPreferences: {
            devTools: true,
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
        },

        x: width - 500,
        y: height - 450,
    });
    // mainWindow.webContents.openDevTools();
    mainWindow.setTitle(
        operationProcess == "upload"
            ? "Subida de Productos"
            : "Descarga de Productos"
    );
    mainWindow.loadFile("progressView.html");

    ipc.on("minimizeApp", () => {
        mainWindow.minimize();
    });
    ipc.on("maximizeApp", () => {
        if (mainWindow.isMaximized()) {
            mainWindow.restore();
        } else {
            mainWindow.maximize();
        }
    });
    ipc.on("closeApp", () => {
        mainWindow.close();
    });
};

//  * Upload - Events Handler
function webUpload_init() {
    const uploader = new Uploader();
    uploader.main();

    uploader.on("newClient", (client) => {
        mainWindow.webContents.send("new-client", client);
        console.log(`upload new client: ${client} `);
    });

    uploader.on("progressUpdate", (action) => {
        const { stageDescription, progress } = action;
        mainWindow.webContents.send("update-progress", action);
        console.log(`upload update: ${stageDescription} ,${progress} `);
    });

    uploader.on("completedOperation", (result) => {
        mainWindow.webContents.send("completed-process", result);
        console.log(`upload Completed: ${result} `);
    });

    uploader.on("end", () => {
        console.log("File uploaded successfully.");
    });

    uploader.on("error", (error) => {
        mainWindow.webContents.send("error-process");
        console.error("Error uploading file:", error);
    });
}

function launchExcel() {
    let fontInstaller = new FontInstaller();
    fontInstaller.init();

    const excelPath = path.resolve(__dirname, "../Src/Barcodes.xlsm");
    setTimeout(() => {
        exec(`start excel "${excelPath}"`, (err, stdout, stderr) => {
            if (err) {
                console.error("Error launching Excel:", err);
                console.error(stderr);
                return;
            }
            console.log("Excel launched successfully:", stdout);
        });
    }, 3000);
}

//  * Download - Events Handler
function webDownload_init() {
    const exportProcess = new Downloader();
    exportProcess.main();

    exportProcess.on("newClient", (client) => {
        mainWindow.webContents.send("new-client", client);
        console.log(`Download new client: ${client} `);
    });

    exportProcess.on("progressUpdate", (action) => {
        const { stageDescription, progress } = action;
        mainWindow.webContents.send("update-progress", action);
        console.log(`Download update: ${stageDescription} ${progress} `);
    });

    exportProcess.on("completedOperation", (result) => {
        mainWindow.webContents.send("completed-process", result);
        //  Open Excel Spreadsheet
        if (result === "Success") {
            launchExcel();
        }
    });

    exportProcess.on("end", () => {
        console.log("File downloaded successfully.");
    });

    exportProcess.on("error", (error) => {
        mainWindow.webContents.send("error-process");
        console.error("Error downloading file:", error);
    });
}

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});
