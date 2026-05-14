const ROOM_SCOPES = new Set(['auto', 'ip', 'subnet', 'wide']);
const DEFAULT_ROOM = 'default';
const COLORS = [
  'Amber',
  'Blue',
  'Coral',
  'Green',
  'Indigo',
  'Silver',
  'Violet',
  'Yellow',
];
const NAMES = [
  'Falcon',
  'Maple',
  'Nova',
  'River',
  'Signal',
  'Stone',
  'Swift',
  'Wave',
];

function normalizeIp(rawIp) {
  let ip = String(rawIp || 'unknown').trim().toLowerCase();

  if (ip.startsWith('[')) {
    ip = ip.slice(1, ip.indexOf(']'));
  } else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(ip)) {
    ip = ip.slice(0, ip.lastIndexOf(':'));
  }

  if (ip.startsWith('::ffff:')) {
    ip = ip.slice(7);
  }

  if (ip === '::1') {
    return '127.0.0.1';
  }

  return ip.split('%')[0];
}

function isIPv4(ip) {
  const parts = ip.split('.');
  return parts.length === 4 && parts.every((part) => {
    if (!/^\d+$/.test(part)) return false;
    const value = Number(part);
    return value >= 0 && value <= 255;
  });
}

function isPrivateIPv4(ip) {
  const parts = ip.split('.').map(Number);

  return parts[0] === 10
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || (parts[0] === 169 && parts[1] === 254)
    || ip === '127.0.0.1';
}

function expandIPv6(ip) {
  if (!ip.includes(':')) return null;

  const pieces = ip.split('::');
  if (pieces.length > 2) return null;

  const head = pieces[0] ? pieces[0].split(':') : [];
  const tail = pieces[1] ? pieces[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if (missing < 0) return null;

  const parts = [
    ...head,
    ...Array(missing).fill('0'),
    ...tail,
  ];

  if (parts.length !== 8 || !parts.every((part) => /^[0-9a-f]{1,4}$/.test(part))) {
    return null;
  }

  return parts.map((part) => part.padStart(4, '0'));
}

function scopedIp(ip, scope) {
  if (isIPv4(ip)) {
    const parts = ip.split('.');

    if (scope === 'auto' && isPrivateIPv4(ip)) {
      return `ipv4:${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
    }

    if (scope === 'wide') {
      return `ipv4:${parts[0]}.${parts[1]}.0.0/16`;
    }

    if (scope === 'subnet') {
      return `ipv4:${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
    }

    return `ipv4:${ip}`;
  }

  const ipv6 = expandIPv6(ip);
  if (ipv6) {
    if (scope === 'auto' || scope === 'subnet') {
      return `ipv6:${ipv6.slice(0, 4).join(':')}::/64`;
    }

    if (scope === 'wide') {
      return `ipv6:${ipv6.slice(0, 3).join(':')}::/48`;
    }

    return `ipv6:${ipv6.join(':')}`;
  }

  return `unknown:${ip}`;
}

function sanitizeRoom(value) {
  const room = String(value || DEFAULT_ROOM)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);

  return room || DEFAULT_ROOM;
}

function sanitizeRoomKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:._-]+/g, '')
    .slice(0, 96);
}

function getClientIp(request) {
  const ip = request.headers.get('cf-connecting-ip')
    || request.headers.get('x-real-ip')
    || (request.headers.get('x-forwarded-for') || '').split(/\s*,\s*/)[0]
    || 'unknown';

  return normalizeIp(ip);
}

function getRoomInfo(request) {
  const url = new URL(request.url);
  const requestedScope = url.searchParams.get('scope');
  const scope = ROOM_SCOPES.has(requestedScope) ? requestedScope : 'auto';
  const ip = getClientIp(request);
  const room = sanitizeRoom(url.searchParams.get('room'));
  const roomKey = sanitizeRoomKey(url.searchParams.get('roomKey'));
  const passwordPart = roomKey ? `password:${roomKey}` : 'password:open';
  const visibility = scopedIp(ip, scope);

  return {
    id: `${visibility}|room:${room}|${passwordPart}`,
    ip,
    room,
    roomKey,
    scope,
    visibility,
  };
}

function getCookie(request, name) {
  const cookie = request.headers.get('cookie') || '';
  const pairs = cookie.split(';').map((part) => part.trim());
  const prefix = `${name}=`;
  const pair = pairs.find((part) => part.startsWith(prefix));
  return pair ? decodeURIComponent(pair.slice(prefix.length)) : '';
}

function hashCode(value) {
  let hash = 0;
  const input = String(value);

  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }

  return Math.abs(hash);
}

