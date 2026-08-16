'use strict';

const net = require('net');
const tls = require('tls');

const T = {
  token: (process.env.TELEGRAM_BOT_TOKEN || '').trim(),
  chatId: (process.env.TELEGRAM_CHAT_ID || '').trim(),
  proxyType: (process.env.TELEGRAM_PROXY_TYPE || 'http').trim().toLowerCase(),
  proxyHost: (process.env.TELEGRAM_PROXY_HOST || '').trim(),
  proxyPort: parseInt(process.env.TELEGRAM_PROXY_PORT || '0', 10) || 0,
  proxyUser: (process.env.TELEGRAM_PROXY_USER || '').trim(),
  proxyPass: (process.env.TELEGRAM_PROXY_PASS || '').trim()
};

const API_HOST = 'api.telegram.org';
const API_PORT = 443;
const TIMEOUT_MS = 15000;

function configured() { return Boolean(T.token && T.chatId); }
function proxyEnabled() { return Boolean(T.proxyHost && T.proxyPort); }
function status() {
  return {
    configured: configured(),
    hasToken: Boolean(T.token),
    hasChatId: Boolean(T.chatId),
    proxy: proxyEnabled(),
    proxyType: proxyEnabled() ? T.proxyType : ''
  };
}

function connectTls(cb) {
  let settled = false;
  const done = (err, sock) => { if (!settled) { settled = true; cb(err, sock); } };

  if (!proxyEnabled()) {
    const s = tls.connect({ host: API_HOST, port: API_PORT, servername: API_HOST }, () => done(null, s));
    s.on('error', (e) => done(e));
    s.setTimeout(TIMEOUT_MS, () => { s.destroy(); done(new Error('timeout')); });
    return;
  }
  if (T.proxyType === 'socks5' || T.proxyType === 'socks') return socks5(done);
  return httpConnect(done);
}

function httpConnect(done) {
  const sock = net.connect(T.proxyPort, T.proxyHost);
  sock.setTimeout(TIMEOUT_MS, () => { sock.destroy(); done(new Error('proxy timeout')); });
  sock.on('error', (e) => done(e));
  sock.once('connect', () => {
    let head = `CONNECT ${API_HOST}:${API_PORT} HTTP/1.1\r\nHost: ${API_HOST}:${API_PORT}\r\n`;
    if (T.proxyUser) {
      const auth = Buffer.from(T.proxyUser + ':' + T.proxyPass).toString('base64');
      head += `Proxy-Authorization: Basic ${auth}\r\n`;
    }
    head += '\r\n';
    sock.write(head);
  });
  let buf = Buffer.alloc(0);
  const onData = (d) => {
    buf = Buffer.concat([buf, d]);
    const idx = buf.indexOf('\r\n\r\n');
    if (idx === -1) return;
    sock.removeListener('data', onData);
    const line = buf.slice(0, buf.indexOf('\r\n')).toString();
    if (/^HTTP\/1\.[01] 2\d\d/.test(line)) {
      const tlsSock = tls.connect({ socket: sock, servername: API_HOST }, () => done(null, tlsSock));
      tlsSock.on('error', (e) => done(e));
    } else {
      done(new Error('Прокси отклонил соединение: ' + line));
    }
  };
  sock.on('data', onData);
}

function socks5(done) {
  const sock = net.connect(T.proxyPort, T.proxyHost);
  let stage = 0;
  sock.setTimeout(TIMEOUT_MS, () => { sock.destroy(); done(new Error('proxy timeout')); });
  sock.on('error', (e) => done(e));
  sock.once('connect', () => {
    sock.write(T.proxyUser ? Buffer.from([5, 2, 0, 2]) : Buffer.from([5, 1, 0]));
    stage = 1;
  });
  const sendConnect = () => {
    const host = Buffer.from(API_HOST);
    const port = Buffer.alloc(2); port.writeUInt16BE(API_PORT, 0);
    sock.write(Buffer.concat([Buffer.from([5, 1, 0, 3, host.length]), host, port]));
    stage = 3;
  };
  const onData = (d) => {
    if (stage === 1) {
      if (d[0] !== 5) return done(new Error('SOCKS5: неверный ответ'));
      if (d[1] === 0) return sendConnect();
      if (d[1] === 2) {
        const u = Buffer.from(T.proxyUser), p = Buffer.from(T.proxyPass);
        sock.write(Buffer.concat([Buffer.from([1, u.length]), u, Buffer.from([p.length]), p]));
        stage = 2;
        return;
      }
      return done(new Error('SOCKS5: метод авторизации не поддержан'));
    }
    if (stage === 2) {
      if (d[1] !== 0) return done(new Error('SOCKS5: авторизация не пройдена'));
      return sendConnect();
    }
    if (stage === 3) {
      if (d[1] !== 0) return done(new Error('SOCKS5: не удалось подключиться (код ' + d[1] + ')'));
      sock.removeListener('data', onData);
      const tlsSock = tls.connect({ socket: sock, servername: API_HOST }, () => done(null, tlsSock));
      tlsSock.on('error', (e) => done(e));
    }
  };
  sock.on('data', onData);
}

function request(method, payloadObj) {
  return new Promise((resolve) => {
    connectTls((err, socket) => {
      if (err) return resolve({ ok: false, error: err.message });
      const payload = Buffer.from(JSON.stringify(payloadObj));
      const head = `POST /bot${T.token}/${method} HTTP/1.1\r\nHost: ${API_HOST}\r\nContent-Type: application/json\r\nContent-Length: ${payload.length}\r\nConnection: close\r\n\r\n`;
      let buf = Buffer.alloc(0);
      let settled = false;
      const finish = (res) => { if (!settled) { settled = true; try { socket.destroy(); } catch (e) {} resolve(res); } };
      socket.on('data', (d) => { buf = Buffer.concat([buf, d]); });
      socket.on('end', () => {
        const text = buf.toString();
        const body = text.slice(text.indexOf('\r\n\r\n') + 4);
        let json = {};
        try { json = JSON.parse(body); } catch (e) {}
        if (json && json.ok) finish({ ok: true });
        else finish({ ok: false, error: (json && json.description) || 'Telegram вернул ошибку' });
      });
      socket.on('error', (e) => finish({ ok: false, error: e.message }));
      socket.setTimeout(TIMEOUT_MS, () => finish({ ok: false, error: 'timeout' }));
      socket.write(head);
      socket.write(payload);
    });
  });
}

async function sendMessage(text) {
  if (!configured()) return { ok: false, skipped: true, error: 'Telegram не настроен' };
  return request('sendMessage', { chat_id: T.chatId, text: text, parse_mode: 'HTML', disable_web_page_preview: true });
}

module.exports = { sendMessage, configured, proxyEnabled, status };
