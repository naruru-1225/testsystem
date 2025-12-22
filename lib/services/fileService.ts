import fs from "fs";
import path from "path";
import heicConvert from "heic-convert";

export interface SavedFileInfo {
  path: string;
  fileName: string;
  size: number;
  mimeType: string;
  converted: string | null;
}

export const fileService = {
  saveFile: async (file: File, testId?: number): Promise<SavedFileInfo> => {
    let uploadDir: string;
    let publicPath: string;
    let finalMimeType = file.type;
    let finalFileSize = file.size;
    let fileExt = (file.name.split(".").pop() || "pdf").toLowerCase();
    let converted: string | null = null;

    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);

    // ディレクトリの決定
    if (testId) {
      uploadDir = path.join(
        process.cwd(),
        "public",
        "uploads",
        "pdfs",
        `test_${testId}`
      );
    } else {
      uploadDir = path.join(process.cwd(), "public", "uploads", "pdfs");
    }

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // ファイルデータの読み込み
    const arrayBuffer = await file.arrayBuffer();
    let buffer = Buffer.from(arrayBuffer);

    // HEIC変換
    if (
      file.type === "image/heic" ||
      file.type === "image/heif" ||
      fileExt === "heic" ||
      fileExt === "heif"
    ) {
      console.log("HEICファイルを検出、JPEG変換を開始:", file.name);
      try {
        const convertedBuffer = await heicConvert({
          buffer: buffer,
          format: "JPEG",
          quality: 0.9,
        });
        buffer = Buffer.from(convertedBuffer);
        fileExt = "jpg";
        finalMimeType = "image/jpeg";
        finalFileSize = buffer.length;
        converted = "HEIC→JPEG";
        console.log("HEIC→JPEG変換成功:", file.name, "→", fileExt);
      } catch (convertError) {
        console.error("HEIC変換エラー:", convertError);
        throw new Error("HEICファイルの変換に失敗しました");
      }
    }

    const fileName = `${timestamp}-${randomStr}.${fileExt}`;
    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, buffer);

    if (testId) {
      publicPath = `/uploads/pdfs/test_${testId}/${fileName}`;
    } else {
      publicPath = `/uploads/pdfs/${fileName}`;
    }

    return {
      path: publicPath,
      fileName: file.name, // 元のファイル名
      size: finalFileSize,
      mimeType: finalMimeType,
      converted,
    };
  },

  deleteFile: (relativePath: string) => {
    const fullPath = path.join(process.cwd(), "public", relativePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      return true;
    }
    return false;
  },
};
