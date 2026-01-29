const sharp = require('sharp');
const path = require('path');

const input = path.resolve(__dirname, '../assets/images/logo-extended.svg');
const output = path.resolve(__dirname, '../assets/images/logo-extended.png');

sharp(input, { density: 600 })
    .png()
    .toFile(output)
    .then(() => console.log('Success!'))
    .catch((e) => { console.error(e); process.exit(1); });
