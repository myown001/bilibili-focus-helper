const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');

const zip = new AdmZip();
const outputDir = path.resolve(__dirname, '../dist');
const zipPath = path.resolve(__dirname, '../bilibili-focus-mode.zip');

// 从dist目录添加文件到zip
if (fs.existsSync(outputDir)) {
  const files = fs.readdirSync(outputDir);
  files.forEach(file => {
    const filePath = path.join(outputDir, file);
    if (fs.lstatSync(filePath).isDirectory()) {
      zip.addLocalFolder(filePath, file);
    } else {
      zip.addLocalFile(filePath);
    }
  });
  
  // 写入zip文件
  zip.writeZip(zipPath);
  console.log(`已创建扩展包: ${zipPath}`);
} else {
  console.error('dist目录不存在，请先运行build命令');
} 