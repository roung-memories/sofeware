/* ============================================
   Audio Player - <audio> wrapper
   ============================================ */

class AudioPlayer {
    constructor() {
        this.audio = new Audio();
        this.currentId = null;
        this.onStateChange = null;

        this.audio.onended = () => {
            if (this.onStateChange && this.currentId !== null) {
                this.onStateChange(this.currentId, false);
            }
            this.currentId = null;
        };
    }

    play(recordingId, audioUrl) {
        if (this.currentId === recordingId) {
            this.stop();
            return;
        }
        this.stop();

        this.currentId = recordingId;
        this.audio.src = audioUrl;
        this.audio.play().catch(err => {
            console.error('Playback failed:', err);
            this.currentId = null;
            if (this.onStateChange) this.onStateChange(recordingId, false);
        });

        if (this.onStateChange) {
            this.onStateChange(recordingId, true);
        }
    }

    stop() {
        if (this.currentId !== null) {
            const prevId = this.currentId;
            this.audio.pause();
            this.audio.currentTime = 0;
            this.audio.src = '';
            this.currentId = null;
            if (this.onStateChange) {
                this.onStateChange(prevId, false);
            }
        }
    }

    isPlaying(recordingId) {
        return this.currentId === recordingId && !this.audio.paused;
    }
}
