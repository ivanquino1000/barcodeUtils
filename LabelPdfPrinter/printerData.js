const { execFile, exec } = require("child_process");
const { stat } = require("fs");
const util = require("util");

// Promisify exec to use async/await
const execFileAsync = util.promisify(execFile);

const properties = {
  DeviceID: "deviceId",
  Name: "name",
  PrinterPaperNames: "paperSizes",
  Status: "status",
  PrinterStatus: "printerStatus",
  WorkOffline: "workOffline", // False - Printer online , True - Printer online  
  Queued: "queued",
  PrinterState: "printerState",
  ExtendedPrinterStatus: "extendedPrinterStatus",
};

// This function checks if the printer data is valid and parses the data
function IsValidPrinter(printer) {
  const printerData = {
    deviceId: "",
    name: "",
    paperSizes: [],
    status: "",
    printerStatus: "",
    workOffline: "",
    queued: "",
    printerState: "",
    extendedPrinterStatus: "",
  };


  printer.split(/\r?\n/).forEach((line) => {
    let [label, value] = line.split(":").map((el) => el.trim());

    if (label === undefined || value === undefined) {
      return;
    }
    // handle array dots
    if (value.match(/^{(.*)(\.{3})}$/)) {
      value = value.replace("...}", "}");
    }

    // handle array returns
    const matches = value.match(/^{(.*)}$/);

    if (matches && matches[1]) {
      value = matches[1].split(", ");
    }

    const key = properties[label];

    if (key === undefined) return;

    // Assign value to the corresponding printer data field
    printerData[key] = value;
  });

  const isValid = !!(printerData.deviceId && printerData.name);

  return {
    isValid,
    printerData,
  };
}

async function getPrinters() {
  function stdoutHandler(stdout) {
    const printers = [];

    // Split stdout based on two or more line breaks
    stdout
      .split(/(\r?\n){2,}/)
      .map((printer) => printer.trim())
      .filter((printer) => !!printer)
      .forEach((printer) => {
        const { isValid, printerData } = IsValidPrinter(printer);

        if (!isValid) return;

        printers.push(printerData);
      });

    return printers;
  }

  try {
    const { stdout } = await execFileAsync("Powershell.exe", [
      "-Command",
      "Get-CimInstance Win32_Printer | Format-List DeviceID,Name,PrinterPaperNames,Status,PrinterStatus,WorkOffline,Queued,PrinterState,ExtendedPrinterStatus",
    ]);
    return stdoutHandler(stdout);
  } catch (error) {
    throw error;
  }
}


async function isPrinterAvailable(printerName) {
  const printers = await getPrinters();
  const printer = printers.find((printer) => printer.name === printerName);
  if (!printer) {
    console.log(`Printer ${printerName} not found.`);
    return true;
  }
  //console.log(`${printerName}  state: ` + printer.status);
  if (printer.workOffline == "False") { return true } else { return false }

}


async function hasQueueJobs(printerName) {
  const printers = await getPrinters();
  const printer = printers.find((printer) => printer.name === printerName);
  if (!printer) {
    console.log(`Printer ${printerName} not found.`);
    return null;
  }
  // console.log(`${printerName} state: ${JSON.stringify(printer, null, 2)}`);

  return printer.status;
}


async function getPrinterStatus(printerName) {
  const printers = await getPrinters();
  const printer = printers.find((printer) => printer.name === printerName);
  if (!printer) {
    console.log(`Printer ${printerName} not found.`);
    return null;
  }
  // console.log(`${printerName} state: ${JSON.stringify(printer, null, 2)}`);

  return printer.status;
}

module.exports = {
  getPrinters,
  getPrinterStatus,
  isPrinterAvailable,
};
