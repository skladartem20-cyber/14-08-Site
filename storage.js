'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { URL } = require('url');

const CFG = {
  endpoint: (process.env.S3_ENDPOINT || '').trim().replace(/\/+$/, ''),
  bucket: (process.env.S3_BUCKET || '').trim(),
  accessKey: (process.env.S3_ACCESS_KEY || '').trim(),
  secretKey: (process.env.S3_SECRET_KEY || '').trim(),
  region: (process.env.S3_REGION || 'ru-1').trim()
};

const USE_S3 = Boolean(CFG.endpoint && CFG.bucket && CFG.accessKey && CFG.secretKey);

const DATA_KEY = 'data.json';
const UPLOAD_PREFIX = 'uploads/';
const BACKUP_PREFIX = 'backups/';

const LOCAL_DATA_DIR = path.join(__dirname, 'data');
const LOCAL_DATA_FILE = path.join(LOCAL_DATA_DIR, 'data.json');
const LOCAL_UPLOAD_DIR = path.join(__dirname, 'uploads');
const LOCAL_BACKUP_DIR = path.join(LOCAL_DATA_DIR, 'backups');

if (!USE_S3) {
  for (const dir of [LOCAL_DATA_DIR, LOCAL_UPLOAD_DIR, LOCAL_BACKUP_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

const EXT_TYPES = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif', bmp: 'image/bmp',
  pdf: 'application/pdf', json: 'application/json'
};

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}
function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}
function uriEncode(str, encodeSlash) {
  let out = '';
  for (const ch of Buffer.from(str, 'utf8').toString('binary')) {
    if (/[A-Za-z0-9_.~-]/.test(ch)) out += ch;
    else if (ch === '/') out += encodeSlash ? '%2F' : '/';
    else out += '%' + ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0');
  }
  return out;
}
function safeName(name) {
  return String(name || '').replace(/[^A-Za-z0-9._-]/g, '');
}
function extType(key) {
  const m = String(key).toLowerCase().match(/\.([a-z0-9]+)$/);
  return (m && EXT_TYPES[m[1]]) || 'application/octet-stream';
}

