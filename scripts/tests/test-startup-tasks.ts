// テスト: 起動時タスクの動作確認
import { runStartupTasks } from '../../lib/startupTasks';

console.log('起動時タスクのテストを開始します...\n');

runStartupTasks()
  .then(() => {
    console.log('\nテスト完了');
    process.exit(0);
  })
  .catch((error) => {
    console.error('エラー:', error);
    process.exit(1);
  });
