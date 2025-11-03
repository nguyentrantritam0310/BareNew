const fs = require('fs');
const path = require('path');

// Icon sizes for Android
const iconSizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192
};

// Create a simple PNG icon programmatically
function createIcon(size) {
  const canvas = require('canvas');
  const { createCanvas } = canvas;
  
  const canvasSize = size;
  const canvas = createCanvas(canvasSize, canvasSize);
  const ctx = canvas.getContext('2d');
  
  // Create gradient background
  const gradient = ctx.createLinearGradient(0, 0, 0, canvasSize);
  gradient.addColorStop(0, '#4A90E2');
  gradient.addColorStop(1, '#2E5BBA');
  
  // Draw background circle
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(canvasSize/2, canvasSize/2, canvasSize/2 - 4, 0, 2 * Math.PI);
  ctx.fill();
  
  // Draw hard hat
  const centerX = canvasSize / 2;
  const centerY = canvasSize / 2;
  const hatSize = canvasSize * 0.3;
  
  // Hard hat dome
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.ellipse(centerX, centerY - hatSize/3, hatSize, hatSize*0.7, 0, 0, 2 * Math.PI);
  ctx.fill();
  
  // Hard hat ridges
  ctx.strokeStyle = '#E5E7EB';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(centerX - hatSize*0.6, centerY - hatSize*0.5);
  ctx.lineTo(centerX + hatSize*0.6, centerY - hatSize*0.5);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(centerX - hatSize*0.5, centerY - hatSize*0.2);
  ctx.lineTo(centerX + hatSize*0.5, centerY - hatSize*0.2);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(centerX - hatSize*0.4, centerY + hatSize*0.1);
  ctx.lineTo(centerX + hatSize*0.4, centerY + hatSize*0.1);
  ctx.stroke();
  
  // Hard hat brim
  ctx.beginPath();
  ctx.ellipse(centerX, centerY + hatSize*0.4, hatSize*1.1, hatSize*0.3, 0, 0, 2 * Math.PI);
  ctx.fill();
  
  return canvas.toBuffer('image/png');
}

// Generate icons for all sizes
Object.entries(iconSizes).forEach(([folder, size]) => {
  const iconBuffer = createIcon(size);
  const folderPath = path.join(__dirname, 'android', 'app', 'src', 'main', 'res', folder);
  
  // Create folder if it doesn't exist
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
  
  // Write icon files
  fs.writeFileSync(path.join(folderPath, 'ic_launcher.png'), iconBuffer);
  fs.writeFileSync(path.join(folderPath, 'ic_launcher_round.png'), iconBuffer);
  
  console.log(`Generated ${size}x${size} icon for ${folder}`);
});

console.log('All icons generated successfully!');