function s3Request(method, key, { body = Buffer.alloc(0), contentType, query = {} } = {}) {
  return new Promise((resolve, reject) => {
    const base = new URL(CFG.endpoint);
    const isHttps = base.protocol === 'https:';
    const host = base.host;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const payload = Buffer.isBuffer(body) ? body : Buffer.from(body || '');
    const payloadHash = sha256Hex(payload);

    const canonicalUri = '/' + uriEncode(CFG.bucket, true) + '/' + uriEncode(key, false);
    const qKeys = Object.keys(query).sort();
    const canonicalQuery = qKeys.map((k) => uriEncode(k, true) + '=' + uriEncode(String(query[k]), true)).join('&');

    const headers = {
      host: host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate
    };
    if (contentType) headers['content-type'] = contentType;
    const signedHeaderKeys = Object.keys(headers).map((h) => h.toLowerCase()).sort();
    const canonicalHeaders = signedHeaderKeys.map((h) => h + ':' + String(headers[h]).trim() + '\n').join('');
    const signedHeaders = signedHeaderKeys.join(';');

    const canonicalRequest = [method, canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join('\n');
    const scope = `${dateStamp}/${CFG.region}/s3/aws4_request`;
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n');
    const kDate = hmac('AWS4' + CFG.secretKey, dateStamp);
    const kRegion = hmac(kDate, CFG.region);
    const kService = hmac(kRegion, 's3');
    const kSigning = hmac(kService, 'aws4_request');
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');
    const authorization = `AWS4-HMAC-SHA256 Credential=${CFG.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const reqHeaders = Object.assign({}, headers, { Authorization: authorization, 'Content-Length': payload.length });
    const options = {
      method,
      host: base.hostname,
      port: base.port || (isHttps ? 443 : 80),
      path: canonicalUri + (canonicalQuery ? '?' + canonicalQuery : ''),
      headers: reqHeaders
    };
    const lib = isHttps ? https : http;
    const req = lib.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.end(payload);
  });
}

async function s3Get(key) {
  const r = await s3Request('GET', key);
  if (r.statusCode === 200) return r.body;
  if (r.statusCode === 404) return null;
  throw new Error('S3 GET ' + key + ' -> ' + r.statusCode);
}
async function s3Put(key, buffer, contentType) {
  const r = await s3Request('PUT', key, { body: buffer, contentType: contentType || extType(key) });
  if (r.statusCode >= 200 && r.statusCode < 300) return true;
  throw new Error('S3 PUT ' + key + ' -> ' + r.statusCode);
}
async function s3Delete(key) {
  const r = await s3Request('DELETE', key);
  if (r.statusCode >= 200 && r.statusCode < 300) return true;
  if (r.statusCode === 404) return true;
  throw new Error('S3 DELETE ' + key + ' -> ' + r.statusCode);
}
async function s3List(prefix) {
  const out = [];
  let token = null;
  do {
    const query = { 'list-type': '2', prefix: prefix };
    if (token) query['continuation-token'] = token;
    const r = await s3Request('GET', '', { query });
    if (r.statusCode !== 200) throw new Error('S3 LIST -> ' + r.statusCode);
    const xml = r.body.toString('utf8');
    const re = /<Contents>([\s\S]*?)<\/Contents>/g;
    let m;
    while ((m = re.exec(xml))) {
      const block = m[1];
      const key = (block.match(/<Key>([\s\S]*?)<\/Key>/) || [])[1] || '';
      const size = Number((block.match(/<Size>(\d+)<\/Size>/) || [])[1] || 0);
      const lm = (block.match(/<LastModified>([\s\S]*?)<\/LastModified>/) || [])[1] || '';
      if (key) out.push({ key, size, lastModified: lm });
    }
    const tk = (xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/) || [])[1];
    token = tk || null;
  } while (token);
  return out;
}

function newUploadKey(originalName, mimetype) {
  let ext = (path.extname(originalName || '') || '').replace('.', '').toLowerCase();
  if (!ext) {
    const found = Object.keys(EXT_TYPES).find((e) => EXT_TYPES[e] === mimetype);
    ext = found || 'bin';
  }
  ext = ext.replace(/[^a-z0-9]/g, '') || 'bin';
  return UPLOAD_PREFIX + crypto.randomUUID() + '.' + ext;
}
function keyFromUploadUrl(url) {
  if (!url || typeof url !== 'string' || !url.startsWith('/uploads/')) return null;
  return UPLOAD_PREFIX + safeName(url.slice('/uploads/'.length));
}

const api = {
  usingS3: USE_S3,

  async loadData() {
    if (USE_S3) {
      const buf = await s3Get(DATA_KEY);
      if (!buf) return null;
      try { return JSON.parse(buf.toString('utf8')); } catch (e) { return null; }
    }
    if (!fs.existsSync(LOCAL_DATA_FILE)) return null;
    try { return JSON.parse(fs.readFileSync(LOCAL_DATA_FILE, 'utf8')); } catch (e) { return null; }
  },

  async saveData(dataObj) {
    const buf = Buffer.from(JSON.stringify(dataObj, null, 2), 'utf8');
    if (USE_S3) return s3Put(DATA_KEY, buf, 'application/json');
    const tmp = LOCAL_DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, buf);
    fs.renameSync(tmp, LOCAL_DATA_FILE);
    return true;
  },

  async putUpload(file) {
    const key = newUploadKey(file.originalname, file.mimetype);
    if (USE_S3) await s3Put(key, file.buffer, file.mimetype || extType(key));
    else fs.writeFileSync(path.join(LOCAL_UPLOAD_DIR, key.slice(UPLOAD_PREFIX.length)), file.buffer);
    return '/uploads/' + key.slice(UPLOAD_PREFIX.length);
  },

  async readUpload(name) {
    const clean = safeName(name);
    if (!clean) return null;
    if (USE_S3) {
      const buf = await s3Get(UPLOAD_PREFIX + clean);
      return buf ? { buffer: buf, contentType: extType(clean) } : null;
    }
    const p = path.join(LOCAL_UPLOAD_DIR, clean);
    if (!fs.existsSync(p)) return null;
    return { buffer: fs.readFileSync(p), contentType: extType(clean) };
  },

  async deleteUploadUrl(url) {
    const key = keyFromUploadUrl(url);
    if (!key) return false;
    if (USE_S3) return s3Delete(key);
    const p = path.join(LOCAL_UPLOAD_DIR, key.slice(UPLOAD_PREFIX.length));
    if (fs.existsSync(p)) fs.unlinkSync(p);
    return true;
  },

  async saveBackup(dataObj) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const name = 'backup-' + stamp + '.json';
    const buf = Buffer.from(JSON.stringify(dataObj), 'utf8');
    if (USE_S3) await s3Put(BACKUP_PREFIX + name, buf, 'application/json');
    else fs.writeFileSync(path.join(LOCAL_BACKUP_DIR, name), buf);
    return name;
  },

  async listBackups() {
    if (USE_S3) {
      const items = await s3List(BACKUP_PREFIX);
      return items.map((i) => ({ name: i.key.slice(BACKUP_PREFIX.length), size: i.size, time: Date.parse(i.lastModified) || 0 }))
        .filter((b) => b.name).sort((a, b) => b.time - a.time);
    }
    if (!fs.existsSync(LOCAL_BACKUP_DIR)) return [];
    return fs.readdirSync(LOCAL_BACKUP_DIR).filter((f) => f.endsWith('.json')).map((f) => {
      const st = fs.statSync(path.join(LOCAL_BACKUP_DIR, f));
      return { name: f, size: st.size, time: st.mtimeMs };
    }).sort((a, b) => b.time - a.time);
  },

  async getBackup(name) {
    const clean = safeName(name);
    if (!clean) return null;
    if (USE_S3) return s3Get(BACKUP_PREFIX + clean);
    const p = path.join(LOCAL_BACKUP_DIR, clean);
    return fs.existsSync(p) ? fs.readFileSync(p) : null;
  },

  async deleteBackup(name) {
    const clean = safeName(name);
    if (!clean) return false;
    if (USE_S3) return s3Delete(BACKUP_PREFIX + clean);
    const p = path.join(LOCAL_BACKUP_DIR, clean);
    if (fs.existsSync(p)) fs.unlinkSync(p);
    return true;
  }
};

module.exports = api;
