/**
 * config.js — Edit this file before deploying.
 *
 * REQUIRED STEPS:
 *  1. In Google Sheets: File → Share → Publish to web
 *     → select the correct sheet tab → choose "Comma-separated values (.csv)" → Publish
 *     Then paste the URL it gives you as CSV_URL below (or keep the default
 *     which is built from the sheet ID and gid=0).
 *  2. Set a real PIN for each engineer.
 *  3. Add or remove engineers as needed.
 */

const CONFIG = {

  VERSION: '2.2.0',

  // ── Published CSV URL ─────────────────────────────────────────────────
  // Get this from: File → Share → Publish to web → CSV
  CSV_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTmjcAZ6v2j5Lrs_XhyPovwduIdtVjfnQKr0bqOau-MSyW3nuePnfoHsFAU4-OJWxilBqxCL3DKe2AA/pub?gid=0&single=true&output=csv',

  // ── Engineers ─────────────────────────────────────────────────────────
  // Format: 'ENGINEER_CODE': { pin: 'XXXX', name: 'Display Name' }
  // The 'ENGINEER_CODE' must match exactly what appears in the "engineer"
  // column of the spreadsheet.
  ENGINEERS: {
    'BORNEMAM': { pin: '0000', name: 'Bornema M' },
    'CHANA13': { pin: '0000', name: 'Chan A' },
    'CONEJ': { pin: '0000', name: 'Cone J' },
    'CRUISEM': { pin: '0000', name: 'Cruise M' },
    'DAWSONJ2': { pin: '0000', name: 'Dawson J' },
    'DOWS1': { pin: '0000', name: 'Dows' },
    'DUFFYJ': { pin: '0000', name: 'Duffy J' },
    'FARRUGIM': { pin: '0000', name: 'Farrugi M' },
    'GRANDMAK': { pin: '0000', name: 'Grandma K' },
    'HASTIEM': { pin: '0000', name: 'Hastie M' },
    'JACQUED1': { pin: '0000', name: 'Jacque D' },
    'JONESL5': { pin: '0000', name: 'Jones L' },
    'MCNEILK': { pin: '0000', name: 'McNeil K' },
    'MCDOUGD1': { pin: '0000', name: 'McDoug D' },
    'NASRJ': { pin: '0000', name: 'Nasr J' },
    'PLATTB': { pin: '0000', name: 'Platt B' },
    'ROBINSC5': { pin: '0000', name: 'Robins C' },
  }

};
