"use client";

import { useState, useEffect, useMemo } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import type { TestAttachment } from "@/types/database";

interface PdfViewerProps {
  pdfUrl: string | null;
  attachments?: TestAttachment[];
  testName?: string;
  testId?: number; // テストID（サイズ変換用）
  onClose: () => void;
}

// ファイルタイプを判定する関数
const getFileType = (
  mimeType?: string,
  fileName?: string
): "pdf" | "image" | "unknown" => {
  if (mimeType) {
    if (mimeType === "application/pdf") return "pdf";
    if (mimeType.startsWith("image/")) return "image";
  }
  // mime_typeがない場合はファイル名から判定
  if (fileName) {
    const ext = fileName.toLowerCase().split(".").pop();
    if (ext === "pdf") return "pdf";
    if (
      ["jpg", "jpeg", "png", "heic", "heif", "gif", "webp", "bmp"].includes(
        ext || ""
      )
    )
      return "image";
  }
  return "unknown";
};

export default function PdfViewer({
  pdfUrl,
  attachments = [],
  testName,
  testId,
  onClose,
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<number>(0);
  const [pdfKey, setPdfKey] = useState<number>(0); // PDFを強制的に再レンダリングするためのキー
  const [retryCount, setRetryCount] = useState<number>(0); // リトライ回数
  const [currentFileType, setCurrentFileType] = useState<
    "pdf" | "image" | "unknown"
  >("pdf");
  const [workerReady, setWorkerReady] = useState(false); // Worker設定完了フラグ
  const [useFallback, setUseFallback] = useState(false); // Safari 16フォールバックフラグ
  const [sizeByTab, setSizeByTab] = useState<Record<number, string | null>>({}); // タブごとの用紙サイズ

  // 現在のタブのサイズ選択を取得
  const selectedSize = sizeByTab[activeTab] || null;

  // Safari/iPadOSバージョン検出
  const detectOldSafari = () => {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent;
    // iPadOS 16.x または Safari 16.x を検出
    const isOldIOS = /iPad.*OS 16_/.test(ua) || /iPhone.*OS 16_/.test(ua);
    const isOldSafari = /Version\/16\./.test(ua);
    return isOldIOS || isOldSafari;
  };

  // PDF.js worker を設定 (iPad Safari対応: 絶対URLを使用)
  // バージョン: 2025-11-06 v3.2-FINAL - Safari 16対応
  useEffect(() => {
    console.log("🎬🎬🎬 [v3.2-FINAL] PdfViewer コンポーネント初期化");
    console.log("🎬🎬🎬 [v3.2-FINAL] 修正版が適用されています");

    const isOldSafari = detectOldSafari();
    console.log("🔍🔍🔍 [v3.2-FINAL] Safari 16系検出:", isOldSafari);

    try {
      if (typeof window !== "undefined") {
        const workerSrc = `${window.location.origin}/pdfjs/pdf.worker.min.mjs`;
        pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
        console.log("🔧🔧🔧 [v3.2-FINAL] PDF.js Worker設定成功:", workerSrc);
        console.log("🔧🔧🔧 [v3.2-FINAL] PDF.js version:", pdfjs.version);
        console.log("🔧🔧🔧 [v3.2-FINAL] User Agent:", navigator.userAgent);
        setWorkerReady(true);
      } else {
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
        console.log(
          "🔧🔧🔧 [v3.2-FINAL] PDF.js Worker設定(SSR):",
          "/pdfjs/pdf.worker.min.mjs"
        );
        setWorkerReady(true);
      }
    } catch (err) {
      console.error("❌❌❌ [v3.2-FINAL] Worker設定エラー:", err);
      setWorkerReady(false);
    }
  }, []);

  // URLをAPI経由のパスに変換する関数
  const getAbsoluteUrl = (path: string | null) => {
    if (!path) return null;
    // 既に絶対URLの場合はそのまま返す
    if (path.startsWith("http://") || path.startsWith("https://")) {
      return path;
    }
    // /uploads/pdfs/xxx.pdf → /api/pdf/pdfs/xxx.pdf に変換
    // これによりAPI経由でPDFを配信し、CORS問題を回避
    const apiPath = path.replace("/uploads/", "/api/pdf/");
    // クライアントサイドでのみwindowオブジェクトにアクセス
    if (typeof window !== "undefined") {
      return `${window.location.origin}${apiPath}`;
    }
    return apiPath;
  };

  // 全ファイル（メインPDF + 添付ファイル）
  const allFiles = useMemo(() => {
    let mainFileArray: Array<{
      name: string;
      path: string;
      mimeType: string;
      fileName: string;
      originalPath?: string; // サイズ変換用の元パス
      isMainPdf?: boolean;
    }> = [];
    if (pdfUrl) {
      const absoluteUrl = getAbsoluteUrl(pdfUrl);
      if (absoluteUrl) {
        // 実際のファイル拡張子を取得
        const extension = pdfUrl.split(".").pop()?.toLowerCase() || "pdf";
        const isPdf = extension === "pdf";
        // 拡張子に基づいてMIMEタイプを決定
        let mimeType = "application/pdf";
        if (!isPdf) {
          // 画像ファイルの場合
          if (["jpg", "jpeg"].includes(extension)) {
            mimeType = "image/jpeg";
          } else if (["png"].includes(extension)) {
            mimeType = "image/png";
          } else if (["heic", "heif"].includes(extension)) {
            mimeType = "image/heic";
          } else if (["gif"].includes(extension)) {
            mimeType = "image/gif";
          } else if (["webp"].includes(extension)) {
            mimeType = "image/webp";
          } else if (["bmp"].includes(extension)) {
            mimeType = "image/bmp";
          } else {
            mimeType = `image/${extension}`;
          }
        }
        mainFileArray = [
          {
            name: "メインPDF",
            path: absoluteUrl,
            mimeType: mimeType,
            fileName: `main.${extension}`,
            originalPath: pdfUrl, // サイズ変換API用
            isMainPdf: true,
          },
        ];
      }
    }
    return [
      ...mainFileArray,
      ...attachments.map((att) => {
        // mime_typeがnullの場合は拡張子から推測
        let mimeType = att.mime_type;
        if (!mimeType && att.file_path) {
          const ext = att.file_path.split(".").pop()?.toLowerCase();
          if (ext === "pdf") {
            mimeType = "application/pdf";
          } else if (["jpg", "jpeg"].includes(ext || "")) {
            mimeType = "image/jpeg";
          } else if (ext === "png") {
            mimeType = "image/png";
          } else if (["heic", "heif"].includes(ext || "")) {
            mimeType = "image/heic";
          } else if (ext === "gif") {
            mimeType = "image/gif";
          } else if (ext === "webp") {
            mimeType = "image/webp";
          } else if (ext === "bmp") {
            mimeType = "image/bmp";
          }
        }
        return {
          name: att.file_name,
          path: getAbsoluteUrl(att.file_path),
          mimeType: mimeType || "application/octet-stream",
          fileName: att.file_name,
          originalPath: att.file_path, // サイズ変換API用
          isMainPdf: false,
        };
      }),
    ];
  }, [pdfUrl, attachments]);

  const currentFile = useMemo(
    () => allFiles[activeTab] || null,
    [allFiles, activeTab]
  );
  
  // サイズが選択されている場合は変換APIのURLを使用
  const currentPdf = useMemo(() => {
    if (!currentFile?.path) return null;
    
    // PDFでサイズが選択されている場合（メインPDF・添付PDFの両方対応）
    if (selectedSize && testId && currentFile.originalPath) {
      const fileType = getFileType(currentFile.mimeType, currentFile.fileName);
      if (fileType === "pdf") {
        const encodedPath = encodeURIComponent(currentFile.originalPath);
        // 添付ファイルの場合はattachment識別子を追加
        const attachmentParam = currentFile.isMainPdf ? "" : `&attachment=true&tabIndex=${activeTab}`;
        return `/api/pdf/sized?testId=${testId}&size=${selectedSize}&pdfPath=${encodedPath}${attachmentParam}`;
      }
    }
    
    return currentFile.path;
  }, [currentFile, selectedSize, testId, activeTab]);

  // PDF.js options をメモ化して不要な再レンダリングを防ぐ
  // iPad Safari対応: withCredentialsをfalseに設定
  const pdfOptions = useMemo(() => {
    const options = {
      cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
      verbosity: 5, // 最大ログレベル - すべての内部ログを出力
      withCredentials: false, // CORS問題を回避
      isEvalSupported: false, // Safari互換性向上
    };
    console.log(
      "⚙️⚙️⚙️ [v3.2-FINAL] PDF.js オプション設定:",
      JSON.stringify(options, null, 2)
    );
    return options;
  }, []);

  // タブが変更されたときにファイルを再読み込み
  // Worker設定完了後のみ実行
  useEffect(() => {
    if (!workerReady) {
      console.log("⏸️⏸️⏸️ [v3.2-FINAL] Worker未準備のため待機中...");
      return;
    }

    console.log(
      "📂📂📂 [v3.2-FINAL] タブ変更 useEffect 実行",
      JSON.stringify({ activeTab, currentFile, workerReady }, null, 2)
    );

    if (currentFile) {
      const fileType = getFileType(
        currentFile.mimeType || undefined,
        currentFile.fileName
      );
      console.log(
        "📄📄📄 [v3.2-FINAL] ファイルタイプ判定:",
        fileType,
        JSON.stringify(
          {
            mimeType: currentFile.mimeType,
            fileName: currentFile.fileName,
          },
          null,
          2
        )
      );
      setCurrentFileType(fileType);

      if (fileType === "image") {
        console.log("🖼️🖼️🖼️ [v3.2-FINAL] 画像ファイルとして処理");
        setLoading(false);
        setError(null);
        setNumPages(1);
        setPageNumber(1);
      } else {
        console.log("📕📕📕 [v3.2-FINAL] PDFファイルとして処理");
        console.log(
          "🔍🔍🔍 [v3.2-FINAL] Safari 16検出結果:",
          detectOldSafari()
        );
        setLoading(true);
        setError(null);
        setNumPages(0);
        setPageNumber(1);
        setRetryCount(0);
        setPdfKey((prev) => prev + 1);
        setUseFallback(false); // PDFファイル変更時はフォールバックをリセット

        // タイムアウトは別のuseEffectで監視
        console.log("⏰⏰⏰ [v3.2-FINAL] PDF処理開始 - loading=true設定");
      }
    } else {
      console.log("⚠️⚠️⚠️ [v3.2-FINAL] currentFileが null です");
    }
  }, [activeTab, currentFile, workerReady]);

  // タイムアウト監視: loading状態が15秒以上続く場合、フォールバックモードへ
  useEffect(() => {
    if (currentFileType !== "pdf" || !workerReady || useFallback) {
      return;
    }

    if (loading && currentPdf) {
      console.log("⏰⏰⏰ [v3.2-FINAL] loading監視開始: 15秒後にタイムアウト");
      const timeoutId = setTimeout(() => {
        console.log("⏱️⏱️⏱️ [v3.2-FINAL] PDF読み込みタイムアウト検出!");
        console.log("⏱️⏱️⏱️ [v3.2-FINAL] フォールバックモード起動");
        console.log("⏱️⏱️⏱️ [v3.2-FINAL] Safari 16検出:", detectOldSafari());
        setUseFallback(true);
        setLoading(false);
      }, 15000);

      return () => {
        console.log("🔄🔄🔄 [v3.2-FINAL] loading状態変化 - タイムアウトクリア");
        clearTimeout(timeoutId);
      };
    }
  }, [loading, currentPdf, currentFileType, workerReady, useFallback]);

  // デバッグ用:ファイルのURLをコンソールに出力
  console.log(
    "📍📍📍 [v3.2-FINAL] レンダリング時の状態:",
    JSON.stringify(
      {
        pdfUrl,
        currentPdf,
        allFilesCount: allFiles.length,
        currentFileType,
        loading,
        error,
        workerReady,
        useFallback,
      },
      null,
      2
    )
  );

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    console.log(
      "✅✅✅ [v3.2-FINAL] PDF読み込み成功:",
      currentPdf,
      "ページ数:",
      numPages
    );
    console.log(
      "✅✅✅ [v3.2-FINAL] PDF詳細:",
      JSON.stringify(
        {
          url: currentPdf,
          numPages,
          fileType: currentFileType,
          workerReady,
          userAgent:
            typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
        },
        null,
        2
      )
    );

    // loading=falseでタイムアウトが自動的にクリアされる
    setNumPages(numPages);
    setLoading(false);
    setError(null);
    setRetryCount(0);
    setUseFallback(false);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error("❌❌❌ [v3.2-FINAL] PDF読み込みエラー:", error);
    console.error(
      "❌❌❌ [v3.2-FINAL] エラー詳細:",
      JSON.stringify(
        {
          message: error.message,
          name: error.name,
          stack: error.stack,
          url: currentPdf,
          workerReady,
          workerSrc: pdfjs.GlobalWorkerOptions.workerSrc,
          userAgent:
            typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
          platform:
            typeof navigator !== "undefined" ? navigator.platform : "unknown",
        },
        null,
        2
      )
    );

    // リトライ処理（最大3回）
    if (retryCount < 3) {
      console.log(`🔄🔄🔄 [v3.2-FINAL] リトライ ${retryCount + 1}/3`);
      setRetryCount((prev) => prev + 1);
      setPdfKey((prev) => prev + 1);
      // loading=trueのままなのでタイムアウト監視は継続
      return;
    }

    // リトライ失敗後はフォールバックモードへ
    console.log("⚠️⚠️⚠️ [v3.2-FINAL] リトライ失敗 - フォールバックモード起動");
    setUseFallback(true);
    setLoading(false);
  };

  const handleTabChange = (index: number) => {
    setActiveTab(index);
  };

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(prev + 1, numPages));
  };

  const handlePrint = () => {
    if (currentPdf) {
      if (currentFileType === "image") {
        // 画像の場合は、印刷用ウィンドウを作成
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          // 画像用の用紙サイズCSS
          const pageSizeCSS = selectedSize 
            ? `@page { size: ${selectedSize}; margin: 0; }`
            : "@page { margin: 10mm; }";
          
          printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>印刷 - ${currentFile?.name || "画像"}</title>
              <style>
                ${pageSizeCSS}
                body { margin: 0; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                img { max-width: 100%; height: auto; }
                @media print {
                  body { padding: 0; margin: 0; }
                  img { max-width: 100%; height: auto; page-break-inside: avoid; }
                }
              </style>
            </head>
            <body>
              <img src="${currentPdf}" alt="${
            currentFile?.name || "画像"
          }" onload="window.print();" />
            </body>
            </html>
          `);
          printWindow.document.close();
        } else {
          alert(
            "ポップアップがブロックされました。ブラウザの設定を確認してください。"
          );
        }
      } else {
        // PDFの場合: 新しいタブで開く
        // 注意: PDFにはViewerPreferences（PrintScaling: None, PickTrayByPDFSize: true）が
        // 埋め込まれているため、プリンタが自動的に正しい用紙サイズを選択する
        const printWindow = window.open(currentPdf, "_blank");
        if (!printWindow) {
          alert(
            "ポップアップがブロックされました。ブラウザの設定を確認してください。"
          );
        }
      }
    }
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.2, 3.0));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.2, 0.5));
  };

  const handleZoomReset = () => {
    setScale(1.0);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {testName ? `${testName} - PDFプレビュー` : "PDFプレビュー"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="閉じる"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* ファイルタブ */}
        {allFiles.length > 1 && (
          <div className="flex gap-2 p-3 border-b border-gray-200 bg-gray-50 overflow-x-auto">
            {allFiles.map((file, index) => (
              <button
                key={index}
                onClick={() => handleTabChange(index)}
                className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                  activeTab === index
                    ? "bg-primary text-white"
                    : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300"
                }`}
              >
                {file.name}
              </button>
            ))}
          </div>
        )}

        {/* ツールバー */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            {/* ページナビゲーション（PDFのみ表示） */}
            {currentFileType === "pdf" && (
              <>
                <button
                  onClick={goToPrevPage}
                  disabled={pageNumber <= 1}
                  className="p-2 text-gray-700 hover:bg-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="前のページ"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <span className="text-sm text-gray-700 min-w-[100px] text-center">
                  {loading ? "読込中..." : `${pageNumber} / ${numPages}`}
                </span>
                <button
                  onClick={goToNextPage}
                  disabled={pageNumber >= numPages}
                  className="p-2 text-gray-700 hover:bg-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="次のページ"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </>
            )}
            {currentFileType === "image" && (
              <span className="text-sm text-gray-700">画像ファイル</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* ズームコントロール */}
            <button
              onClick={handleZoomOut}
              disabled={scale <= 0.5}
              className="p-2 text-gray-700 hover:bg-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="縮小"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"
                />
              </svg>
            </button>
            <span className="text-sm text-gray-700 min-w-[60px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              disabled={scale >= 3.0}
              className="p-2 text-gray-700 hover:bg-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="拡大"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"
                />
              </svg>
            </button>
            <button
              onClick={handleZoomReset}
              className="px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              title="リセット"
            >
              100%
            </button>

            {/* 用紙サイズ選択（PDFファイルで表示） */}
            {testId && currentFileType === "pdf" && (
              <div className="ml-4 border-l border-gray-300 pl-4">
                <select
                  value={selectedSize || ""}
                  onChange={(e) => {
                    const newSize = e.target.value || null;
                    // タブごとにサイズを保存
                    setSizeByTab(prev => ({ ...prev, [activeTab]: newSize }));
                    // サイズ変更時にPDFを再読み込み
                    if (newSize) {
                      setLoading(true);
                      setPdfKey((prev) => prev + 1);
                    }
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">元のサイズ</option>
                  <option value="A3">A3</option>
                  <option value="A4">A4</option>
                  <option value="B4">B4</option>
                  <option value="B5">B5</option>
                </select>
              </div>
            )}

            {/* 印刷ボタン */}
            <div className="ml-4 border-l border-gray-300 pl-4">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                  />
                </svg>
                <span>印刷</span>
              </button>
            </div>
          </div>
        </div>

        {/* コンテンツ表示 */}
        <div className="flex-1 overflow-auto bg-gray-100 flex items-center justify-center p-4">
          {error ? (
            <div className="text-center">
              <svg
                className="w-16 h-16 text-red-400 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-red-600 text-lg">{error}</p>
            </div>
          ) : !currentPdf ? (
            <div className="text-center text-gray-500">
              <p>ファイルが選択されていません</p>
            </div>
          ) : currentFileType === "image" ? (
            // 画像ファイルの表示
            ((() => {
              console.log(
                "🖼️🖼️🖼️ [v3.0] 画像表示モードでレンダリング:",
                currentPdf
              );
              return null;
            })(),
            (
              <div className="bg-white shadow-lg p-4 max-w-full max-h-full overflow-auto">
                <img
                  src={currentPdf}
                  alt={currentFile?.name || "画像"}
                  style={{
                    maxWidth: "100%",
                    height: "auto",
                    transform: `scale(${scale})`,
                    transformOrigin: "center",
                    transition: "transform 0.2s",
                  }}
                  onLoad={(e) => {
                    console.log("✅ 画像読み込み成功:", currentPdf);
                    console.log("画像情報:", {
                      naturalWidth: (e.target as HTMLImageElement).naturalWidth,
                      naturalHeight: (e.target as HTMLImageElement)
                        .naturalHeight,
                      currentSrc: (e.target as HTMLImageElement).currentSrc,
                      complete: (e.target as HTMLImageElement).complete,
                    });
                  }}
                  onError={(e) => {
                    console.error("❌ 画像読み込み失敗:", currentPdf);
                    console.error("画像エラー詳細:", {
                      target: e.target,
                      currentSrc: (e.target as HTMLImageElement).currentSrc,
                      fileName: currentFile?.name,
                      mimeType: currentFile?.mimeType,
                    });
                    setError(
                      `画像の読み込みに失敗しました: ${
                        currentFile?.name || "ファイル名不明"
                      }\nURL: ${currentPdf}`
                    );
                  }}
                />
              </div>
            ))
          ) : !workerReady ? (
            // Worker準備中
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-600">PDF.js初期化中...</p>
              </div>
            </div>
          ) : useFallback ? (
            // Safari 16フォールバックモード: ネイティブPDFビューア
            <div className="bg-white shadow-lg h-full">
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-yellow-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700">
                      お使いのブラウザバージョン(Safari
                      16系)では、PDF.jsの互換性に問題があります。
                      <br />
                      ネイティブPDFビューアに切り替えました。
                    </p>
                  </div>
                </div>
              </div>
              <iframe
                src={currentPdf || ""}
                className="w-full h-[calc(100vh-200px)] border-0"
                title="PDF Viewer"
                style={{ minHeight: "600px" }}
              />
            </div>
          ) : (
            // PDFファイルの表示
            ((() => {
              console.log(
                "🔄🔄🔄 [v3.2-FINAL] PDF表示モードでレンダリング:",
                JSON.stringify(
                  {
                    pdfKey,
                    currentPdf,
                    verbosity: pdfOptions.verbosity,
                    isEvalSupported: pdfOptions.isEvalSupported,
                    workerSrc: pdfjs.GlobalWorkerOptions.workerSrc,
                    workerReady,
                    useFallback,
                  },
                  null,
                  2
                )
              );
              return null;
            })(),
            (
              <div className="bg-white shadow-lg">
                <Document
                  key={pdfKey}
                  file={currentPdf}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={onDocumentLoadError}
                  onLoadStart={() => {
                    console.log(
                      "🚀🚀🚀 [v3.2-FINAL] PDF読み込み開始:",
                      currentPdf
                    );
                    console.log(
                      "🚀🚀🚀 [v3.2-FINAL] Worker URL:",
                      pdfjs.GlobalWorkerOptions.workerSrc
                    );
                    console.log(
                      "🚀🚀🚀 [v3.2-FINAL] Worker Ready:",
                      workerReady
                    );
                  }}
                  onLoadProgress={({ loaded, total }) => {
                    console.log(
                      "⏳⏳⏳ [v3.2-FINAL] PDF読み込み進捗:",
                      JSON.stringify(
                        {
                          loaded,
                          total,
                          percent:
                            total > 0
                              ? ((loaded / total) * 100).toFixed(1) + "%"
                              : "不明",
                        },
                        null,
                        2
                      )
                    );
                  }}
                  onSourceError={(error) => {
                    console.error(
                      "❌❌❌ [v3.2-FINAL] PDF source error:",
                      error
                    );
                    console.error(
                      "❌❌❌ [v3.2-FINAL] ソースエラー詳細:",
                      JSON.stringify(
                        {
                          error: error,
                          message: error?.message,
                          url: currentPdf,
                          workerReady,
                          workerSrc: pdfjs.GlobalWorkerOptions.workerSrc,
                          userAgent:
                            typeof navigator !== "undefined"
                              ? navigator.userAgent
                              : "unknown",
                        },
                        null,
                        2
                      )
                    );
                    setError(
                      "PDFファイルの取得に失敗しました。ネットワーク接続を確認してください。"
                    );
                  }}
                  options={pdfOptions}
                  loading={
                    <div className="flex items-center justify-center p-12">
                      <svg
                        className="animate-spin h-12 w-12 text-primary"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                    </div>
                  }
                >
                  <Page
                    pageNumber={pageNumber}
                    scale={scale}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                  />
                </Document>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
