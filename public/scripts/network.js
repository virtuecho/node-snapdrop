window.URL = window.URL || window.webkitURL;
window.isRtcSupported = !!(window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection);

class RoomSettings {

    static get() {
        if (!this._settings) {
            this._settings = this._load();
        }

        return { ...this._settings };
    }

    static save(settings) {
        const current = this.get();
        const next = {
            room: this._normalizeRoom(settings.room),
            scope: this._normalizeScope(settings.scope),
            roomKey: settings.clearPassword ? '' : current.roomKey,
            version: 2
        };

        if (settings.password) {
            next.roomKey = this._hashPassword(settings.password);
        }

        this._settings = next;
        this._store(next);
        this._syncUrl(next);
        Events.fire('room-settings-updated', next);
        Events.fire('room-settings-changed', next);
    }

    static label(settings = this.get()) {
        const room = settings.room || 'default';
        const range = this.scopeLabel(settings.scope);
        const lock = settings.roomKey ? 'locked' : 'open';
        return `Room ${room} - ${range} - ${lock}`;
    }

    static scopeLabel(scope) {
        switch (scope) {
            case 'auto':
                return 'automatic';
            case 'subnet':
                return 'subnet';
            case 'wide':
                return 'wide subnet';
            default:
                return 'same IP';
        }
    }

    static queryString() {
        const settings = this.get();
        const params = new URLSearchParams();
        params.set('scope', settings.scope);
        params.set('room', settings.room || 'default');

        if (settings.roomKey) {
            params.set('roomKey', settings.roomKey);
        }

        return `?${params}`;
    }

    static _load() {
        let settings = {
            room: 'default',
            roomKey: '',
            scope: 'auto',
            version: 2
        };
        let stored = null;

        try {
            stored = JSON.parse(localStorage.getItem('snapdrop-room-settings'));
            settings = { ...settings, ...stored };
        } catch (e) {
            // Ignore malformed local settings.
        }

        if (stored && !stored.version && stored.room === 'default' && stored.scope === 'ip' && !stored.roomKey) {
            settings.scope = 'auto';
        }

        const params = new URLSearchParams(location.search);
        if (params.has('room')) {
            settings.room = params.get('room');
        }
        if (params.has('scope')) {
            settings.scope = params.get('scope');
        }

        settings.room = this._normalizeRoom(settings.room);
        settings.scope = this._normalizeScope(settings.scope);
        settings.roomKey = this._normalizeRoomKey(settings.roomKey);
        settings.version = 2;
        this._store(settings);
        this._syncUrl(settings);

        return settings;
    }

    static _store(settings) {
        try {
            localStorage.setItem('snapdrop-room-settings', JSON.stringify(settings));
        } catch (e) {
            // Storage can be disabled; the current page still keeps settings in memory.
        }
    }

    static _syncUrl(settings) {
        const url = new URL(location.href);

        if (settings.room && settings.room !== 'default') {
            url.searchParams.set('room', settings.room);
        } else {
            url.searchParams.delete('room');
        }

        if (settings.scope && settings.scope !== 'auto') {
            url.searchParams.set('scope', settings.scope);
        } else {
            url.searchParams.delete('scope');
        }

        url.searchParams.delete('roomKey');
        history.replaceState({}, document.title, url.pathname + url.search + url.hash);
    }

    static _normalizeRoom(room) {
        const normalized = String(room || 'default')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9._-]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 64);

        return normalized || 'default';
    }

    static _normalizeRoomKey(roomKey) {
        return String(roomKey || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9:._-]+/g, '')
            .slice(0, 96);
    }

    static _normalizeScope(scope) {
        return ['auto', 'ip', 'subnet', 'wide'].includes(scope) ? scope : 'auto';
    }

    static _hashPassword(password) {
        let first = 0x811c9dc5;
        let second = 0x45d9f3b;
        const input = unescape(encodeURIComponent(String(password)));

        for (let i = 0; i < input.length; i++) {
            const char = input.charCodeAt(i);
            first ^= char;
            first = Math.imul(first, 16777619);
            second ^= char + i;
            second = Math.imul(second, 2246822507);
        }

        return `v1:${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`;
    }
}

