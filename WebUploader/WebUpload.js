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
    "items.xlsx",
);
const Local_UploadFile_Path_Odoo = path.resolve(
    __dirname,
    "..",
    "Config",
    "Odoo_Items.xls",
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
                    chromiumExePattern,
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
                        `${client.name} = Invalid WebApp: ${client.Url}`,
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

                // Check if the page redirection after login is to items and not to deshboard || other
                if (!page.url().includes(client.Url)) {
                    await page.goto(client.Url, {
                        waitUntil: "load",
                        timeout: 600000,
                    }); // url-items
                }

                if (page.url().includes("items")) {
                    console.log(
                        `Successfully navigated to the items page for ${client.name}`,
                    );
                    break;
                }

                console.log(
                    `Failed to redirect to the items page for ${client.name}`,
                );
                retryCounter++;
            } catch (error) {
                console.error(
                    `Error during login attempt - [${retryCounter}]: \n `,
                    error.message,
                );
                retryCounter++;

                //  Retry Limit Break out
                if (retryCounter >= maxRetries) {
                    console.log(
                        `Max login retry attempts reached for ${client.name}. Exiting.`,
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
                    error.message,
                );
                uploadRetryCounter++;

                //  Retry Limit Break out
                if (uploadRetryCounter >= uploadMaxRetries) {
                    console.log(
                        `Max upload retry attempts reached for ${client.name}. Exiting.`,
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

        // Click Import Button
        await page.getByText("Importar").click();

        //await page.click('button.btn.btn-custom.btn-sm.mt-2.mr-2.dropdown-toggle');

        // Products Dropdown Option

        const productsButton = page.getByRole("button", { name: /Productos/i });
        await productsButton.waitFor({ state: "visible" });
        await productsButton.click();

        // Click on WareHouse Selector
        const optionValue = await page
            .locator("#tw-select-1 option")
            .filter({ hasText: /almac.n.*oficina/i })
            .getAttribute("value");

        // 2. Select by that value
        await page.locator("#tw-select-1").selectOption(optionValue);
        //await page.getByPlaceholder("Seleccionar").click();

        //Select Principal warehouse

        /* await page
               .locator(".el-select-dropdown__item")
               .filter({ hasText: /^Almacén$/ })
               .click(); */

        //Select the Upload File Element and uploads the webapp Uploads Format

        // Find the input element by CSS selector
        const inputElement = await page.$('input[type="file"]');

        // Set the input files for the input element
        await inputElement.setInputFiles(Local_UploadFile_Path_ArcaDigital);
        console.log("done uploadgin", Local_UploadFile_Path_ArcaDigital);

        // PROCEED BUTTON
        await page.getByRole("button", { name: /Procesar/i }).click();
        /* await page
               .locator(".el-button.el-button--primary.el-button--small")
               .getByText("Procesar")
               .click(); */
        // Wait network to end
        try {
            const successBanner = page.locator(".el-message--success");

            await successBanner.waitFor({
                state: "attached",
                timeout: 600000,
            });
        } catch (error) {
            throw new Error(
                "El proceso terminó pero no se detectó el mensaje de éxito.",
            );
        }
        await page.waitForLoadState("networkidle", { timeout: 600000 });
    }

    async loginArcaDgital(page, client) {
        this.emit("progressUpdate", {
            stageDescription: "Registrando Credenciales Usuario /  Contrasena",
            progress: 30,
        });

        let urlObject = UrlFactory(client.Url);
        const loginUrl = urlObject.protocol + urlObject.domain + "/login";

        await page.goto(loginUrl, { timeout: 600000 });

        (await page
            .locator('input[type="text"][name^="app-q-input-"]')
            .fill(client.User, { timeout: 600000 }),
            await page
                .locator('input[type="password"][name^="app-q-input-"]')
                .fill(client.Password, { timeout: 600000 }),
            await Promise.all([
                page.waitForURL((url) => !url.href.includes("login"), {
                    waitUntil: "networkidle",
                    timeout: 600000,
                }),
                page.click('button:has-text("Acceder")'),
            ]));

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
