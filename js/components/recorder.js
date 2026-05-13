/* ============================================
   Audio Recorder - MediaRecorder wrapper
   ============================================ */

class AudioRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.startTime = null;
        this.duration = 0;
        this.stream = null;
        this.recording = false;
        this.wakeLock = null;

        // Re-acquire wake lock when page becomes visible again
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && this.recording) {
                this._requestWakeLock();
            }
        });
    }

    async _requestWakeLock() {
        try {
            this.wakeLock = await navigator.wakeLock.request('screen');
            this.wakeLock.addEventListener('release', () => {
                // Auto re-acquire if still recording
                if (this.recording) this._requestWakeLock();
            });
        } catch {
            // Wake Lock API not supported or denied
        }
    }

    _releaseWakeLock() {
        if (this.wakeLock) {
            try { this.wakeLock.release(); } catch {}
            this.wakeLock = null;
        }
    }

    async start() {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        const mimeType = MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : 'audio/mp4';

        this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
        this.audioChunks = [];
        this.startTime = Date.now();
        this.recording = false;

        this.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) this.audioChunks.push(e.data);
        };

        return new Promise((resolve) => {
            this.mediaRecorder.onstart = () => {
                this.recording = true;
                this._requestWakeLock();
                resolve();
            };
            this.mediaRecorder.start(250);
        });
    }

    stop() {
        return new Promise((resolve) => {
            if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
                resolve({ blob: null, duration: 0 });
                return;
            }

            this.mediaRecorder.onstop = async () => {
                this.recording = false;
                this._releaseWakeLock();
                this.duration = (Date.now() - this.startTime) / 1000;
                const webmBlob = new Blob(this.audioChunks, { type: this.mediaRecorder.mimeType });
                if (this.stream) {
                    this.stream.getTracks().forEach(t => t.stop());
                    this.stream = null;
                }
                const blob = await convertBlobToMp3(webmBlob);
                resolve({ blob, duration: this.duration });
            };

            this.mediaRecorder.stop();
        });
    }

    cancel() {
        this._releaseWakeLock();
        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
            this.stream = null;
        }
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.onstop = null;
            this.mediaRecorder.stop();
        }
        this.recording = false;
        this.audioChunks = [];
    }
}