class ServerConnection {

    constructor() {
        this._connect();
        Events.on('beforeunload', e => this._disconnect());
        Events.on('pagehide', e => this._disconnect());
        Events.on('room-settings-changed', e => this.reconnect());
        document.addEventListener('visibilitychange', e => this._onVisibilityChange());
    }

    _connect() {
        clearTimeout(this._reconnectTimer);
        if (this._isConnected() || this._isConnecting()) return;
        const ws = new WebSocket(this._endpoint());
        ws.binaryType = 'arraybuffer';
        ws.onopen = e => console.log('WS: server connected');
        ws.onmessage = e => this._onMessage(e.data);
        ws.onclose = e => this._onDisconnect();
        ws.onerror = e => console.error(e);
        this._socket = ws;
    }

    _onMessage(msg) {
        msg = JSON.parse(msg);
        console.log('WS:', msg);
        switch (msg.type) {
            case 'peers':
                Events.fire('peers', msg.peers);
                break;
            case 'peer-joined':
                Events.fire('peer-joined', msg.peer);
                break;
            case 'peer-left':
                Events.fire('peer-left', msg.peerId);
                break;
            case 'signal':
                Events.fire('signal', msg);
                break;
            case 'ping':
                this.send({ type: 'pong' });
                break;
            case 'display-name':
                Events.fire('display-name', msg);
                break;
            default:
                console.error('WS: unkown message type', msg);
        }
    }

    send(message) {
        if (!this._isConnected()) return;
        this._socket.send(JSON.stringify(message));
    }

    _endpoint() {
        // hack to detect if deployment or development environment
        const protocol = location.protocol.startsWith('https') ? 'wss' : 'ws';
        const webrtc = window.isRtcSupported ? '/webrtc' : '/fallback';
        const url = protocol + '://' + location.host + location.pathname + 'server' + webrtc + RoomSettings.queryString();
        return url;
    }

    _disconnect() {
        if (!this._socket) return;
        this.send({ type: 'disconnect' });
        this._socket.onclose = null;
        this._socket.close();
        this._socket = null;
    }

    reconnect() {
        clearTimeout(this._reconnectTimer);
        Events.fire('peers', []);
        this._disconnect();
        this._connect();
    }

    _onDisconnect() {
        console.log('WS: server disconnected');
        Events.fire('notify-user', 'Connection lost. Retry in 5 seconds...');
        clearTimeout(this._reconnectTimer);
        this._reconnectTimer = setTimeout(_ => this._connect(), 5000);
    }

    _onVisibilityChange() {
        if (document.hidden) return;
        this._connect();
    }

    _isConnected() {
        return this._socket && this._socket.readyState === this._socket.OPEN;
    }

    _isConnecting() {
        return this._socket && this._socket.readyState === this._socket.CONNECTING;
    }
}

class Peer {

    constructor(serverConnection, peerId) {
        this._server = serverConnection;
        this._peerId = peerId;
        this._filesQueue = [];
        this._busy = false;
    }

    sendJSON(message) {
        this._send(JSON.stringify(message));
    }

    sendFiles(files) {
        for (let i = 0; i < files.length; i++) {
            this._filesQueue.push(files[i]);
        }
        if (this._busy) return;
        this._dequeueFile();
    }

    _dequeueFile() {
        if (!this._filesQueue.length) return;
        this._busy = true;
        const file = this._filesQueue.shift();
        this._sendFile(file);
    }

    _sendFile(file) {
        this.sendJSON({
            type: 'header',
            name: file.name,
            mime: file.type,
            size: file.size
        });
        this._chunker = new FileChunker(file,
            chunk => this._send(chunk),
            offset => this._onPartitionEnd(offset));
        this._chunker.nextPartition();
    }

