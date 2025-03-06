const fs = require("node:fs/promises");
const { chromium } = require("playwright");
const os = require("os");
const path = require("path");
const { glob, globSync, globStream, globStreamSync, Glob } = require("glob");
const EventEmitter = require("events");

const Local_UploadFile_Path_ArcaDigital = path.resolve(
    __dirname,
    "..",
    "Config",
    "items.xlsx"
);
const Local_UploadFile_Path_Odoo = path.resolve(
    __dirname,
    "..",
    "Config",
    "Odoo_Items.xls"
);
const Upload_Result_Path = `${__dirname}/WebUploadResult.txt`;
const URL_Address_Local_Path = `${__dirname}/WebUploadUrls.json`;

class Uploader extends EventEmitter {
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
            await this.UploadWebApp();
        } catch (e) {
            console.error("Uploader Error: \n", e);
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
                return undefined;
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
                // Parse the JSON content and return the parsed data
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
            await fs.writeFile(Upload_Result_Path, result);
        } catch (err) {
            console.log(`Error updating reult file: \n ${err} \n`);
        }
    }

    // * Main Upload : Redirects to client.webType Methods
    async UploadWebApp() {
        let ResultsLogger = "";

        for (const client of this.clients.clients) {
            this.emit("newClient", client.name);
            let uploadResult = "Undefined";

            switch (client.WebAppType) {
                case "ArcaDigital":
                    this.emit("progressUpdate", {
                        stageDescription: "Accediendo al sitio web",
                        progress: 10,
                    });

                    uploadResult = await this.uploadArcaDigital(client);
                    this.emit("completedOperation", uploadResult);

                    ResultsLogger += `${client.name}=${uploadResult}\n`;
                    break;
                case "Odoo":
                    this.emit("progressUpdate", {
                        stageDescription: "Accediendo al sitio web",
                        progress: 10,
                    });
                    uploadResult = await this.uploadOdoo(client);
                    this.emit("completedOperation", uploadResult);
                    ResultsLogger += `${client.name}=${uploadResult}\n`;
                    break;
                default:
                    console.log(
                        `${client.name} = Invalid WebApp: ${client.Url}`
                    );
                    break;
            }
        }

        console.log("ResultsLogger: ", ResultsLogger);

        this.updateResultFile(ResultsLogger);
        this.browser.close();
    }

    async uploadArcaDigital(client) {
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

        // Upload Attempt

        let uploadRetryCounter = 0;
        const uploadMaxRetries = 4;

        while (uploadRetryCounter < uploadMaxRetries) {
            try {
                await this.beginUploadArcaDigital(page);
                break;
            } catch (error) {
                console.error(
                    `Error during Upload Retry - ${uploadRetryCounter}: \n`,
                    error.message
                );
                uploadRetryCounter++;

                //  Retry Limit Break out
                if (uploadRetryCounter >= uploadMaxRetries) {
                    console.log(
                        `Max upload retry attempts reached for ${client.name}. Exiting.`
                    );
                    await page.close();
                    return "Failed";
                }

                //  Delay betwenn Attempts
                await new Promise((resolve) => setTimeout(resolve, 5000));
            }
        }

        console.log("SUCCESS OPERATION");
        await page.close();
        return "Success";
    }

    async beginUploadArcaDigital(page) {
        this.emit("progressUpdate", {
            stageDescription:
                "obteniendo la interfaz de subida de archivos(productos)",
            progress: 60,
        });

        // Click Export Button
        await page.getByText("Importar").click();

        //await page.click('button.btn.btn-custom.btn-sm.mt-2.mr-2.dropdown-toggle');

        // Products Dropdown Option
        await page
            .locator(".dropdown-item.text-1")
            .getByText("Productos")
            .click();

        // Click on WareHouse Selector
        await page.getByPlaceholder("Seleccionar").click();

        //Select Principal warehouse
        await page
            .locator(".el-select-dropdown__item")
            .getByText("Almacén")
            .click();

        //Select the Upload File Element and uploads the webapp Uploads Format

        // Find the input element by CSS selector
        const inputElement = await page.$(".el-upload__input[name='file']");

        // Set the input files for the input element
        await inputElement.setInputFiles(Local_UploadFile_Path_ArcaDigital);

        // PROCEED BUTTON
        await page
            .locator(".el-button.el-button--primary.el-button--small")
            .getByText("Procesar")
            .click();
        // Wait network to end
        await page.waitForLoadState("networkidle", { timeout: 600000 });
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
}

// * Shell Execution
if (require.main === module) {
    const uploader = new Uploader();
    uploader.main(); // Call the main method
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

module.exports = {
    Uploader,
};
