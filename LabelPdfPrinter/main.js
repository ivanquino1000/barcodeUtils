require("dotenv").config();
const { exec } = require("child_process");
const { error } = require("console");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { PDFDocument } = require("pdf-lib");
const { print } = require("pdf-to-printer");
const { getPrinters, getPrinterStatus, isPrinterAvailable } = require("./printerData.js");
const { select, Separator } = require("@inquirer/prompts");
const { promises } = require("dns");

const exeDir = path.dirname(process.execPath);

// packaged app Execution
let pdfLayoutDir = path.resolve(exeDir, "pdf-layout");
let pdfOutputDir = path.resolve(exeDir, "pdf-output");
let localSumatraPdfPath = path.resolve(exeDir, "SumatraPDF-3.4.6-32.exe");

// devEnviroment Execution
if (process.env.NODE_ENV === "development") {
  console.log(process.env.NODE_ENV);
  pdfLayoutDir = path.resolve(__dirname, "pdf-layout");
  pdfOutputDir = path.resolve(__dirname, "pdf-output");
  localSumatraPdfPath = "";
}

main();

async function main() {
  // Exit the program if the input folder does not exist or is not accessible
  if (!fs.existsSync(pdfLayoutDir)) {
    console.error(`Missing Input Layout Folder : ./pdf-layout`);
    return;
  }

  // Restart output folder
  {
    if (fs.existsSync(pdfOutputDir)) {
      fs.rmSync(pdfOutputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(pdfOutputDir, { recursive: true });
  }

  const files = fs.readdirSync(pdfLayoutDir);

  // No Files on input folder
  if (files.length === 0) {
    console.error(`No files found in : ${pdfLayoutDir}`);
    return;
  }

  // generate multi-page pdf
  for (let i = 0; i < files.length; i++) {
    try {
      const pdfName = files[i];
      const pdf = await parsePdfBindings(pdfName, pdfLayoutDir);
      await createMultiPagePdf(pdf);
    } catch (e) {
      console.error(`${i} ERROR creating pdf.\n ${e}`);
    }
  }

  // PRINT multi-page pdf
  const completePdf = fs.readdirSync(pdfLayoutDir); /*list of pdf names*/
  const multiPagePdf = completePdf.sort((a, b) => {
    const numA = parseInt(a.split('-')[0], 10);
    const numB = parseInt(b.split('-')[0], 10);

    return numA - numB;
  });

  // Exit if no files to process in the input folder
  if (multiPagePdf.length === 0) {
    console.error(`No files found in : ${pdfOutputDir}`);
    return;
  }

  for (let i = 0; i < multiPagePdf.length; i++) {
    try {
      const pdfName = multiPagePdf[i];
      const pdf = await parsePdfBindings(pdfName, pdfLayoutDir);
      await printPDF(pdf);
    } catch (e) {
      console.error(`${i} ERROR at processing pdf.\n ${e}`);
    }
  }
  console.log(files);
}

//  Returns a pdf-Object with embeded data
async function parsePdfBindings(fileName, filePath) {
  //    [id]?-?[printerName]-[productCode]-[pageCopies].pdf
  //    [id]?-?godex ez4401i-951570252516-120.pdf

  const regex = /^(\d+)?-?([a-zA-Z0-9\s\(\)-]+)-([a-zA-Z0-9-]+)-(\d+)\.pdf$/;
  const match = fileName.match(regex);
  if (match) {
    return {
      path: path.join(filePath, fileName),
      pdfName: fileName,
      printerName: match[2],
      productCode: match[3],
      pageCopies: parseInt(match[4], 10),
    };
  } else {
    throw new Error("PDF Metadata doesn't match expected format.");
  }
}

async function checkPrinterStatus(
  printerName,
  timeout = 10000,
  interval = 10
) {
  let elapsedTime = 0;
  while (elapsedTime < timeout) {
    const isReady = (await getPrinterStatus(printerName)) == "Unknown";
    if (isReady) {
      return true;
    }

    // Wait for the interval before retrying (3 seconds)
    await new Promise((resolve) => setTimeout(resolve, interval));
    elapsedTime += interval;
  }

  // Timeout reached, return false if not ready
  console.log("Timeout reached. Printer is not ready.");
  return false;
}

async function createMultiPagePdf(pdf) {
  // Read the original 1-page PDF
  const originalPdfBytes = fs.readFileSync(pdf.path);
  const originalPdf = await PDFDocument.load(originalPdfBytes);

  // Create a new PDF document
  const newPdf = await PDFDocument.create();

  // Copy the pages from the original PDF to the new PDF `copies` times
  const [originalPage] = await newPdf.copyPages(originalPdf, [0]);
  for (let i = 0; i < pdf.pageCopies; i++) {
    newPdf.addPage(originalPage);
  }

  // Save the new multi-page PDF
  const newPdfBytes = await newPdf.save();

  // Create output folder
  if (!fs.existsSync(pdfOutputDir)) {
    fs.mkdirSync(pdfOutputDir, { recursive: true });
  }

  const newPdfPath = path.join(pdfOutputDir, `${pdf.pdfName}`);
  fs.writeFileSync(newPdfPath, newPdfBytes);

  //console.log(`Multi-page PDF created at : \n ${newPdfPath}`);
  return newPdfPath;
}

async function printPDF(pdf) {
  try {
    const options = {
      printer: pdf.printerName,
      sumatraPdfPath: localSumatraPdfPath,
      orientation: "landscape",
      copies: pdf.pageCopies,
    };
    const isprinterReady = await checkPrinterStatus(pdf.printerName);
    const isPrinterActive = await isPrinterAvailable(pdf.printerName);

    if (!isPrinterActive || !isprinterReady) {
      const action = await select({
        message: `Error al Imprimir ${pdf.pdfName}`,
        choices: [
          {
            name: "continuar",
            value: "continue",
            description: "envia a imprimir el resto de pdfs",
          },
          {
            name: "cancelar",
            value: "cancel",
            description: "cancela la impresion de todos los pdf restantes",
          },
        ],
      });
      if (action === "cancel") {
        console.log("Proceso cancelado.");
        process.exit()
      }
    }

    await print(pdf.path, options);
    await new Promise((resolve) => setTimeout(resolve, getLogarithmicDelay(pdf.pageCopies)));

    console.log(`Pdf se envio correctamente:  "${pdf.pdfName}".`);
  } catch (err) {
    console.error(`Error printing to printer "${pdf.pdfName}":`, err);
  }
}

function getLogarithmicDelay(input) {
  let delay;

  if (input <= 20) {
    // Logarithmic scaling between 2 and 5 seconds for inputs 1 to 20
    delay = Math.log(input) * (5 - 2) / Math.log(20) + 2;
  } else if (input <= 50) {
    // Logarithmic scaling between 5 and 8 seconds for inputs 21 to 50
    delay = Math.log(input) * (8 - 5) / Math.log(50) + 5;
  } else {
    // As input exceeds 50, the delay approaches 15 seconds
    delay = Math.log(input) * (15 - 8) / Math.log(100) + 8;
  }

  // Ensure the delay is between 1 and 15 seconds
  delay = Math.min(Math.max(delay, 1), 15);

  return delay;
}