    _onPartitionEnd(offset) {
        this.sendJSON({ type: 'partition', offset: offset });
    }

    _onReceivedPartitionEnd(offset) {
        this.sendJSON({ type: 'partition-received', offset: offset });
    }

    _sendNextPartition() {
        if (!this._chunker || this._chunker.isFileEnd()) return;
        this._chunker.nextPartition();
    }

    _sendProgress(progress) {
        this.sendJSON({ type: 'progress', progress: progress });
    }

    _onMessage(message) {
        if (typeof message !== 'string') {
            this._onChunkReceived(message);
            return;
        }
        message = JSON.parse(message);
        console.log('RTC:', message);
        switch (message.type) {
            case 'header':
                this._onFileHeader(message);
                break;
            case 'partition':
                this._onReceivedPartitionEnd(message);
                break;
            case 'partition-received':
                this._sendNextPartition();
                break;
            case 'progress':
                this._onDownloadProgress(message.progress);
                break;
            case 'transfer-complete':
                this._onTransferCompleted();
                break;
            case 'text':
                this._onTextReceived(message);
                break;
        }
    }

    _onFileHeader(header) {
        this._lastProgress = 0;
        this._digester = new FileDigester({
            name: header.name,
            mime: header.mime,
            size: header.size
        }, file => this._onFileReceived(file));
    }

    _onChunkReceived(chunk) {
        if(!chunk.byteLength) return;
        
        this._digester.unchunk(chunk);
        const progress = this._digester.progress;
        this._onDownloadProgress(progress);

        // occasionally notify sender about our progress 
        if (progress - this._lastProgress < 0.01) return;
        this._lastProgress = progress;
        this._sendProgress(progress);
    }

    _onDownloadProgress(progress) {
        Events.fire('file-progress', { sender: this._peerId, progress: progress });
    }

    _onFileReceived(proxyFile) {
        Events.fire('file-received', proxyFile);
        this.sendJSON({ type: 'transfer-complete' });
    }

    _onTransferCompleted() {
        this._onDownloadProgress(1);
        this._reader = null;
        this._busy = false;
        this._dequeueFile();
        Events.fire('notify-user', 'File transfer completed.');
    }

    sendText(text) {
        const unescaped = btoa(unescape(encodeURIComponent(text)));
        this.sendJSON({ type: 'text', text: unescaped });
    }

    _onTextReceived(message) {
        const escaped = decodeURIComponent(escape(atob(message.text)));
        Events.fire('text-received', { text: escaped, sender: this._peerId });
    }
}

class RTCPeer extends Peer {

    constructor(serverConnection, peerId) {
        super(serverConnection, peerId);
        this._candidateTypes = {
            local: new Set(),
            remote: new Set()
        };
        this._diagnostics = {
            error: '',
            gatheringState: 'new',
            iceState: 'new',
            localCandidates: 0,
            remoteCandidates: 0
        };
        this._isCaller = false;
        this._isClosing = false;
        this._failureNoticeShown = false;
        this._makingOffer = false;
        this._pendingNoticeShown = false;
        this._pendingMessages = [];
        this._restartTimer = 0;
        this._signalQueue = Promise.resolve();
        if (!peerId) return; // we will listen for a caller
        this._connect(peerId, true);
    }

    _connect(peerId, isCaller) {
        this._isCaller = isCaller;
        this._peerId = peerId;

        if (this._conn && this._conn.signalingState !== 'closed') return;

        this._openConnection(peerId, isCaller);
    }

