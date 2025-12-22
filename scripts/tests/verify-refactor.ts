import { folderRepository } from "../../lib/repositories/folderRepository";
import { testRepository } from "../../lib/repositories/testRepository";
import { backupService } from "../../lib/services/backupService";
import db from "../../lib/database";

async function runTests() {
  console.log("=== リファクタリング検証テスト開始 ===");

  try {
    // 1. フォルダRepositoryのテスト
    console.log("\n--- FolderRepository Test ---");
    const folderName = `Test Folder ${Date.now()}`;
    console.log(`Creating folder: ${folderName}`);
    const newFolder = folderRepository.create(folderName, null);
    console.log("Created folder:", newFolder);

    if (!newFolder.id) throw new Error("Folder creation failed");

    const fetchedFolder = folderRepository.getById(newFolder.id);
    console.log("Fetched folder:", fetchedFolder);
    if (!fetchedFolder || fetchedFolder.name !== folderName) {
      throw new Error("Folder fetch failed or name mismatch");
    }

    const updatedName = `${folderName} Updated`;
    console.log(`Updating folder to: ${updatedName}`);
    const updatedFolder = folderRepository.update(newFolder.id, updatedName, null);
    console.log("Updated folder:", updatedFolder);
    if (updatedFolder.name !== updatedName) {
      throw new Error("Folder update failed");
    }

    // 1.5 タグRepositoryのテスト
    console.log("\n--- TagRepository Test ---");
    const tagName = `Test Tag ${Date.now()}`;
    console.log(`Creating tag: ${tagName}`);
    const newTag = await import("../../lib/repositories/tagRepository").then(m => m.tagRepository.create(tagName, "#ff0000"));
    console.log("Created tag:", newTag);
    if (!newTag.id) throw new Error("Tag creation failed");

    // 2. テストRepositoryのテスト
    console.log("\n--- TestRepository Test ---");
    const testData = {
      name: "Refactor Test",
      subject: "Math",
      grade: "High School",
      folderId: newFolder.id,
      description: "Test created by verification script",
      totalQuestions: 10,
      totalScore: 100,
      pdfPath: "/uploads/pdfs/dummy.pdf",
    };
    console.log("Creating test:", testData);
    const newTest = testRepository.create(testData);
    console.log("Created test:", newTest);

    if (!newTest || !newTest.id) throw new Error("Test creation failed");

    const fetchedTest = testRepository.getById(newTest.id);
    console.log("Fetched test:", fetchedTest);
    if (!fetchedTest || fetchedTest.name !== testData.name) {
      throw new Error("Test fetch failed");
    }

    // 3. バックアップServiceのテスト (簡易)
    console.log("\n--- BackupService Test ---");
    console.log("Creating downloadable backup...");
    const backup = backupService.createDownloadableBackup();
    console.log("Backup created:", {
      filename: backup.filename,
      size: backup.buffer.length,
    });
    if (!backup.buffer || backup.buffer.length === 0) {
      throw new Error("Backup creation failed");
    }

    // 4. クリーンアップ
    console.log("\n--- Cleanup ---");
    console.log("Deleting test...");
    // testRepository.delete(newTest.id); // delete method might not exist or I need to check
    db.prepare("DELETE FROM tests WHERE id = ?").run(newTest.id);
    
    console.log("Deleting folder...");
    folderRepository.delete(newFolder.id);
    
    const deletedFolder = folderRepository.getById(newFolder.id);
    if (deletedFolder) throw new Error("Folder deletion failed");
    console.log("Cleanup complete");

    console.log("\n✅ すべてのテストが成功しました！");
  } catch (error) {
    console.error("\n❌ テスト失敗:", error);
    process.exit(1);
  }
}

runTests();
