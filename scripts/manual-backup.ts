import { performBackup } from '../lib/backupScheduler';

console.log('Starting manual backup test...');
performBackup().then(() => {
  console.log('Manual backup test finished.');
}).catch(err => {
  console.error('Manual backup test failed:', err);
});