    _openConnection(peerId, isCaller) {
        this._isCaller = isCaller;
        this._peerId = peerId;
        this._makingOffer = false;
        this._lastRemoteAnswer = null;
        this._lastRemoteOffer = null;
        this._conn = new RTCPeerConnection(RTCPeer.config);
        this._conn.onicecandidate = e => this._onIceCandidate(e);
        this._conn.onconnectionstatechange = e => this._onConnectionStateChange(e);
        this._conn.onicegatheringstatechange = e => this._onIceGatheringStateChange(e);
        this._conn.oniceconnectionstatechange = e => this._onIceConnectionStateChange(e);
        this._resetDiagnostics();

        if (isCaller) {
            this._openChannel();
        } else {
            this._conn.ondatachannel = e => this._onChannelOpened(e);
        }
    }

    _openChannel() {
        if (this._channel && this._channel.readyState !== 'closed') return;
        const channel = this._conn.createDataChannel('data-channel', { 
            ordered: true,
            reliable: true // Obsolete. See https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel/reliable
        });
        this._channel = channel;
        channel.binaryType = 'arraybuffer';
        channel.onopen = e => this._onChannelOpened(e);
        channel.onclose = e => this._onChannelClosed(channel);
        this._createOffer();
    }

    _createOffer() {
        if (!this._conn || this._makingOffer || this._conn.signalingState !== 'stable') return;
        this._makingOffer = true;
        const conn = this._conn;

        conn.createOffer()
            .then(description => this._onDescription(description, conn))
            .catch(e => this._onError(e))
            .finally(() => {
                if (conn === this._conn) {
                    this._makingOffer = false;
                }
            });
    }

    _onDescription(description, conn = this._conn) {
        if (!conn || conn !== this._conn || conn.signalingState === 'closed') return Promise.resolve();
        // description.sdp = description.sdp.replace('b=AS:30', 'b=AS:1638400');
        return conn.setLocalDescription(description)
            .then(_ => {
                if (conn !== this._conn) return;
                this._sendSignal({ sdp: conn.localDescription || description });
            })
            .catch(e => this._onError(e));
    }

    _onIceCandidate(event) {
        if (!event.candidate) {
            this._diagnostics.gatheringState = this._conn ? this._conn.iceGatheringState : this._diagnostics.gatheringState;
            return;
        }
        this._diagnostics.localCandidates += 1;
        this._trackCandidateType('local', event.candidate.candidate);
        this._sendSignal({ ice: event.candidate });
    }

    onServerMessage(message) {
        this._signalQueue = this._signalQueue
            .then(() => this._onServerMessage(message))
            .catch(e => this._onError(e));
    }

    _onServerMessage(message) {
        if (!this._conn) this._connect(message.sender, false);

        if (message.sdp) {
            return this._onRemoteDescription(message);
        } else if (message.ice) {
            return this._onRemoteIce(message);
        }

        return Promise.resolve();
    }

    _onRemoteDescription(message) {
        const description = new RTCSessionDescription(message.sdp);
        const fingerprint = description.sdp || `${description.type}:${message.sender}`;

        if (description.type === 'offer') {
            if (this._isCaller) return Promise.resolve();
            if (this._lastRemoteOffer === fingerprint && this._conn.signalingState === 'stable') return Promise.resolve();
            this._lastRemoteOffer = fingerprint;
            if (this._conn.signalingState !== 'stable') return Promise.resolve();

            return this._conn.setRemoteDescription(description)
                .then(_ => this._conn.createAnswer())
                .then(answer => {
                    if (!this._conn || this._conn.signalingState !== 'have-remote-offer') return;
                    return this._onDescription(answer);
                });
        }

        if (description.type === 'answer') {
            if (this._lastRemoteAnswer === fingerprint && this._conn.signalingState === 'stable') return Promise.resolve();
            this._lastRemoteAnswer = fingerprint;
            if (this._conn.signalingState !== 'have-local-offer') return Promise.resolve();
            return this._conn.setRemoteDescription(description);
        }

        return Promise.resolve();
    }

