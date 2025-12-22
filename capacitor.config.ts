import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.yourcompany.testsystem",
  appName: "テスト管理システム",
  webDir: ".next/standalone/public", // Next.jsのビルド出力先

  // 開発環境: ローカルネットワークのNext.jsサーバーに接続
  server: {
    url: "http://192.168.1.64:3000", // あなたのローカルIPに変更
    cleartext: true, // HTTP通信を許可
    androidScheme: "http",
  },

  android: {
    allowMixedContent: true, // HTTP/HTTPS混在を許可
    buildOptions: {
      keystorePath: undefined, // リリースビルド時に設定
      keystorePassword: undefined,
      keystoreAlias: undefined,
      keystoreAliasPassword: undefined,
    },
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#ffffff",
      showSpinner: true,
      spinnerColor: "#3b82f6",
    },
  },
};

export default config;