function parseDeviceName(userAgent) {
  const ua = String(userAgent || '');
  const os = /Windows/i.test(ua)
    ? 'Windows'
    : /Android/i.test(ua)
      ? 'Android'
      : /iPhone|iPad|iPod/i.test(ua)
        ? 'iOS'
        : /Mac OS|Macintosh/i.test(ua)
          ? 'Mac'
          : /Linux/i.test(ua)
            ? 'Linux'
            : '';
  const browser = /Edg\//i.test(ua)
    ? 'Edge'
    : /Chrome\//i.test(ua)
      ? 'Chrome'
      : /Firefox\//i.test(ua)
        ? 'Firefox'
        : /Safari\//i.test(ua)
          ? 'Safari'
          : 'Browser';

  return `${os ? `${os} ` : ''}${browser}`.trim() || 'Unknown Device';
}

function getPeerName(request, peerId) {
  const seed = hashCode(peerId);
  const deviceName = parseDeviceName(request.headers.get('user-agent'));

  return {
    browser: deviceName.split(' ').pop(),
    deviceName,
    displayName: `${COLORS[seed % COLORS.length]} ${NAMES[Math.floor(seed / COLORS.length) % NAMES.length]}`,
    model: undefined,
    os: deviceName.split(' ')[0],
    type: /Android|iOS/i.test(deviceName) ? 'mobile' : 'desktop',
  };
}

function getPeerInfo(peer) {
  return {
    id: peer.id,
    name: peer.name,
    rtcSupported: peer.rtcSupported,
  };
}

export class SnapdropRoom {
  constructor() {
    this.peers = new Map();
  }

  async fetch(request) {
    if (request.headers.get('upgrade') !== 'websocket') {
      return new Response('Expected WebSocket upgrade.', { status: 426 });
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);
    const peerId = getCookie(request, 'peerid') || crypto.randomUUID();
    const peer = {
      id: peerId,
      lastBeat: Date.now(),
      name: getPeerName(request, peerId),
      room: getRoomInfo(request),
      rtcSupported: new URL(request.url).pathname.includes('/webrtc'),
      socket: server,
      timerId: 0,
    };
    const headers = new Headers();

    if (!getCookie(request, 'peerid')) {
      headers.append('Set-Cookie', `peerid=${encodeURIComponent(peerId)}; Path=/; SameSite=Strict; Secure`);
    }

    server.accept();
    server.addEventListener('message', (event) => this.onMessage(peer, event.data));
    server.addEventListener('close', () => this.leave(peer));
    server.addEventListener('error', () => this.leave(peer));

    this.join(peer);
    this.keepAlive(peer);
    this.send(peer, {
      type: 'display-name',
      message: {
        deviceName: peer.name.deviceName,
        displayName: peer.name.displayName,
      },
    });

    return new Response(null, {
      headers,
      status: 101,
      webSocket: client,
    });
  }

  join(peer) {
    for (const otherPeer of this.peers.values()) {
      this.send(otherPeer, {
        peer: getPeerInfo(peer),
        type: 'peer-joined',
      });
    }

    this.send(peer, {
      peers: Array.from(this.peers.values()).map(getPeerInfo),
      type: 'peers',
    });

    this.peers.set(peer.id, peer);
  }

  leave(peer) {
    if (!this.peers.has(peer.id)) return;

    if (peer.timerId) {
      clearTimeout(peer.timerId);
    }

    this.peers.delete(peer.id);

    for (const otherPeer of this.peers.values()) {
      this.send(otherPeer, {
        peerId: peer.id,
        type: 'peer-left',
      });
    }

    try {
      peer.socket.close();
    } catch (error) {
      // Already closed.
    }
  }

  onMessage(sender, data) {
    let message;

    try {
      message = JSON.parse(data);
    } catch (error) {
      return;
    }

    if (message.type === 'disconnect') {
      this.leave(sender);
      return;
    }

    if (message.type === 'pong') {
      sender.lastBeat = Date.now();
      return;
    }

    if (message.type !== 'signal' || !message.to) {
      return;
    }

    const recipient = this.peers.get(message.to);
    if (!recipient) return;

    delete message.to;
    message.sender = sender.id;
    this.send(recipient, message);
  }

  keepAlive(peer) {
    const timeout = 30000;

    if (Date.now() - peer.lastBeat > 2 * timeout) {
      this.leave(peer);
      return;
    }

    this.send(peer, { type: 'ping' });
    peer.timerId = setTimeout(() => this.keepAlive(peer), timeout);
  }

  send(peer, message) {
    try {
      peer.socket.send(JSON.stringify(message));
    } catch (error) {
      this.leave(peer);
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/server/')) {
      if (request.headers.get('upgrade') !== 'websocket') {
        return new Response('Expected WebSocket upgrade.', { status: 426 });
      }

      const room = getRoomInfo(request);
      const objectId = env.ROOMS.idFromName(room.id);
      const roomObject = env.ROOMS.get(objectId);
      return roomObject.fetch(request);
    }

    return env.ASSETS.fetch(request);
  },
};