    _onRemoteIce(message) {
        if (!this._conn || this._conn.signalingState === 'closed') return Promise.resolve();

        this._diagnostics.remoteCandidates += 1;
        this._trackCandidateType('remote', message.ice.candidate);
        return this._conn.addIceCandidate(new RTCIceCandidate(message.ice))
            .catch(error => {
                if (this._conn && this._conn.signalingState !== 'closed') {
                    this._onError(error);
                }
            });
    }

    _onChannelOpened(event) {
        console.log('RTC: channel opened with', this._peerId);
        const channel = event.channel || event.target;
        channel.onmessage = e => this._onMessage(e.data);
        channel.onclose = e => this._onChannelClosed(channel);
        this._channel = channel;
        this._failureNoticeShown = false;
        this._pendingNoticeShown = false;
        this._setPeerStatus('');
        clearTimeout(this._restartTimer);
        this._restartTimer = 0;
        this._flushPendingMessages();
    }

    _onChannelClosed(channel) {
        if (channel && channel !== this._channel) return;
        console.log('RTC: channel closed', this._peerId);
        this._channel = null;
        if (this._isClosing || !this._isCaller) return;
        this._scheduleReconnect();
    }

    _onConnectionStateChange(e) {
        if (e.target && e.target !== this._conn) return;
        console.log('RTC: state changed:', this._conn.connectionState);
        switch (this._conn.connectionState) {
            case 'disconnected':
                this._scheduleReconnect(3000);
                break;
            case 'failed':
                if (!this._failureNoticeShown) {
                    this._failureNoticeShown = true;
                    this._reportConnectionFailure();
                }
                this._scheduleReconnect();
                break;
        }
    }

    _onIceGatheringStateChange() {
        if (!this._conn) return;
        this._diagnostics.gatheringState = this._conn.iceGatheringState;
    }

    _onIceConnectionStateChange() {
        if (!this._conn) return;
        this._diagnostics.iceState = this._conn.iceConnectionState;
        switch (this._conn.iceConnectionState) {
            case 'failed':
                console.error('ICE Gathering failed');
                if (!this._failureNoticeShown) {
                    this._failureNoticeShown = true;
                    this._reportConnectionFailure();
                }
                break;
            default:
                console.log('ICE Gathering', this._conn.iceConnectionState);
        }
    }

    _onError(error) {
        this._diagnostics.error = error && error.message ? error.message : String(error);
        console.error(error);
    }

    _send(message) {
        if (!this._isConnected()) {
            this._pendingMessages.push(message);
            this._failureNoticeShown = false;
            this.refresh();
            if (!this._pendingNoticeShown) {
                this._pendingNoticeShown = true;
                this._setPeerStatus('Connecting...');
                Events.fire('notify-user', 'Connecting to peer...');
            }
            return;
        }

        this._channel.send(message);
    }

    _flushPendingMessages() {
        while (this._pendingMessages.length && this._isConnected()) {
            this._channel.send(this._pendingMessages.shift());
        }
    }

    _sendSignal(signal) {
        signal.type = 'signal';
        signal.to = this._peerId;
        this._server.send(signal);
    }

    refresh() {
        // check if channel is open. otherwise create one
        if (this._isConnected() || this._isConnecting()) return;
        if (!this._isCaller) return;
        this._scheduleReconnect(0);
    }

    _scheduleReconnect(delay = 1000) {
        if (!this._isCaller || this._restartTimer) return;
        this._restartTimer = setTimeout(_ => {
            this._restartTimer = 0;
            if (this._isConnected() || this._isConnecting()) return;
            this._restart();
        }, delay);
    }

    _restart() {
        if (!this._isCaller) return;
        this._closeConnection();
        this._openConnection(this._peerId, true);
    }

