export default class ShuffleUtil {
    public static fisherYatesShuffle<T>(item: T[]) {
            for (let i = item.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [item[i], item[j]] = [item[j], item[i]];
            }
            return item;
    }

    public static durstenfeldShuffle<T>(item: T[]) {
            for (let i = item.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    const temp = item[i];
                    item[i] = item[j];
                    item[j] = temp;
            }
            return item;
    }

    public static sattoloShuffle<T>(item: T[]) {
            for (let i = item.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * i);
                    const temp = item[i];
                    item[i] = item[j];
                    item[j] = temp;
            }
            return item;
    }
}