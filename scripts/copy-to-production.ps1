# 本番環境へファイルをコピーするスクリプト
# 開発環境で実行してください

# 本番環境のパス(必要に応じて変更)
$destination = "C:\Users\管理者ユーザー\Desktop\testproject\"

Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "📦 本番環境へマイグレーションファイルをコピー" -ForegroundColor Yellow
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

# コピーするファイルリスト
$files = @(
    # マイグレーションスクリプト(必須)
    "scripts/migration/migrate-folder-unique-constraint.mjs",
    "scripts/migration/fix-tests-foreign-key.mjs",
    "scripts/migration/fix-test-folders-foreign-key.mjs",
    "scripts/migration/fix-test-tags-foreign-key.mjs",
    "scripts/migration/fix-test-attachments-foreign-key.mjs",
    
    # 補助スクリプト
    "scripts/migration/run-all-migrations.mjs",
    "scripts/migration/verify-migration.mjs",
    "scripts/migration/check-migration-status.mjs",
    
    # ドキュメント
    "docs/reports/PRODUCTION_MIGRATION_TROUBLESHOOT.md",
    "docs/PRODUCTION_QUICK_GUIDE.md"
)

Write-Host "コピー先: $destination" -ForegroundColor White
Write-Host ""

$successCount = 0
$errorCount = 0

foreach ($file in $files) {
    if (Test-Path $file) {
        try {
            Copy-Item $file $destination -Force
            Write-Host "✓" -NoNewline -ForegroundColor Green
            Write-Host " $file" -ForegroundColor White
            $successCount++
        } catch {
            Write-Host "✗" -NoNewline -ForegroundColor Red
            Write-Host " $file - エラー: $_" -ForegroundColor Red
            $errorCount++
        }
    } else {
        Write-Host "⚠" -NoNewline -ForegroundColor Yellow
        Write-Host " $file - ファイルが見つかりません" -ForegroundColor Yellow
        $errorCount++
    }
}

Write-Host ""
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "完了: " -NoNewline -ForegroundColor White
Write-Host "$successCount" -NoNewline -ForegroundColor Green
Write-Host " / " -NoNewline -ForegroundColor White
Write-Host "$($files.Count)" -NoNewline -ForegroundColor White
Write-Host " ファイル" -ForegroundColor White

if ($errorCount -gt 0) {
    Write-Host "エラー: " -NoNewline -ForegroundColor Red
    Write-Host "$errorCount" -NoNewline -ForegroundColor Red
    Write-Host " ファイル" -ForegroundColor Red
}

Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

if ($successCount -eq $files.Count) {
    Write-Host "✅ すべてのファイルをコピーしました!" -ForegroundColor Green
    Write-Host ""
    Write-Host "次のステップ:" -ForegroundColor Yellow
    Write-Host "  1. 本番環境のディレクトリに移動" -ForegroundColor White
    Write-Host "     cd $destination" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  2. マイグレーション実行ガイドを確認" -ForegroundColor White
    Write-Host "     notepad PRODUCTION_QUICK_GUIDE.md" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  3. マイグレーションを実行" -ForegroundColor White
    Write-Host "     node run-all-migrations.mjs" -ForegroundColor Cyan
} else {
    Write-Host "⚠️ いくつかのファイルをコピーできませんでした" -ForegroundColor Yellow
    Write-Host "   不足しているファイルを確認してください" -ForegroundColor White
}

Write-Host ""