    _closeConnection() {
        this._isClosing = true;
        this._makingOffer = false;

        if (this._channel) {
            this._channel.onclose = null;
            this._channel.onmessage = null;
            try {
                this._channel.close();
            } catch (e) {
                // Already closed.
            }
        }

        if (this._conn) {
            this._conn.onconnectionstatechange = null;
            this._conn.ondatachannel = null;
            this._conn.onicecandidate = null;
            this._conn.onicegatheringstatechange = null;
            this._conn.oniceconnectionstatechange = null;
            try {
                this._conn.close();
            } catch (e) {
                // Already closed.
            }
        }

        this._channel = null;
        this._conn = null;
        this._isClosing = false;
    }

    _isConnected() {
        return this._channel && this._channel.readyState === 'open';
    }

    _isConnecting() {
        if (this._channel && this._channel.readyState === 'connecting') return true;
        if (!this._conn) return false;
        return this._conn.connectionState === 'new' || this._conn.connectionState === 'connecting';
    }

    _resetDiagnostics() {
        this._candidateTypes = {
            local: new Set(),
            remote: new Set()
        };
        this._diagnostics = {
            error: '',
            gatheringState: this._conn ? this._conn.iceGatheringState : 'new',
            iceState: this._conn ? this._conn.iceConnectionState : 'new',
            localCandidates: 0,
            remoteCandidates: 0
        };
    }

    _trackCandidateType(side, candidate) {
        const match = String(candidate || '').match(/\btyp\s+([a-z0-9-]+)/i);
        if (match) {
            this._candidateTypes[side].add(match[1]);
        }
    }

    _connectionFailureReason() {
        const localTypes = Array.from(this._candidateTypes.local);
        const remoteTypes = Array.from(this._candidateTypes.remote);

        if (!this._diagnostics.localCandidates) {
            return 'No local ICE candidates. Browser WebRTC or UDP may be blocked.';
        }

        if (!this._diagnostics.remoteCandidates) {
            return 'No remote ICE candidates. The other device may be blocking WebRTC or disconnected.';
        }

        if (!localTypes.includes('host') && !remoteTypes.includes('host')) {
            return 'No LAN candidates were exchanged. Proxy, VPN, or browser privacy settings may be hiding local addresses.';
        }

        if (this._diagnostics.iceState === 'disconnected' || this._diagnostics.iceState === 'failed') {
            return 'ICE could not find a direct peer-to-peer route. AP isolation, VPN/TUN, firewall, or different network segments may be blocking UDP.';
        }

        if (this._diagnostics.error) {
            return this._diagnostics.error;
        }

        return 'Peer-to-peer connection failed before the data channel opened.';
    }

    _reportConnectionFailure() {
        const reason = this._connectionFailureReason();
        const detail = {
            error: this._diagnostics.error,
            gatheringState: this._diagnostics.gatheringState,
            iceState: this._diagnostics.iceState,
            localCandidateTypes: Array.from(this._candidateTypes.local),
            localCandidates: this._diagnostics.localCandidates,
            peerId: this._peerId,
            reason,
            remoteCandidateTypes: Array.from(this._candidateTypes.remote),
            remoteCandidates: this._diagnostics.remoteCandidates,
            state: this._conn ? this._conn.connectionState : 'closed'
        };

        this._setPeerStatus(`WebRTC failed: ${reason}`);
        console.warn('RTC: connection failed', detail);
        Events.fire('webrtc-failed', detail);
        Events.fire('notify-user', `WebRTC failed: ${reason}`);
    }

    _setPeerStatus(status) {
        Events.fire('peer-status', {
            peerId: this._peerId,
            status
        });
    }
}

class PeersManager {

    constructor(serverConnection) {
        this.peers = {};
        this._server = serverConnection;
        Events.on('signal', e => this._onMessage(e.detail));
        Events.on('peers', e => this._onPeers(e.detail));
        Events.on('files-selected', e => this._onFilesSelected(e.detail));
        Events.on('send-text', e => this._onSendText(e.detail));
        Events.on('peer-left', e => this._onPeerLeft(e.detail));
        Events.on('room-settings-changed', e => this._resetPeers());
    }

