const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

async function convertToMp4(inputPath) {
  const outputDir = path.join(__dirname, '../converted');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
  const outputPath = path.join(outputDir, `${Date.now()}.mp4`);

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions('-c:v libx264')
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .save(outputPath);
  });
}

module.exports = { convertToMp4 };
