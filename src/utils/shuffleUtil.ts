export default class ShuffleUtil {
    public static fisherYatesShuffle<T>(items: T[]) {
            for (let i = items.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [items[i], items[j]] = [items[j], items[i]];
            }
    }

    public static durstenfeldShuffle<T>(items: T[]) {
            for (let i = items.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    const temp = items[i];
                    items[i] = items[j];
                    items[j] = temp;
            }
    }

    public static sattoloShuffle<T>(items: T[]) {
            for (let i = items.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * i);
                    const temp = items[i];
                    items[i] = items[j];
                    items[j] = temp;
            }
    }
}