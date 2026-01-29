const sharp = require('sharp');
const path = require('path');

const file = path.resolve(__dirname, '../assets/images/logo-extended.png');

sharp(file).metadata().then(m => console.log(JSON.stringify(m, null, 2))).catch(e => { console.error(e); process.exit(1); });
