
const { chromium } = require("playwright");
const notifier = require("node-notifier");
const os = require("os");
const fs = require("node:fs/promises");
const EventEmitter = require("events");
const { glob, globSync, globStream, globStreamSync, Glob } = require("glob");
const path = require("path");

const URL_Address_Local_Path = `${__dirname}/WebExportUrls.json`;
const Platform_Downloads_Path = `${os.homedir}\\Downloads\\`;
const Export_Result_Path = `${__dirname}/WebExportResult.txt`;

const SUCCESS_NOTIFICATION = {
    title: "Descarga de Archivos",
    message: "EXITOSO",
    timeout: 300000,
    icon: __dirname + "/icons/notifier-success.webp",
};
const FAILED_NOTIFICATION = {
    title: "Descarga de Archivos",
    message: "FALLIDA",
    timeout: 300000,
    icon: __dirname + "/icons/notifier-error.png",
};

class Downloader extends EventEmitter {
    constructor() {
        super();
        this.clients = {};
        this.browser = null;
    }

    async main() {
        try {
            await this.updateResultFile("Undefined");
            this.clients = await this.getClientsData();

            this.browser = await chromium.launch({
                headless: false,
                executablePath: await this.findBrowserExecutable(),
            });
            await this.ExportFromWeb();
        } catch (e) {
            console.error("Downloader Error: \n ", e);
        }
    }

    async findBrowserExecutable() {
        // undefined uses the default chromium path
        let browserExecutablePath = [];
        const chromiumExePattern = __dirname + "/browser" + "/**/chrome.exe";

        try {
            browserExecutablePath = await glob(chromiumExePattern);
            console.log("matching browser paths: \n", browserExecutablePath);
            if (!browserExecutablePath.length) {
                console.log(
                    "No executable found with this pattern:\n",
                    chromiumExePattern
                );
                return undefined
            }
            return browserExecutablePath[0];
        } catch (e) {
            console.log("Error getting chromium Path: ", e);
            return undefined;
        }
    }

    async getClientsData() {
        try {
            const data = await fs.readFile(URL_Address_Local_Path, "utf8");
            try {
                return JSON.parse(data);
            } catch (parseError) {
                throw new Error(`Error Parsing Client Json: ${parseError}`);
            }
        } catch (readError) {
            throw new Error(`Error Reading Client Json: ${readError}`);
        }
    }

    async updateResultFile(result) {
        try {
            await fs.writeFile(Export_Result_Path, result);
        } catch (err) {
            console.log(`Error updating reult file: \n ${err} \n`);
        }
    }

    async ExportFromWeb() {
        let exportResult = "";

        for (const client of this.clients.clients) {
            this.emit("newClient", client.name);
            let result = "Undefined";

            switch (client.WebAppType) {
                case "ArcaDigital":
                    this.emit("progressUpdate", {
                        stageDescription: "Accediendo al sitio web",
                        progress: 10,
                    });

                    result = await this.ExportArcaDigital(client);
                    this.emit("completedOperation", result);
                    exportResult += `${result}`;

                    break;
                case "Odoo":
                    this.emit("progressUpdate", {
                        stageDescription: "Accediendo al sitio web",
                        progress: 10,
                    });

                    result = await this.exportOdoo(client);
                    this.emit("completedOperation", result);
                    exportResult += `${result}`;
                    break;
                default:
                    console.log(
                        `${client.name} = Invalid WebApp: ${client.Url}`
                    );
                    break;
            }
        }

        console.log("exportResult: ", exportResult);

        const notification =
            exportResult === "Success"
                ? SUCCESS_NOTIFICATION
                : FAILED_NOTIFICATION;
        notifier.notify(notification);

        this.updateResultFile(exportResult);
        this.browser.close();
    }

