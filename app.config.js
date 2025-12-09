const fs = require('fs');
const path = require('path');

const appJsonPath = path.resolve(__dirname, 'app.json');
let appConfig = {};
try {
  appConfig = require(appJsonPath);
} catch (e) {
  appConfig = { expo: {} };
}

// Simple .env parser (no external deps) to pick up NEXT_PUBLIC_BASE_URL
const envFile = path.resolve(__dirname, '.env');
let dotEnv = {};
try {
  const raw = fs.readFileSync(envFile, 'utf8');
  raw.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([^#=\s][^=]*)=(.*)$/);
    if (m) {
      const key = m[1].trim();
      let val = m[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1);
      }
      dotEnv[key] = val;
    }
  });
} catch (e) {
  // ignore missing .env
}

appConfig.expo = appConfig.expo || {};
appConfig.expo.extra = appConfig.expo.extra || {};

// Priority: runtime process.env > .env file > existing app.json value
appConfig.expo.extra.NEXT_PUBLIC_BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ||
  dotEnv.NEXT_PUBLIC_BASE_URL ||
  appConfig.expo.extra.NEXT_PUBLIC_BASE_URL ||
  null;

module.exports = appConfig;