    _onMessage(message) {
        if (!window.isRtcSupported) {
            Events.fire('notify-user', 'This browser cannot make a peer-to-peer connection.');
            return;
        }

        if (!this.peers[message.sender]) {
            this.peers[message.sender] = new RTCPeer(this._server);
        }
        this.peers[message.sender].onServerMessage(message);
    }

    _onPeers(peers) {
        peers.forEach(peer => {
            if (this.peers[peer.id]) {
                this.peers[peer.id].refresh();
                return;
            }
            if (window.isRtcSupported && peer.rtcSupported) {
                this.peers[peer.id] = new RTCPeer(this._server, peer.id);
            } else {
                Events.fire('notify-user', 'This browser cannot make a peer-to-peer connection.');
            }
        })
    }

    sendTo(peerId, message) {
        this.peers[peerId].send(message);
    }

    _onFilesSelected(message) {
        this.peers[message.to].sendFiles(message.files);
    }

    _onSendText(message) {
        this.peers[message.to].sendText(message.text);
    }

    _onPeerLeft(peerId) {
        const peer = this.peers[peerId];
        delete this.peers[peerId];
        if (!peer || !peer._peer) return;
        peer._peer.close();
    }

    _resetPeers() {
        this.peers = {};
        Events.fire('peers', []);
    }

}

class FileChunker {

    constructor(file, onChunk, onPartitionEnd) {
        this._chunkSize = 64000; // 64 KB
        this._maxPartitionSize = 1e6; // 1 MB
        this._offset = 0;
        this._partitionSize = 0;
        this._file = file;
        this._onChunk = onChunk;
        this._onPartitionEnd = onPartitionEnd;
        this._reader = new FileReader();
        this._reader.addEventListener('load', e => this._onChunkRead(e.target.result));
    }

    nextPartition() {
        this._partitionSize = 0;
        this._readChunk();
    }

    _readChunk() {
        const chunk = this._file.slice(this._offset, this._offset + this._chunkSize);
        this._reader.readAsArrayBuffer(chunk);
    }

    _onChunkRead(chunk) {
        this._offset += chunk.byteLength;
        this._partitionSize += chunk.byteLength;
        this._onChunk(chunk);
        if (this._isPartitionEnd() || this.isFileEnd()) {
            this._onPartitionEnd(this._offset);
            return;
        }
        this._readChunk();
    }

    repeatPartition() {
        this._offset -= this._partitionSize;
        this._nextPartition();
    }

    _isPartitionEnd() {
        return this._partitionSize >= this._maxPartitionSize;
    }

    isFileEnd() {
        return this._offset >= this._file.size;
    }

    get progress() {
        return this._offset / this._file.size;
    }
}

class FileDigester {

    constructor(meta, callback) {
        this._buffer = [];
        this._bytesReceived = 0;
        this._size = meta.size;
        this._mime = meta.mime || 'application/octet-stream';
        this._name = meta.name;
        this._callback = callback;
    }

    unchunk(chunk) {
        this._buffer.push(chunk);
        this._bytesReceived += chunk.byteLength || chunk.size;
        const totalChunks = this._buffer.length;
        this.progress = this._bytesReceived / this._size;
        if (isNaN(this.progress)) this.progress = 1

        if (this._bytesReceived < this._size) return;
        // we are done
        let blob = new Blob(this._buffer, { type: this._mime });
        this._callback({
            name: this._name,
            mime: this._mime,
            size: this._size,
            blob: blob
        });
    }

}

class Events {
    static fire(type, detail) {
        window.dispatchEvent(new CustomEvent(type, { detail: detail }));
    }

    static on(type, callback) {
        return window.addEventListener(type, callback, false);
    }
}


RTCPeer.config = {
    'sdpSemantics': 'unified-plan',
    'iceServers': [{
        urls: 'stun:stun.l.google.com:19302'
    }]
}
