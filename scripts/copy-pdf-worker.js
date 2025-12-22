const fs = require("fs");
const path = require("path");

// PDF.js workerファイルをpublicフォルダにコピー
const sourceFile = path.join(
  __dirname,
  "..",
  "node_modules",
  "pdfjs-dist",
  "build",
  "pdf.worker.min.mjs"
);
const targetDir = path.join(__dirname, "..", "public", "pdfjs");
const targetFile = path.join(targetDir, "pdf.worker.min.mjs");

try {
  // ディレクトリが存在しない場合は作成
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    console.log("Created directory:", targetDir);
  }

  // ファイルをコピー
  fs.copyFileSync(sourceFile, targetFile);
  console.log("✅ PDF.js worker file copied successfully to public/pdfjs/");
} catch (error) {
  console.error("❌ Error copying PDF.js worker file:", error.message);
  process.exit(1);
}
