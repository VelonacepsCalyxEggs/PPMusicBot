import get from 'axios';
import { logError } from './loggerUtil';
    
export default async function checkDiscordStatus(): Promise<string> {
    try {
        const response = await get('https://discordstatus.com/api/v2/status.json');
        const status = response.data.status.description;
        return status;
    } catch (error) {
        logError(error, 'Error fetching Discord status:');
        return 'Error fetching status';
    }
}