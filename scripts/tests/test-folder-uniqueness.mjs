/**
 * フォルダの同名チェック機能テスト
 *
 * テスト内容:
 * 1. 同じ親フォルダ内での同名フォルダ作成 → エラー
 * 2. 異なる親フォルダでの同名フォルダ作成 → 成功
 * 3. 親フォルダなし(null)での同名フォルダ作成 → エラー
 */

const BASE_URL = "http://localhost:3000";

async function testFolderNameUniqueness() {
  console.log("🧪 フォルダ同名チェック機能テスト");
  console.log("=".repeat(50));

  let testsPassed = 0;
  let testsFailed = 0;

  // テスト1: 同じ親フォルダ内での同名フォルダ作成 → エラー
  console.log("\n[テスト1] 同じ親フォルダ内での同名フォルダ作成");
  try {
    // まず親フォルダを作成
    const parentResponse = await fetch(`${BASE_URL}/api/folders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "テスト親フォルダ_" + Date.now() }),
    });
    const parent = await parentResponse.json();
    console.log(`   親フォルダ作成: ${parent.name} (ID: ${parent.id})`);

    // 子フォルダ1を作成
    const child1Response = await fetch(`${BASE_URL}/api/folders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "同名子フォルダ",
        parentId: parent.id,
      }),
    });
    const child1 = await child1Response.json();
    console.log(`   子フォルダ1作成成功: ${child1.name}`);

    // 同じ親の下に同名フォルダを作成しようとする → エラーになるべき
    const child2Response = await fetch(`${BASE_URL}/api/folders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "同名子フォルダ",
        parentId: parent.id,
      }),
    });

    if (child2Response.status === 400) {
      const error = await child2Response.json();
      console.log(`   ✅ 期待通りエラー: ${error.error}`);
      testsPassed++;
    } else {
      console.log(`   ❌ 失敗: 同名フォルダが作成できてしまった`);
      testsFailed++;
    }
  } catch (error) {
    console.log(`   ❌ エラー: ${error.message}`);
    testsFailed++;
  }

  // テスト2: 異なる親フォルダでの同名フォルダ作成 → 成功
  console.log("\n[テスト2] 異なる親フォルダでの同名フォルダ作成");
  try {
    // 親フォルダA作成
    const parentAResponse = await fetch(`${BASE_URL}/api/folders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "親フォルダA_" + Date.now() }),
    });
    const parentA = await parentAResponse.json();
    console.log(`   親フォルダA作成: ${parentA.name} (ID: ${parentA.id})`);

    // 親フォルダB作成
    const parentBResponse = await fetch(`${BASE_URL}/api/folders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "親フォルダB_" + Date.now() }),
    });
    const parentB = await parentBResponse.json();
    console.log(`   親フォルダB作成: ${parentB.name} (ID: ${parentB.id})`);

    // 親AとBの下に同名フォルダを作成
    const testName = "共通フォルダ名";

    const childAResponse = await fetch(`${BASE_URL}/api/folders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: testName, parentId: parentA.id }),
    });
    const childA = await childAResponse.json();

    const childBResponse = await fetch(`${BASE_URL}/api/folders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: testName, parentId: parentB.id }),
    });
    const childB = await childBResponse.json();

    if (childAResponse.status === 201 && childBResponse.status === 201) {
      console.log(
        `   ✅ 成功: 親フォルダAに「${testName}」作成 (ID: ${childA.id})`
      );
      console.log(
        `   ✅ 成功: 親フォルダBに「${testName}」作成 (ID: ${childB.id})`
      );
      testsPassed++;
    } else {
      console.log(`   ❌ 失敗: 異なる親での同名フォルダが作成できなかった`);
      testsFailed++;
    }
  } catch (error) {
    console.log(`   ❌ エラー: ${error.message}`);
    testsFailed++;
  }

  // テスト3: 親フォルダなし(null)での同名フォルダ作成 → エラー
  console.log("\n[テスト3] ルート階層での同名フォルダ作成");
  try {
    const name = "ルートフォルダ_" + Date.now();

    // ルート階層にフォルダ作成
    const folder1Response = await fetch(`${BASE_URL}/api/folders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const folder1 = await folder1Response.json();
    console.log(`   フォルダ1作成成功: ${folder1.name} (ID: ${folder1.id})`);

    // 同じ名前でもう一度作成しようとする → エラーになるべき
    const folder2Response = await fetch(`${BASE_URL}/api/folders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (folder2Response.status === 400) {
      const error = await folder2Response.json();
      console.log(`   ✅ 期待通りエラー: ${error.error}`);
      testsPassed++;
    } else {
      console.log(`   ❌ 失敗: 同名フォルダが作成できてしまった`);
      testsFailed++;
    }
  } catch (error) {
    console.log(`   ❌ エラー: ${error.message}`);
    testsFailed++;
  }

  // テスト結果サマリー
  console.log("\n" + "=".repeat(50));
  console.log("📊 テスト結果");
  console.log(`   ✅ 成功: ${testsPassed}件`);
  console.log(`   ❌ 失敗: ${testsFailed}件`);
  console.log("=".repeat(50));

  if (testsFailed === 0) {
    console.log("\n🎉 すべてのテストが成功しました!");
  } else {
    console.log("\n⚠️  いくつかのテストが失敗しました");
    process.exit(1);
  }
}

// テスト実行
testFolderNameUniqueness().catch((error) => {
  console.error("テスト実行エラー:", error);
  process.exit(1);
});
