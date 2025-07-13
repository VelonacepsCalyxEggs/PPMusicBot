    export default function formatDuration(ms: number): string {
        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);

        const secondsFormatted = seconds < 10 ? '0' + seconds : seconds;
        const minutesFormatted = minutes < 10 ? '0' + minutes : minutes;

        if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
            return "∞";
        }
        if (hours > 0) {
            return `${hours}:${minutesFormatted}:${secondsFormatted}`;
        }
        else {
            return `${minutes}:${secondsFormatted}`;
        }
    }