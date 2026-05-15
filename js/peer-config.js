// ============================================================
// FILE: js/peer-config.js
// PURPOSE: Shared PeerJS ICE config for all multiplayer modes.
// Without TURN, cross-network connections (mobile, GitHub Pages)
// fail silently after STUN can't punch through NAT.
// ============================================================

export const PEER_CONFIG = {
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            {
                urls: 'turn:a.relay.metered.ca:80',
                username: '092aacf00c972afac91d92f4',
                credential: 'pUyw+U7S0SLkYwh3'
            },
            {
                urls: 'turn:a.relay.metered.ca:80?transport=tcp',
                username: '092aacf00c972afac91d92f4',
                credential: 'pUyw+U7S0SLkYwh3'
            },
            {
                urls: 'turn:a.relay.metered.ca:443',
                username: '092aacf00c972afac91d92f4',
                credential: 'pUyw+U7S0SLkYwh3'
            },
            {
                urls: 'turn:a.relay.metered.ca:443?transport=tcp',
                username: '092aacf00c972afac91d92f4',
                credential: 'pUyw+U7S0SLkYwh3'
            }
        ]
    }
};