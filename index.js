var process = require('process')
// Handle SIGINT
process.on('SIGINT', () => {
  console.info("SIGINT Received, exiting...")
  process.exit(0)
})

// Handle SIGTERM
process.on('SIGTERM', () => {
  console.info("SIGTERM Received, exiting...")
  process.exit(0)
})

// Handle APP ERRORS
process.on('uncaughtException', (error, origin) => {
    console.log('----- Uncaught exception -----')
    console.log(error)
    console.log('----- Exception origin -----')
    console.log(origin)
})
process.on('unhandledRejection', (reason, promise) => {
    console.log('----- Unhandled Rejection at -----')
    console.log(promise)
    console.log('----- Reason -----')
    console.log(reason)
})

const express = require('express');
const RateLimit = require('express-rate-limit');
const http = require('http');

const ROOM_SCOPES = new Set(['auto', 'ip', 'subnet', 'wide']);
const DEFAULT_ROOM = 'default';

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
    return parts.length === 4 && parts.every(part => {
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
        ...tail
    ];

    if (parts.length !== 8 || !parts.every(part => /^[0-9a-f]{1,4}$/.test(part))) {
        return null;
    }

    return parts.map(part => part.padStart(4, '0'));
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

function getRequestParams(request) {
    return new URL(request.url, 'http://snapdrop.local').searchParams;
}

function getClientIp(request) {
    const forwardedFor = request.headers['x-forwarded-for'];
    const ip = forwardedFor
        ? forwardedFor.split(/\s*,\s*/)[0]
        : request.connection.remoteAddress;

    return normalizeIp(ip);
}

function getRoomInfo(request) {
    const params = getRequestParams(request);
    const requestedScope = params.get('scope');
    const scope = ROOM_SCOPES.has(requestedScope) ? requestedScope : 'auto';
    const ip = getClientIp(request);
    const room = sanitizeRoom(params.get('room'));
    const roomKey = sanitizeRoomKey(params.get('roomKey'));
    const passwordPart = roomKey ? `password:${roomKey}` : 'password:open';
    const visibility = scopedIp(ip, scope);

    return {
        ip,
        room,
        roomKey,
        scope,
        visibility,
        id: `${visibility}|room:${room}|${passwordPart}`
    };
}

const limiter = RateLimit({
	windowMs: 5 * 60 * 1000, // 5 minutes
	max: 100, // Limit each IP to 100 requests per `window` (here, per 5 minutes)
	message: 'Too many requests from this IP Address, please try again after 5 minutes.',
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
})

const app = express();
const port = process.env.PORT || 3000;
const publicRun = process.argv[2];

app.use(limiter);

// ensure correct client ip and not the ip of the reverse proxy is used for rate limiting on render.com
// see https://github.com/express-rate-limit/express-rate-limit#troubleshooting-proxy-issues
app.set('trust proxy', 5);

app.use(express.static('public'));

app.use(function(req, res) {
    res.redirect('/');
});

const server = http.createServer(app);

if (publicRun == 'public') {
    server.listen(port);
} else {
    server.listen(port, '0.0.0.0');
}

const parser = require('ua-parser-js');
const { uniqueNamesGenerator, animals, colors } = require('unique-names-generator');

class SnapdropServer {

    constructor() {
        const WebSocket = require('ws');
        this._wss = new WebSocket.Server({ server });
        this._wss.on('connection', (socket, request) => this._onConnection(new Peer(socket, request)));
        this._wss.on('headers', (headers, response) => this._onHeaders(headers, response));

        this._rooms = {};

        console.log('Snapdrop is running on port', port);
    }

    _onConnection(peer) {
        this._joinRoom(peer);
        peer.socket.on('message', message => this._onMessage(peer, message));
        this._keepAlive(peer);

        // send displayName
        this._send(peer, {
            type: 'display-name',
            message: {
                displayName: peer.name.displayName,
                deviceName: peer.name.deviceName
            }
        });
    }

    _onHeaders(headers, response) {
        if (response.headers.cookie && response.headers.cookie.indexOf('peerid=') > -1) return;
        response.peerId = Peer.uuid();
        headers.push('Set-Cookie: peerid=' + response.peerId + "; SameSite=Strict; Secure");
    }

    _onMessage(sender, message) {
        // Try to parse message 
        try {
            message = JSON.parse(message);
        } catch (e) {
            return; // TODO: handle malformed JSON
        }

        switch (message.type) {
            case 'disconnect':
                this._leaveRoom(sender);
                break;
            case 'pong':
                sender.lastBeat = Date.now();
                break;
        }

        // Relay WebRTC signaling only. File and text payloads must stay peer-to-peer.
        if (message.type === 'signal' && message.to && this._rooms[sender.room.id]) {
            const recipientId = message.to; // TODO: sanitize
            const recipient = this._rooms[sender.room.id][recipientId];
            delete message.to;
            // add sender id
            message.sender = sender.id;
            this._send(recipient, message);
            return;
        }
    }

    _joinRoom(peer) {
        // if room doesn't exist, create it
        if (!this._rooms[peer.room.id]) {
            this._rooms[peer.room.id] = {};
        }

        // notify all other peers
        for (const otherPeerId in this._rooms[peer.room.id]) {
            const otherPeer = this._rooms[peer.room.id][otherPeerId];
            this._send(otherPeer, {
                type: 'peer-joined',
                peer: peer.getInfo()
            });
        }

        // notify peer about the other peers
        const otherPeers = [];
        for (const otherPeerId in this._rooms[peer.room.id]) {
            otherPeers.push(this._rooms[peer.room.id][otherPeerId].getInfo());
        }

        this._send(peer, {
            type: 'peers',
            peers: otherPeers
        });

        // add peer to room
        this._rooms[peer.room.id][peer.id] = peer;
    }

    _leaveRoom(peer) {
        if (!this._rooms[peer.room.id] || !this._rooms[peer.room.id][peer.id]) return;
        this._cancelKeepAlive(this._rooms[peer.room.id][peer.id]);

        // delete the peer
        delete this._rooms[peer.room.id][peer.id];

        peer.socket.terminate();
        //if room is empty, delete the room
        if (!Object.keys(this._rooms[peer.room.id]).length) {
            delete this._rooms[peer.room.id];
        } else {
            // notify all other peers
            for (const otherPeerId in this._rooms[peer.room.id]) {
                const otherPeer = this._rooms[peer.room.id][otherPeerId];
                this._send(otherPeer, { type: 'peer-left', peerId: peer.id });
            }
        }
    }

    _send(peer, message) {
        if (!peer) return;
        if (this._wss.readyState !== this._wss.OPEN) return;
        message = JSON.stringify(message);
        peer.socket.send(message, error => '');
    }

    _keepAlive(peer) {
        this._cancelKeepAlive(peer);
        var timeout = 30000;
        if (!peer.lastBeat) {
            peer.lastBeat = Date.now();
        }
        if (Date.now() - peer.lastBeat > 2 * timeout) {
            this._leaveRoom(peer);
            return;
        }

        this._send(peer, { type: 'ping' });

        peer.timerId = setTimeout(() => this._keepAlive(peer), timeout);
    }

    _cancelKeepAlive(peer) {
        if (peer && peer.timerId) {
            clearTimeout(peer.timerId);
        }
    }
}



class Peer {

    constructor(socket, request) {
        // set socket
        this.socket = socket;


        // set remote ip
        this.room = getRoomInfo(request);
        this.ip = this.room.ip;

        // set peer id
        this._setPeerId(request)
        // is WebRTC supported ?
        this.rtcSupported = request.url.indexOf('webrtc') > -1;
        // set name 
        this._setName(request);
        // for keepalive
        this.timerId = 0;
        this.lastBeat = Date.now();
    }

    _setPeerId(request) {
        if (request.peerId) {
            this.id = request.peerId;
        } else if (request.headers.cookie) {
            this.id = request.headers.cookie.replace('peerid=', '');
        } else {
            this.id = Peer.uuid();
        }
    }

    toString() {
        return `<Peer id=${this.id} ip=${this.ip} rtcSupported=${this.rtcSupported}>`
    }

    _setName(req) {
        let ua = parser(req.headers['user-agent']);


        let deviceName = '';
        
        if (ua.os && ua.os.name) {
            deviceName = ua.os.name.replace('Mac OS', 'Mac') + ' ';
        }
        
        if (ua.device.model) {
            deviceName += ua.device.model;
        } else {
            deviceName += ua.browser.name;
        }

        if(!deviceName)
            deviceName = 'Unknown Device';

        const displayName = uniqueNamesGenerator({
            length: 2,
            separator: ' ',
            dictionaries: [colors, animals],
            style: 'capital',
            seed: this.id.hashCode()
        })

        this.name = {
            model: ua.device.model,
            os: ua.os.name,
            browser: ua.browser.name,
            type: ua.device.type,
            deviceName,
            displayName
        };
    }

    getInfo() {
        return {
            id: this.id,
            name: this.name,
            rtcSupported: this.rtcSupported
        }
    }

    // return uuid of form xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    static uuid() {
        let uuid = '',
            ii;
        for (ii = 0; ii < 32; ii += 1) {
            switch (ii) {
                case 8:
                case 20:
                    uuid += '-';
                    uuid += (Math.random() * 16 | 0).toString(16);
                    break;
                case 12:
                    uuid += '-';
                    uuid += '4';
                    break;
                case 16:
                    uuid += '-';
                    uuid += (Math.random() * 4 | 8).toString(16);
                    break;
                default:
                    uuid += (Math.random() * 16 | 0).toString(16);
            }
        }
        return uuid;
    };
}

Object.defineProperty(String.prototype, 'hashCode', {
  value: function() {
    var hash = 0, i, chr;
    for (i = 0; i < this.length; i++) {
      chr   = this.charCodeAt(i);
      hash  = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
    }
    return hash;
  }
});

new SnapdropServer();