    async ExportArcaDigital(client) {
        const page = await this.browser.newPage();

        //  * Login Process
        let retryCounter = 0;
        const maxRetries = 4;

        while (retryCounter < maxRetries) {
            try {
                await this.loginArcaDgital(page, client);
                await page.goto(client.Url, { timeout: 600000 }); // url-items

                if (page.url().includes("items")) {
                    console.log(
                        `Successfully navigated to the items page for ${client.name}`
                    );
                    break;
                }

                console.log(
                    `Failed to redirect to the items page for ${client.name}`
                );
                retryCounter++;
            } catch (error) {
                console.error(
                    `Error during login attempt - [${retryCounter}]: \n `,
                    error.message
                );
                retryCounter++;

                //  Retry Limit Break out
                if (retryCounter >= maxRetries) {
                    console.log(
                        `Max login retry attempts reached for ${client.name}. Exiting.`
                    );
                    return "Failed";
                }

                //  Delay betwenn Attempts
                await new Promise((resolve) => setTimeout(resolve, 8000));
            }
        }

        // Download Attempt

        let downloadRetryCounter = 0;
        const downloadMaxRetries = 4;

        while (downloadRetryCounter < downloadMaxRetries) {
            try {
                await this.start_Download_ArcaDigital(page);
                break;
            } catch (error) {
                console.error(
                    `Error during Download Retry - ${downloadRetryCounter}: \n`,
                    error.message
                );
                downloadRetryCounter++;

                //  Retry Limit Break out
                if (downloadRetryCounter >= downloadMaxRetries) {
                    console.log(
                        `Max downlaod retry attempts reached for ${client.name}. Exiting.`
                    );
                    return "Failed";
                }

                await new Promise((resolve) => setTimeout(resolve, 5000));
            }
        }

        console.log("SUCCESS OPERATION");
        return "Success";
    }

    async loginArcaDgital(page, client) {
        this.emit("progressUpdate", {
            stageDescription: "Registrando Credenciales Usuario /  Contrasena",
            progress: 30,
        });

        let urlObject = UrlFactory(client.Url);

        await page.goto(urlObject.protocol + urlObject.domain + "/login", {
            timeout: 600000,
        });
        await page.type("#email", client.User);
        await page.type("#password", client.Password);
        await page.click(".btn-signin");

        return;
    }

    async start_Download_ArcaDigital(page) {
        this.emit("progressUpdate", {
            stageDescription:
                "obteniendo la interfaz de subida de archivos(productos)",
            progress: 60,
        });

        // Click Export Button
        await page.click(
            "button.btn.btn-custom.btn-sm.mt-2.mr-2.dropdown-toggle"
        );

        // Wait for the dropdown menu to appear
        await page.waitForSelector("a.dropdown-item.text-1");

        // Click on the first element in the dropdown menu - Listado
        await page.click("a.dropdown-item.text-1");

        // Click on Time Period Selector
        const timeRangeLocator = await page.$$(".el-input__inner");
        await timeRangeLocator[2].click({ timeout: 3000 });

        // Click the ALL option
        //const periodOption = await  page.$$('.el-select-dropdown__item');

        const timeRangeOption = await page.getByText("Todos"); //$$('.el-select-dropdown__item');
        await timeRangeOption.click();

        // Click on Procced Button

        const ProccessButton = await page.$$(
            ".el-button.el-button--primary.el-button--small"
        );

        // Start waiting for download before clicking. Note no await.
        const downloadPromise = page.waitForEvent("download", {
            timeout: 600000,
        });

        await ProccessButton[2].click();
        //await page.getByText('Download file').click();
        const download = await downloadPromise;

        // Wait for the download process to complete and save the downloaded file.
        await download.saveAs(
            Platform_Downloads_Path + download.suggestedFilename()
        );
    }
}

// * Shell Execution
if (require.main === module) {
    const downloader = new Downloader();
    downloader.main(); // Call the main method
}

//  ?   Additional Helper/Support Functions

function UrlFactory(url) {
    const urlRegex =
        /^(https?:\/\/)?((\d{1,3}\.){3}\d{1,3}|([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,})(\/\S*)?$/;
    const match = url.match(urlRegex);

    let urlObject = {};

    if (match) {
        const protocol = match[1] || "http://";
        const domain = match[2];
        const path = match[5] || "/";

        urlObject = {
            completeUrl: protocol + domain + path,
            domain: domain,
            path: path,
            protocol: protocol,
        };
        return urlObject;
    } else {
        return;
    }
}

// * Operation Results
// ?   Undefined: Proccess started
// *   Success: Proccess started
// !   Failed: Proccess started

module.exports = {
    Downloader,
};
