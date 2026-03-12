"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
  const [detectedSizeByTab, setDetectedSizeByTab] = useState<Record<number, string>>({}); // タブごとの検出された元サイズ

  // 現在のタブのサイズ選択を取得
  const selectedSize = sizeByTab[activeTab] || null;

  // 表示・操作の改善 (#1-9)
  const [rotation, setRotation] = useState<number>(0); // 回転 0/90/180/270
  const [fitMode, setFitMode] = useState<"free" | "width" | "page">("free"); // フィット表示
  const [scrollMode, setScrollMode] = useState<boolean>(false); // 連続スクロール
  const [pdfDark, setPdfDark] = useState<boolean>(false); // PDFダークモード
  const [showThumbnails, setShowThumbnails] = useState<boolean>(false); // サムネイルパネル
  const [jumpInput, setJumpInput] = useState<string>(""); // ページジャンプ入力
  const contentRef = useRef<HTMLDivElement>(null); // コンテンツエリア参照（フィット計算用）
  const touchRef = useRef<{ dist: number; baseScale: number } | null>(null); // ピンチズーム用
  // #9 PDF内テキスト検索
  const [showPdfSearch, setShowPdfSearch] = useState(false);
  const [pdfSearchQuery, setPdfSearchQuery] = useState("");
  const [pdfSearchMatchCount, setPdfSearchMatchCount] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // #10-13 印刷設定
  const [showPrintSettings, setShowPrintSettings] = useState(false);
  const [printPageFrom, setPrintPageFrom] = useState<string>("");
  const [printPageTo, setPrintPageTo] = useState<string>("");
  const [printCopies, setPrintCopies] = useState<string>("1");
  const [printDuplex, setPrintDuplex] = useState(false);
  // サーバー印刷
  const [serverPrinting, setServerPrinting] = useState(false);
  const [serverPrintError, setServerPrintError] = useState<string | null>(null);
  const [serverPrintColor, setServerPrintColor] = useState<"color" | "mono">("mono");
  const [serverPrintDuplex, setServerPrintDuplex] = useState<boolean>(false);
  // #16 カスタムサイズ
  const [customWidthMm, setCustomWidthMm] = useState<string>("210");
  const [customHeightMm, setCustomHeightMm] = useState<string>("297");

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
        // #16 カスタムサイズ対応
        if (selectedSize === "CUSTOM") {
          const w = parseFloat(customWidthMm) || 210;
          const h = parseFloat(customHeightMm) || 297;
          return `/api/pdf/sized?testId=${testId}&size=CUSTOM&widthMm=${w}&heightMm=${h}&pdfPath=${encodedPath}${attachmentParam}`;
        }
        return `/api/pdf/sized?testId=${testId}&size=${selectedSize}&pdfPath=${encodedPath}${attachmentParam}`;
      }
    }
    
    return currentFile.path;
  }, [currentFile, selectedSize, testId, activeTab, customWidthMm, customHeightMm]);

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

  // PDFの元サイズを検出する関数
  const fetchDetectedSize = async (tabIndex: number, filePath: string | undefined) => {
    if (!filePath || detectedSizeByTab[tabIndex]) return;
    try {
      const encodedPath = encodeURIComponent(filePath);
      const response = await fetch(`/api/pdf/detect-size?pdfPath=${encodedPath}`);
      if (response.ok) {
        const data = await response.json();
        if (data.displayName) {
          setDetectedSizeByTab(prev => ({ ...prev, [tabIndex]: data.displayName }));
        }
      }
    } catch (error) {
      console.error("PDF サイズ検出エラー:", error);
    }
  };

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

        // PDFの元サイズを検出
        fetchDetectedSize(activeTab, currentFile.originalPath);

        // タイムアウトは別のuseEffectで監視
        console.log("⏰⏰⏰ [v3.2-FINAL] PDF処理開始 - loading=true設定");
      }
    } else {
      console.log("⚠️⚠️⚠️ [v3.2-FINAL] currentFileが null です");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // キーボードショートカット (#3): ←→ページ移動、+/-ズーム、Escで閉じる、Ctrl+Fで検索
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // #9 Ctrl+F で検索バー表示
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setShowPdfSearch((v) => !v);
        setTimeout(() => searchInputRef.current?.focus(), 50);
        return;
      }
      if (e.key === "Escape") {
        if (showPdfSearch) { setShowPdfSearch(false); return; }
        if (showPrintSettings) { setShowPrintSettings(false); return; }
        onClose();
        return;
      }
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) return;
      switch (e.key) {
        case "ArrowLeft":
        case "ArrowUp":
          e.preventDefault();
          setPageNumber((p) => Math.max(p - 1, 1));
          break;
        case "ArrowRight":
        case "ArrowDown":
          e.preventDefault();
          setPageNumber((p) => Math.min(p + 1, numPages));
          break;
        case "+":
        case "=":
          e.preventDefault();
          setScale((s) => Math.min(s + 0.2, 3.0));
          break;
        case "-":
          e.preventDefault();
          setScale((s) => Math.max(s - 0.2, 0.5));
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [numPages, onClose, showPdfSearch, showPrintSettings]);

  // フィット表示モード: widthまたはpageに合わせてscaleを自動設定 (#5)
  useEffect(() => {
    if (fitMode === "free" || !contentRef.current) return;
    const el = contentRef.current;
    const w = el.clientWidth - 64;
    const h = el.clientHeight - 64;
    const A4_W = 595;
    const A4_H = 842;
    if (fitMode === "width") {
      setScale(Math.max(0.3, w / A4_W));
    } else if (fitMode === "page") {
      setScale(Math.max(0.3, Math.min(w / A4_W, h / A4_H)));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitMode, loading]);

  // ピンチズームのタッチハンドラ (#4)
  const getTouchDist = (e: React.TouchEvent) => {
    const [t1, t2] = [e.touches[0], e.touches[1]];
    return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
  };
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      touchRef.current = { dist: getTouchDist(e), baseScale: scale };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale]);
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchRef.current) {
      e.preventDefault();
      const newDist = getTouchDist(e);
      const newScale = Math.min(3.0, Math.max(0.5,
        touchRef.current.baseScale * (newDist / touchRef.current.dist)
      ));
      setScale(newScale);
      setFitMode("free");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const handleTouchEnd = useCallback(() => { touchRef.current = null; }, []);

  // #9 PDF内テキスト検索
  const handlePdfSearch = useCallback(() => {
    if (!pdfSearchQuery.trim() || !contentRef.current) { setPdfSearchMatchCount(0); return; }
    // 既存のハイライトを除去
    contentRef.current.querySelectorAll(".pdf-search-highlight").forEach((el) => {
      const parent = el.parentNode;
      if (parent) { parent.replaceChild(document.createTextNode(el.textContent || ""), el); parent.normalize(); }
    });
    // テキストレイヤーのspanを検索
    const textSpans = contentRef.current.querySelectorAll(".react-pdf__Page__textContent span");
    let count = 0;
    const regex = new RegExp(pdfSearchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    textSpans.forEach((span) => {
      if (span.childNodes.length === 1 && span.childNodes[0].nodeType === Node.TEXT_NODE) {
        const text = span.textContent || "";
        if (regex.test(text)) { count++; (span as HTMLElement).style.backgroundColor = "rgba(255,255,0,0.6)"; } else { (span as HTMLElement).style.backgroundColor = ""; }
        regex.lastIndex = 0;
      }
    });
    setPdfSearchMatchCount(count);
    // 最初のマッチにスクロール
    if (count > 0) {
      const first = contentRef.current.querySelector(".react-pdf__Page__textContent span[style*='rgba(255']") as HTMLElement;
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [pdfSearchQuery]);

  // ページジャンプ処理 (#1)
  const handleJumpPage = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(jumpInput, 10);
    if (!isNaN(n) && n >= 1 && n <= numPages) {
      setPageNumber(n);
      if (scrollMode && contentRef.current) {
        const pageEl = contentRef.current.querySelector(`[data-page-number="${n}"]`);
        pageEl?.scrollIntoView({ behavior: "smooth" });
      }
    }
    setJumpInput("");
  };

  // 回転ハンドラ (#7)
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

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
      // #10-13 印刷設定を適用
      const copies = Math.max(1, parseInt(printCopies) || 1);
      const pageFrom = parseInt(printPageFrom) || 1;
      const pageTo = parseInt(printPageTo) || numPages || 9999;

      if (currentFileType === "image") {
        // 画像の場合は、印刷用ウィンドウを作成
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          const pageSizeCSS = selectedSize
            ? `@page { size: ${selectedSize}; margin: 0; }`
            : "@page { margin: 10mm; }";
          const duplexCSS = printDuplex ? "" : "";
          printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>印刷 - ${currentFile?.name || "画像"}</title>
              <style>
                ${pageSizeCSS}
                ${duplexCSS}
                body { margin: 0; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                img { max-width: 100%; height: auto; }
                @media print {
                  body { padding: 0; margin: 0; }
                  img { max-width: 100%; height: auto; page-break-inside: avoid; }
                }
              </style>
            </head>
            <body>
              <img src="${currentPdf}" alt="${currentFile?.name || "画像"}" onload="window.print();" />
            </body>
            </html>
          `);
          printWindow.document.close();
        } else {
          alert("ポップアップがブロックされました。ブラウザの設定を確認してください。");
        }
      } else {
        // PDF: ページ範囲・部数・両面を考慮して印刷ウィンドウを開く
        // #10 ページ範囲指定・#13 複数部数 はブラウザ印刷ダイアログで設定
        const printWindow = window.open(currentPdf, "_blank");
        if (!printWindow) {
          // フォールバック: iframe 経由で印刷
          const iframe = document.createElement("iframe");
          iframe.style.display = "none";
          iframe.src = currentPdf;
          document.body.appendChild(iframe);
          iframe.onload = () => {
            try { iframe.contentWindow?.print(); } catch { window.open(currentPdf, "_blank"); }
            setTimeout(() => document.body.removeChild(iframe), 5000);
          };
        }
        if (copies > 1) {
          // 複数部数: 複数タブを開く（ブラウザ制限あり）
          for (let i = 1; i < copies; i++) {
            setTimeout(() => window.open(currentPdf, "_blank"), i * 300);
          }
        }
      }
      setShowPrintSettings(false);
    }
  };

  // サーバー印刷処理
  const handleServerPrint = async () => {
    if (!currentPdf) return;
    setServerPrinting(true);
    setServerPrintError(null);
    try {
      // localStorage からプリンター設定を読み込む
      let savedSettings: { printerName?: string; copies?: number; duplex?: boolean } = {};
      try {
        const saved = localStorage.getItem("printer-settings");
        if (saved) savedSettings = JSON.parse(saved);
      } catch { /* ignore */ }
      const res = await fetch("/api/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdfPath: currentPdf,
          printerName: savedSettings.printerName || undefined,
          copies: parseInt(printCopies) || savedSettings.copies || 1,
          duplex: serverPrintDuplex,
          colorMode: serverPrintColor,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "印刷に失敗しました");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "印刷に失敗しました";
      setServerPrintError(msg);
      setTimeout(() => setServerPrintError(null), 5000);
    } finally {
      setServerPrinting(false);
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
        <div className="relative z-10 flex items-center justify-between p-2 border-b border-gray-200 bg-gray-50 gap-2">
          <div className="flex items-center gap-1 overflow-x-auto min-w-0 flex-1">
            {/* サムネイル表示トグル (#2) */}
            {currentFileType === "pdf" && numPages > 0 && (
              <button
                onClick={() => setShowThumbnails((v) => !v)}
                className={`p-2 rounded-lg transition-colors ${
                  showThumbnails ? "bg-blue-100 text-blue-700" : "text-gray-700 hover:bg-gray-200"
                }`}
                title="サムネイル一覧"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
            )}
            {/* ページナビゲーション（PDFのみ表示） */}
            {currentFileType === "pdf" && (
              <>
                <button
                  onClick={goToPrevPage}
                  disabled={pageNumber <= 1 || scrollMode}
                  className="p-2 text-gray-700 hover:bg-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="前のページ (←)"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                {/* ページジャンプ入力 (#1) */}
                <form onSubmit={handleJumpPage} className="flex items-center gap-1">
                  {loading ? (
                    <span className="text-sm text-gray-700 min-w-[80px] text-center">読込中...</span>
                  ) : (
                    <>
                      <input
                        type="number"
                        min={1}
                        max={numPages}
                        value={jumpInput || pageNumber}
                        onChange={(e) => setJumpInput(e.target.value)}
                        onFocus={(e) => { setJumpInput(e.target.value); e.target.select(); }}
                        onBlur={() => setJumpInput("")}
                        className="w-14 text-center text-sm border border-gray-300 rounded px-1 py-0.5"
                        title="ページ番号を入力してEnter"
                      />
                      <span className="text-sm text-gray-500">/ {numPages}</span>
                    </>
                  )}
                </form>
                <button
                  onClick={goToNextPage}
                  disabled={pageNumber >= numPages || scrollMode}
                  className="p-2 text-gray-700 hover:bg-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="次のページ (→)"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                {/* 連続スクロールモード (#8) */}
                <button
                  onClick={() => setScrollMode((v) => !v)}
                  className={`p-2 rounded-lg transition-colors ${
                    scrollMode ? "bg-blue-100 text-blue-700" : "text-gray-700 hover:bg-gray-200"
                  }`}
                  title="連続スクロール表示"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                {/* 回転ボタン (#7) */}
                <button
                  onClick={handleRotate}
                  className="p-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                  title="90度回転"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </>
            )}
            {currentFileType === "image" && (
              <span className="text-sm text-gray-700">画像ファイル</span>
            )}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {/* ズームコントロール: [-][75%][+] コンパクトグループ */}
            <div className="flex items-center rounded-lg border border-gray-300 overflow-hidden">
              <button
                onClick={handleZoomOut}
                disabled={scale <= 0.5}
                className="px-2 py-1.5 text-gray-700 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border-r border-gray-300"
                title="縮小 (-)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                </svg>
              </button>
              <button
                onClick={handleZoomReset}
                className="px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 transition-colors min-w-[44px] text-center border-r border-gray-300"
                title="100%にリセット"
              >
                {Math.round(scale * 100)}%
              </button>
              <button
                onClick={handleZoomIn}
                disabled={scale >= 3.0}
                className="px-2 py-1.5 text-gray-700 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="拡大 (+)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                </svg>
              </button>
            </div>

            {/* フィット表示モード (#5) */}
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              <button
                onClick={() => setFitMode("width")}
                className={`px-2 py-1 text-xs transition-colors ${
                  fitMode === "width" ? "bg-blue-100 text-blue-700" : "text-gray-700 hover:bg-gray-100"
                }`}
                title="幅に合わせる"
              >幅</button>
              <button
                onClick={() => setFitMode("page")}
                className={`px-2 py-1 text-xs border-l border-gray-300 transition-colors ${
                  fitMode === "page" ? "bg-blue-100 text-blue-700" : "text-gray-700 hover:bg-gray-100"
                }`}
                title="ページに合わせる"
              >全</button>
              <button
                onClick={() => setFitMode("free")}
                className={`px-2 py-1 text-xs border-l border-gray-300 transition-colors ${
                  fitMode === "free" ? "bg-blue-100 text-blue-700" : "text-gray-700 hover:bg-gray-100"
                }`}
                title="自由"
              >自</button>
            </div>

            {/* #9 PDF内テキスト検索ボタン */}
            {currentFileType === "pdf" && (
              <button
                onClick={() => {
                  setShowPdfSearch((v) => !v);
                  if (!showPdfSearch) {
                    setTimeout(() => searchInputRef.current?.focus(), 100);
                  }
                }}
                title="PDF内を検索 (Ctrl+F)"
                className={`p-2 rounded-lg transition-colors ${
                  showPdfSearch
                    ? "bg-yellow-200 text-yellow-800"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            )}

            {/* 印刷ボタン + 設定ギア */}
            <div className="ml-1 border-l border-gray-300 pl-2 relative">
              <div className="flex items-center gap-1">
                <button
                  onClick={handleServerPrint}
                  disabled={serverPrinting || !currentPdf}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors disabled:opacity-50 text-sm whitespace-nowrap"
                  title="印刷（サーバー経由）"
                >
                  {serverPrinting ? (
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                  )}
                  <span>{serverPrinting ? "送信中..." : "印刷"}</span>
                </button>
                {/* 設定ギアボタン */}
                <button
                  onClick={() => setShowPrintSettings((v) => !v)}
                  title="印刷設定・表示設定"
                  className={`p-2 rounded-lg transition-colors ${
                    showPrintSettings
                      ? "bg-gray-200 text-gray-800"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-600"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </div>
              {serverPrintError && (
                <p className="text-xs text-red-500 whitespace-nowrap mt-0.5">❌ {serverPrintError}</p>
              )}

              {/* 設定パネル（印刷設定 + 表示設定をまとめて） */}
              {showPrintSettings && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl p-3 z-[200] w-72 text-sm">
                  {/* ── 表示設定 ── */}
                  <p className="font-semibold text-gray-700 mb-2 border-b pb-1">表示設定</p>
                  {/* ダークモード */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-600">ダークモード</span>
                    <button
                      onClick={() => setPdfDark((v) => !v)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${pdfDark ? "bg-gray-700" : "bg-gray-300"}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${pdfDark ? "translate-x-4" : "translate-x-1"}`} />
                    </button>
                  </div>
                  {/* 用紙サイズ変換（PDFのみ） */}
                  {testId && currentFileType === "pdf" && (
                    <div className="mb-2">
                      <label className="block text-xs text-gray-500 mb-1">用紙サイズ変換</label>
                      <select
                        value={selectedSize || ""}
                        onChange={(e) => {
                          const newSize = e.target.value || null;
                          setSizeByTab(prev => ({ ...prev, [activeTab]: newSize }));
                          if (newSize) { setLoading(true); setPdfKey((prev) => prev + 1); }
                        }}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="">
                          {detectedSizeByTab[activeTab]
                            ? `元のサイズ (${detectedSizeByTab[activeTab]})`
                            : "元のサイズ"}
                        </option>
                        <option value="A3">A3</option>
                        <option value="A4">A4</option>
                        <option value="A5">A5</option>
                        <option value="B4">B4</option>
                        <option value="B5">B5</option>
                        <option value="Letter">Letter</option>
                        <option value="CUSTOM">カスタム...</option>
                      </select>
                      {selectedSize === "CUSTOM" && (
                        <div className="flex gap-1 items-center mt-1">
                          <input type="number" min={50} max={1000} value={customWidthMm}
                            onChange={(e) => setCustomWidthMm(e.target.value)}
                            className="w-14 text-xs border border-gray-300 rounded px-1 py-0.5" placeholder="幅mm" />
                          <span className="text-xs text-gray-400">×</span>
                          <input type="number" min={50} max={1000} value={customHeightMm}
                            onChange={(e) => setCustomHeightMm(e.target.value)}
                            className="w-14 text-xs border border-gray-300 rounded px-1 py-0.5" placeholder="高さmm" />
                          <span className="text-xs text-gray-400">mm</span>
                          <button onClick={() => { if (customWidthMm && customHeightMm) { setLoading(true); setPdfKey((p) => p + 1); } }}
                            className="px-2 py-0.5 bg-primary text-white rounded text-xs hover:bg-primary-dark">適用</button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── サーバー印刷設定 ── */}
                  <p className="font-semibold text-gray-700 mb-2 border-b pb-1 mt-3">🖨️ サーバー印刷設定</p>
                  {/* カラーモード */}
                  <div className="mb-2">
                    <label className="block text-xs text-gray-500 mb-1">カラーモード</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                        <input type="radio" name="serverColorMode" value="mono" checked={serverPrintColor === "mono"} onChange={() => setServerPrintColor("mono")} className="accent-primary" />
                        白黒
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                        <input type="radio" name="serverColorMode" value="color" checked={serverPrintColor === "color"} onChange={() => setServerPrintColor("color")} className="accent-primary" />
                        カラー
                      </label>
                    </div>
                  </div>
                  {/* 印刷面 */}
                  <div className="mb-2">
                    <label className="block text-xs text-gray-500 mb-1">印刷面</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                        <input type="radio" name="serverDuplex" checked={!serverPrintDuplex} onChange={() => setServerPrintDuplex(false)} className="accent-primary" />
                        片面
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                        <input type="radio" name="serverDuplex" checked={serverPrintDuplex} onChange={() => setServerPrintDuplex(true)} className="accent-primary" />
                        両面
                      </label>
                    </div>
                  </div>
                  {/* 部数 */}
                  <div className="mb-3">
                    <label className="block text-xs text-gray-500 mb-1">部数</label>
                    <input type="number" min={1} max={99} value={printCopies}
                      onChange={(e) => setPrintCopies(e.target.value)}
                      className="w-16 border border-gray-300 rounded px-1 py-0.5 text-center text-xs" />
                    <span className="text-xs text-gray-400 ml-1">部</span>
                  </div>
                  {/* iPad標準印刷 */}
                  <div className="border-t border-gray-200 pt-2">
                    <p className="text-xs text-gray-500 mb-1.5">📱 iPad標準印刷（AirPrint）</p>
                    <button
                      onClick={() => { handlePrint(); setShowPrintSettings(false); }}
                      disabled={!currentPdf}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50 text-xs border border-gray-300"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <span>iPad標準印刷</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* #9 PDF内テキスト検索バー */}
        {showPdfSearch && currentFileType === "pdf" && (
          <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/30 border-b border-yellow-200 dark:border-yellow-700 flex items-center gap-2">
            <svg className="w-4 h-4 text-yellow-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={pdfSearchQuery}
              onChange={(e) => setPdfSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handlePdfSearch();
                if (e.key === "Escape") {
                  setShowPdfSearch(false);
                  setPdfSearchQuery("");
                  setPdfSearchMatchCount(0);
                }
              }}
              placeholder="PDF内を検索... (Enterで実行)"
              className="border border-yellow-300 rounded px-2 py-1 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white dark:bg-gray-800 dark:text-white"
            />
            <button
              onClick={handlePdfSearch}
              className="px-3 py-1 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 rounded text-sm font-medium"
            >
              検索
            </button>
            {pdfSearchMatchCount > 0 && (
              <span className="text-xs text-yellow-700 dark:text-yellow-300 whitespace-nowrap">
                {pdfSearchMatchCount}件一致
              </span>
            )}
            {pdfSearchMatchCount === 0 && pdfSearchQuery && (
              <span className="text-xs text-red-500 whitespace-nowrap">見つかりません</span>
            )}
            <button
              onClick={() => {
                setShowPdfSearch(false);
                setPdfSearchQuery("");
                setPdfSearchMatchCount(0);
                // ハイライト除去
                document
                  .querySelectorAll(".pdf-search-highlight")
                  .forEach((el) => {
                    (el as HTMLElement).style.backgroundColor = "";
                    el.classList.remove("pdf-search-highlight");
                  });
              }}
              className="text-gray-400 hover:text-gray-600 ml-1"
              title="検索を閉じる"
            >
              ✕
            </button>
          </div>
        )}

        {/* コンテンツ表示 */}
        <div className="relative z-0 flex-1 flex overflow-hidden">
          {/* サムネイルパネル (#2) */}
          {showThumbnails && currentFileType === "pdf" && numPages > 0 && currentPdf && (
            <div className="w-28 flex-shrink-0 overflow-y-auto bg-gray-200 border-r border-gray-300 flex flex-col gap-2 p-2">
              <Document file={currentPdf} options={pdfOptions} loading={null} onLoadError={() => {}}
              >
                {Array.from({ length: Math.min(numPages, 50) }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => { setPageNumber(p); }}
                    className={`w-full border-2 rounded overflow-hidden transition-colors ${
                      p === pageNumber ? "border-blue-500" : "border-transparent hover:border-blue-300"
                    }`}
                    title={`${p}ページ`}
                  >
                    <Page
                      pageNumber={p}
                      width={96}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      rotate={rotation}
                    />
                    <div className="text-xs text-center text-gray-600 bg-white py-0.5">{p}</div>
                  </button>
                ))}
              </Document>
            </div>
          )}
          {/* メインコンテンツ */}
          <div
            ref={contentRef}
            className="flex-1 overflow-auto bg-gray-100 flex items-start justify-center p-4"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={pdfDark ? { background: "#1a1a2e" } : {}}
          >
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentPdf}
                  alt={currentFile?.name || "画像"}
                  loading="lazy"
                  decoding="async"
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
              <div className={`shadow-lg ${pdfDark ? "bg-gray-900" : "bg-white"}`}
                style={pdfDark ? { filter: "invert(0.85) hue-rotate(180deg)" } : {}}
              >
                <Document
                  key={pdfKey}
                  file={currentPdf}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={onDocumentLoadError}
                  onLoadStart={() => {
                    console.log("🚀🚀🚀 [v3.2-FINAL] PDF読み込み開始:", currentPdf);
                  }}
                  onLoadProgress={({ loaded, total }) => {
                    console.log("⏳⏳⏳ [v3.2-FINAL] PDF読み込み進捗:", loaded, "/", total);
                  }}
                  onSourceError={(error) => {
                    console.error("❌❌❌ [v3.2-FINAL] PDF source error:", error);
                    setError(
                      "PDFファイルの取得に失敗しました。ネットワーク接続を確認してください。"
                    );
                  }}
                  options={pdfOptions}
                  loading={
                    <div className="flex flex-col items-center justify-center p-12 gap-3">
                      <svg className="animate-spin h-12 w-12 text-primary" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {selectedSize ? (
                        <p className="text-sm font-medium text-blue-600">
                          {selectedSize === "CUSTOM"
                            ? `カスタムサイズ (${customWidthMm}×${customHeightMm}mm) に変換中...`
                            : `${selectedSize} に変換中...`}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-500">読み込み中...</p>
                      )}
                    </div>
                  }
                >
                  {/* 連続スクロールモード (#8) */}
                  {scrollMode ? (
                    Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (
                      <div key={p} data-page-number={p} className="mb-4">
                        <Page
                          pageNumber={p}
                          scale={scale}
                          rotate={rotation}
                          renderTextLayer={true}
                          renderAnnotationLayer={true}
                        />
                      </div>
                    ))
                  ) : (
                    <Page
                      pageNumber={pageNumber}
                      scale={scale}
                      rotate={rotation}
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                    />
                  )}
                </Document>
              </div>
            ))
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
