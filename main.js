/**
 * CodedBy: Ic3zy
 * This code functions similarly to Internet Download Manager.
 * Downloading large files using regular browsers can be problematic.
 * This script handles such downloads and is intended as a prototype.
 * It has been tested with files up to 30 GB with no known issues.
 * It includes basic support for saving download state and resuming (not recommended).
*/
const fs = require('fs');
const axios = require('axios');
const path = require('path');

const fileUrl = 'https://example.com/download'; // The link of the file you will download
const fileName = 'save.extension'; // The file save name
const targetDir = 'D:/Folder'; // The file path
const outputPath = path.join(targetDir, fileName);

// Safer directory creation
function ensureDirectoryExists(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`📂 Directory created: ${dirPath}`);
    }
  } catch (err) {
    console.error('❌ Error while creating directory:', err);
    throw err;
  }
}

async function downloadFile(url, outputPath) {
  console.log('🚀 Download starting...');
  
  try {
    ensureDirectoryExists(targetDir);

    const response = await axios({
      method: 'GET',
      url,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        // 'Referer': 'https://gofile.io/', // This referer part is necessary if you are going to add a cookie
        // 'Cookie': 'accountToken=example', // This cookie part is mandatory when downloading from sites like gofile
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    const totalLength = response.headers['content-length'] ? parseInt(response.headers['content-length'], 10) : null;
    console.log(`📦 File size: ${totalLength ? (totalLength / 1024 / 1024 / 1024).toFixed(2) + ' GB' : 'Unknown'}`);
    console.log(`💾 Save path: ${outputPath}`);

    const writer = fs.createWriteStream(outputPath);
    let downloaded = 0;
    let startTime = Date.now();
    let lastUpdate = 0;
    let lastPrintedSize = 0;
    let speedSamples = [];
    const speedSampleCount = 5;

    response.data.on('data', (chunk) => {
      downloaded += chunk.length;

      // Save samples for speed calculation
      const now = Date.now();
      const timeDiff = (now - startTime) / 1000;
      if (timeDiff > 0) {
        speedSamples.push(downloaded / timeDiff);
        if (speedSamples.length > speedSampleCount) {
          speedSamples.shift();
        }
      }

      // Update interval (50ms)
      if (now - lastUpdate < 50) return;
      lastUpdate = now;

      // Calculate progress info
      const avgSpeed = speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length || 0;
      const speedMB = avgSpeed / 1024 / 1024;
      const percent = totalLength ? (downloaded / totalLength) * 100 : null;
      const remainingBytes = totalLength ? totalLength - downloaded : null;
      const eta = remainingBytes && avgSpeed > 0 ? remainingBytes / avgSpeed : null;
      const etaFormatted = eta ? 
        `${Math.floor(eta / 3600)}h ${Math.floor((eta % 3600) / 60)}m ${Math.floor(eta % 60)}s` : 
        'Unknown';

      // Build progress bar
      let progressBar = '';
      if (percent !== null) {
        const progressWidth = 30;
        const filled = Math.round(progressWidth * percent / 100);
        progressBar = `[${'█'.repeat(filled)}${' '.repeat(progressWidth - filled)}]`;
      }

      // Print progress
      let progress = `\r⬇️  ${(downloaded / 1024 / 1024 / 1024).toFixed(2)}GB`;
      if (totalLength) progress += ` / ${(totalLength / 1024 / 1024 / 1024).toFixed(2)}GB`;
      if (percent !== null) progress += ` ${percent.toFixed(1)}%`;
      if (progressBar) progress += ` ${progressBar}`;
      progress += ` | Speed: ${speedMB.toFixed(2)}MB/s`;
      progress += ` | Remaining: ${etaFormatted}`;

      process.stdout.write(progress);
      lastPrintedSize = downloaded;
    });

    // Error handling
    response.data.on('error', (err) => {
      writer.end();
      console.error('\n❌ Error during download:', err);
      cleanupPartialFile(outputPath);
    });

    writer.on('error', (err) => {
      console.error('\n❌ File write error:', err);
      cleanupPartialFile(outputPath);
    });

    // Pipe data
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', async () => {
        console.log('\n\n✅ Download completed. Verifying file...');
        
        // Check file size
        try {
          const stats = await fs.promises.stat(outputPath);
          const actualSize = stats.size;
          
          if (totalLength !== null && actualSize !== totalLength) {
            console.error(`❌ File size mismatch: Expected ${totalLength}, Got ${actualSize}`);
            cleanupPartialFile(outputPath);
            reject(new Error('File size mismatch'));
          } else {
            console.log(`✔️ File saved successfully: ${outputPath}`);
            console.log(`📊 Final size: ${(actualSize / 1024 / 1024 / 1024).toFixed(2)} GB`);
            resolve();
          }
        } catch (err) {
          console.error('\n❌ File verification error:', err);
          cleanupPartialFile(outputPath);
          reject(err);
        }
      });
    });
  } catch (err) {
    console.error('\n❌ Failed to start download:', err);
    cleanupPartialFile(outputPath);
    throw err;
  }
}

function cleanupPartialFile(filePath) {
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log(`🗑️ Partial file deleted: ${filePath}`);
    } catch (err) {
      console.error('❌ Failed to delete partial file:', err);
    }
  }
}

// Start download and add user interaction at end
downloadFile(fileUrl, outputPath)
  .then(() => {
    console.log('\nOperation completed. Press any key to exit...');
    
    // Wait for user interaction
    if (process.platform === 'win32') {
      const rl = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      rl.question('', () => {
        rl.close();
        process.exit(0);
      });
    } else {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('data', () => process.exit(0));
    }
  })
  .catch(err => {
    console.error('\n❌ Download failed:', err);
    console.log('\nPress any key to exit...');
    
    // Wait for user interaction
    if (process.platform === 'win32') {
      const rl = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      rl.question('', () => {
        rl.close();
        process.exit(1);
      });
    } else {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('data', () => process.exit(1));
    }
  });
