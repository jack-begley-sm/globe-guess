// ============================================================
// FILE: js/awake.js
// PURPOSE: Prevent the screen from sleeping.
// ============================================================

let wakeLock = null;

export async function requestWakeLock() {
    if (!('wakeLock' in navigator)) {
        console.warn('Wake Lock API not supported');
        return;
    }

    try {
        wakeLock = await navigator.wakeLock.request('screen');
        console.log('Wake Lock acquired');
        
        wakeLock.addEventListener('release', () => {
            console.log('Wake Lock released');
        });
    } catch (err) {
        console.error(`Wake Lock error: ${err.name}, ${err.message}`);
    }
}

export function releaseWakeLock() {
    if (wakeLock) {
        wakeLock.release();
        wakeLock = null;
    }
}

// Re-acquire wake lock when page becomes visible again
document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible') {
        await requestWakeLock();
    }
});
