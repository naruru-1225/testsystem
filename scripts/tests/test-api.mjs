/**
 * API総合テストスクリプト
 * すべての主要なAPIエンドポイントをテストします
 */

const BASE_URL = "http://localhost:3000";

// カラー出力用
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testEndpoint(name, url, method = "GET", body = null) {
  try {
    const options = {
      method,
      headers: { "Content-Type": "application/json" },
    };
    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (response.ok) {
      log(`✓ ${name}`, "green");
      return { success: true, data };
    } else {
      log(
        `✗ ${name}: ${response.status} - ${data.error || "Unknown error"}`,
        "red"
      );
      return { success: false, error: data.error };
    }
  } catch (error) {
    log(`✗ ${name}: ${error.message}`, "red");
    return { success: false, error: error.message };
  }
}

async function runTests() {
  log("\n========================================", "cyan");
  log("API 総合テスト開始", "cyan");
  log("========================================\n", "cyan");

  let passCount = 0;
  let failCount = 0;

  // 1. 学年マスタデータのテスト
  log("\n[1] 学年マスタデータ", "blue");
  const gradesResult = await testEndpoint(
    "学年一覧取得 (GET /api/grades)",
    `${BASE_URL}/api/grades`
  );
  if (gradesResult.success) {
    passCount++;
    log(`   取得件数: ${gradesResult.data.length}件`, "yellow");
    if (gradesResult.data.length > 0) {
      log(
        `   例: ${gradesResult.data[0].name} (表示順: ${gradesResult.data[0].display_order})`,
        "yellow"
      );
    }
  } else {
    failCount++;
  }

  // 2. 科目マスタデータのテスト
  log("\n[2] 科目マスタデータ", "blue");
  const subjectsResult = await testEndpoint(
    "科目一覧取得 (GET /api/subjects)",
    `${BASE_URL}/api/subjects`
  );
  if (subjectsResult.success) {
    passCount++;
    log(`   取得件数: ${subjectsResult.data.length}件`, "yellow");
    if (subjectsResult.data.length > 0) {
      log(
        `   例: ${subjectsResult.data[0].name} (表示順: ${subjectsResult.data[0].display_order})`,
        "yellow"
      );
    }
  } else {
    failCount++;
  }

  // 3. タグのテスト
  log("\n[3] タグマスタデータ", "blue");
  const tagsResult = await testEndpoint(
    "タグ一覧取得 (GET /api/tags)",
    `${BASE_URL}/api/tags`
  );
  if (tagsResult.success) {
    passCount++;
    log(`   取得件数: ${tagsResult.data.length}件`, "yellow");
  } else {
    failCount++;
  }

  // 4. フォルダのテスト
  log("\n[4] フォルダ", "blue");
  const foldersResult = await testEndpoint(
    "フォルダ一覧取得 (GET /api/folders)",
    `${BASE_URL}/api/folders`
  );
  if (foldersResult.success) {
    passCount++;
    log(`   取得件数: ${foldersResult.data.length}件`, "yellow");
  } else {
    failCount++;
  }

  // 5. テスト一覧取得(フィルタなし)
  log("\n[5] テスト一覧取得", "blue");
  const testsResult = await testEndpoint(
    "テスト一覧取得 (GET /api/tests)",
    `${BASE_URL}/api/tests`
  );
  if (testsResult.success) {
    passCount++;
    log(`   取得件数: ${testsResult.data.length}件`, "yellow");
    if (testsResult.data.length > 0) {
      const test = testsResult.data[0];
      log(
        `   例: ${test.name} (学年: ${test.grade}, 科目: ${test.subject})`,
        "yellow"
      );
      log(
        `       タグ: ${test.tags.map((t) => t.name).join(", ") || "なし"}`,
        "yellow"
      );
    }
  } else {
    failCount++;
  }

  // 6. タグフィルタのテスト
  if (tagsResult.success && tagsResult.data.length > 0) {
    log("\n[6] タグフィルタ", "blue");
    const firstTagId = tagsResult.data[0].id;
    const tagFilterResult = await testEndpoint(
      `タグでフィルタ (GET /api/tests?tagId=${firstTagId})`,
      `${BASE_URL}/api/tests?tagId=${firstTagId}`
    );
    if (tagFilterResult.success) {
      passCount++;
      log(
        `   タグ「${tagsResult.data[0].name}」でフィルタ: ${tagFilterResult.data.length}件`,
        "yellow"
      );
    } else {
      failCount++;
    }
  }

  // 7. 学年フィルタのテスト
  if (gradesResult.success && gradesResult.data.length > 0) {
    log("\n[7] 学年フィルタ", "blue");
    const firstGrade = gradesResult.data[0].name;
    const gradeFilterResult = await testEndpoint(
      `学年でフィルタ (GET /api/tests?grade=${encodeURIComponent(firstGrade)})`,
      `${BASE_URL}/api/tests?grade=${encodeURIComponent(firstGrade)}`
    );
    if (gradeFilterResult.success) {
      passCount++;
      log(
        `   学年「${firstGrade}」でフィルタ: ${gradeFilterResult.data.length}件`,
        "yellow"
      );
    } else {
      failCount++;
    }
  }

  // 8. 科目フィルタのテスト
  if (subjectsResult.success && subjectsResult.data.length > 0) {
    log("\n[8] 科目フィルタ", "blue");
    const firstSubject = subjectsResult.data[0].name;
    const subjectFilterResult = await testEndpoint(
      `科目でフィルタ (GET /api/tests?subject=${encodeURIComponent(
        firstSubject
      )})`,
      `${BASE_URL}/api/tests?subject=${encodeURIComponent(firstSubject)}`
    );
    if (subjectFilterResult.success) {
      passCount++;
      log(
        `   科目「${firstSubject}」でフィルタ: ${subjectFilterResult.data.length}件`,
        "yellow"
      );
    } else {
      failCount++;
    }
  }

  // 9. 複合フィルタのテスト
  if (
    gradesResult.success &&
    subjectsResult.success &&
    gradesResult.data.length > 0 &&
    subjectsResult.data.length > 0
  ) {
    log("\n[9] 複合フィルタ (学年 + 科目)", "blue");
    const grade = gradesResult.data[0].name;
    const subject = subjectsResult.data[0].name;
    const combinedFilterResult = await testEndpoint(
      `学年&科目でフィルタ (GET /api/tests?grade=${encodeURIComponent(
        grade
      )}&subject=${encodeURIComponent(subject)})`,
      `${BASE_URL}/api/tests?grade=${encodeURIComponent(
        grade
      )}&subject=${encodeURIComponent(subject)}`
    );
    if (combinedFilterResult.success) {
      passCount++;
      log(
        `   学年「${grade}」× 科目「${subject}」: ${combinedFilterResult.data.length}件`,
        "yellow"
      );
    } else {
      failCount++;
    }
  }

  // 10. 検索フィルタのテスト
  log("\n[10] 検索フィルタ", "blue");
  const searchResult = await testEndpoint(
    "検索フィルタ (GET /api/tests?search=テスト)",
    `${BASE_URL}/api/tests?search=テスト`
  );
  if (searchResult.success) {
    passCount++;
    log(`   「テスト」で検索: ${searchResult.data.length}件`, "yellow");
  } else {
    failCount++;
  }

  // 11. カテゴリ取得のテスト
  log("\n[11] カテゴリ取得", "blue");
  const categoriesResult = await testEndpoint(
    "カテゴリ一覧取得 (GET /api/categories)",
    `${BASE_URL}/api/categories`
  );
  if (categoriesResult.success) {
    passCount++;
    log(`   カテゴリ数: ${categoriesResult.data.length}件`, "yellow");
    if (categoriesResult.data.length > 0) {
      const cat = categoriesResult.data[0];
      log(
        `   例: 学年「${cat.grade}」- 科目: ${cat.subjects.join(", ")}`,
        "yellow"
      );
    }
  } else {
    failCount++;
  }

  // 結果サマリー
  log("\n========================================", "cyan");
  log("テスト結果サマリー", "cyan");
  log("========================================", "cyan");
  log(`成功: ${passCount}件`, "green");
  log(`失敗: ${failCount}件`, failCount > 0 ? "red" : "green");
  log(`合計: ${passCount + failCount}件\n`, "yellow");

  if (failCount === 0) {
    log("✓ すべてのテストが成功しました!", "green");
  } else {
    log("✗ いくつかのテストが失敗しました", "red");
  }

  process.exit(failCount > 0 ? 1 : 0);
}

// テスト実行
runTests().catch((error) => {
  log(`\n致命的なエラー: ${error.message}`, "red");
  console.error(error);
  process.exit(1);
});
