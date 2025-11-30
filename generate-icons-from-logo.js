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

// Try to use sharp if available, otherwise use jimp
let resizeImage;

try {
  const sharp = require('sharp');
  resizeImage = async (inputPath, outputPath, size) => {
    await sharp(inputPath)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .toFile(outputPath);
  };
  console.log('Using sharp for image processing');
} catch (e) {
  try {
    const Jimp = require('jimp');
    resizeImage = async (inputPath, outputPath, size) => {
      const image = await Jimp.read(inputPath);
      await image
        .contain(size, size)
        .write(outputPath);
    };
    console.log('Using Jimp for image processing');
  } catch (e2) {
    console.error('Error: Neither sharp nor jimp is installed.');
    console.error('Please install one of them:');
    console.error('  npm install sharp');
    console.error('  OR');
    console.error('  npm install jimp');
    process.exit(1);
  }
}

async function generateIcons() {
  const logoPath = path.join(__dirname, 'assets', 'images', 'logo_construction.png');
  
  // Check if logo exists
  if (!fs.existsSync(logoPath)) {
    console.error(`Error: Logo file not found at ${logoPath}`);
    process.exit(1);
  }

  console.log(`Using logo: ${logoPath}`);
  console.log('Generating icons...\n');

  // Generate icons for all sizes
  for (const [folder, size] of Object.entries(iconSizes)) {
    const folderPath = path.join(__dirname, 'android', 'app', 'src', 'main', 'res', folder);
    
    // Create folder if it doesn't exist
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    try {
      // Generate ic_launcher.png
      const iconPath = path.join(folderPath, 'ic_launcher.png');
      await resizeImage(logoPath, iconPath, size);
      console.log(`✓ Generated ${size}x${size} icon: ${iconPath}`);

      // Generate ic_launcher_round.png (same as ic_launcher for now)
      const roundIconPath = path.join(folderPath, 'ic_launcher_round.png');
      await resizeImage(logoPath, roundIconPath, size);
      console.log(`✓ Generated ${size}x${size} round icon: ${roundIconPath}`);
    } catch (error) {
      console.error(`✗ Error generating icon for ${folder}:`, error.message);
    }
  }

  console.log('\n✓ All icons generated successfully!');
  console.log('\nNote: You may need to rebuild the app for changes to take effect.');
}

generateIcons().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

