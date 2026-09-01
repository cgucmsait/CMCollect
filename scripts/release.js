import { execSync } from 'child_process';
import readline from 'readline';

function run(cmd) {
  execSync(cmd, { stdio: 'inherit' });
}

function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

async function main() {
  let message = process.argv.slice(2).join(' ').trim();
  if (!message) {
    message = await prompt('請輸入 Commit 備註 (直接 Enter 預設為 "update site"): ');
  }
  if (!message) {
    message = 'update site';
  }

  console.log(`\n🚀 準備發布，Commit 訊息: "${message}"\n`);

  run('git add .');

  try {
    const status = execSync('git status --porcelain').toString().trim();
    if (status) {
      // 避免引號被截斷
      run(`git commit -m "${message.replace(/"/g, '\\"')}"`);
    } else {
      console.log('ℹ️ 沒有新的變更需要 commit。');
    }
  } catch (err) {
    console.error('Git commit 錯誤:', err.message);
  }

  console.log('\n📤 推送至 GitHub main 分支...');
  run('git push origin main');

  console.log('\n🌐 部署至 GitHub Pages...');
  run('npm run deploy');

  console.log('\n✨ 發布完成！');
}

main().catch((err) => {
  console.error('\n❌ 發布流程中斷:', err);
  process.exit(1);
});
