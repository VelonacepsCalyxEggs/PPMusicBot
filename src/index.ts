import dotenv from 'dotenv';
dotenv.config({path: `./.env.${process.env.NODE_ENV || 'development'}`});
import { 
    logError,
    discordLogger,
    closeLogger,
} from './utils/loggerUtil';
import { AtGrokIsThisTrueService } from './services/atGrokIsThisTrueService';
import { NetworkFileService } from './services/networkFileService';
import { DIContainer } from './classes/diContainer';
import { ClientManager } from './classes/managers/clientManager';
import { DatabaseManager } from './classes/managers/databaseManager';
import { PlayerManager } from './classes/managers/playerManager';
import { Player } from 'discord-player/dist';


class BotApplication {
    private clientManager: ClientManager
    private playerManager: PlayerManager;
    private databaseManager: DatabaseManager;
    private diContainer: DIContainer;

    constructor() {
        this.diContainer = new DIContainer();
        this.clientManager = new ClientManager();
        this.playerManager = new PlayerManager();
        this.databaseManager = new DatabaseManager();
    }

    private async setupDependencyInjection(): Promise<void> {
        discordLogger.info('Setting up dependency injection...');
        const DatabasePoolWrapper = this.databaseManager.getPoolWrapper();
        this.diContainer.register('DatabasePool', DatabasePoolWrapper, [], true);
        this.diContainer.register('AtGrokIsThisTrueService', AtGrokIsThisTrueService, [], true);
        this.diContainer.register('NetworkFileService', NetworkFileService, [], true);

        await this.diContainer.initialize();
        discordLogger.info('Dependency injection setup complete.');
    }
 
    private setupGlobalErrorHandlers() {
        // Handle unhandled promise rejections
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
        process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
            console.error('Unhandled Rejection:', reason);
            
            // Try to log but don't crash if logging fails
            try {
                if (reason && typeof reason === 'object' && 'message' in reason) {
                    const error = reason as Error;
                    // Don't log YouTube connection errors as they're temporary
                    if (!error.message.includes('fetch failed') && 
                        !error.message.includes('ECONNRESET') && 
                        !error.message.includes('youtubei')) {
                        logError(error, 'unhandled_rejection');
                    }
                }
            } catch (logErr) {
                console.error('Failed to log unhandled rejection:', logErr);
            }
        });

        // Handle uncaught exceptions
        process.on('uncaughtException', (error: Error) => {
            console.error('Uncaught Exception:', error);
            
            // Don't try to log the winston "write after end" errors
            if (!error.message.includes('write after end')) {
                try {
                    discordLogger.error('Uncaught Exception:', error);
                } catch (logErr) {
                    console.error('Failed to log uncaught exception:', logErr);
                }
            }
            
            this.gracefulShutdown();
        });

        // Handle SIGINT (Ctrl+C)
        process.on('SIGINT', () => {
            try {
                discordLogger.info('Received SIGINT, shutting down gracefully...');
            } catch (err) {
                console.error('Failed to log SIGINT:', err);
            }
            this.gracefulShutdown();
        });

        // Handle SIGTERM
        process.on('SIGTERM', () => {
            try {
                discordLogger.info('Received SIGTERM, shutting down gracefully...');
            } catch (err) {
                console.error('Failed to log SIGTERM:', err);
            }
            this.gracefulShutdown();
        });
    }

    private gracefulShutdown() {
        discordLogger.info('Initiating graceful shutdown...');
        // Save active queue states before shutdown, so we can restore them later
        if (this.clientManager instanceof ClientManager &&
             this.playerManager instanceof PlayerManager &&
              this.playerManager.player instanceof Player) {
        this.clientManager.saveActiveQueueStates(this.playerManager.player);
        }
        closeLogger();
        
        if (this.clientManager.client) {
            this.clientManager.client.destroy();
        }
        
        // Give time for cleanup
        setTimeout(() => {
            process.exit(0);
        }, 1000);
    }

    public async run() {
        this.setupGlobalErrorHandlers();

        await this.databaseManager.init();
        await this.setupDependencyInjection();

        this.clientManager.setDiContainer(this.diContainer);
        await this.clientManager.init();

        this.playerManager.setClient(this.clientManager.client);
        await this.playerManager.init();
        this.clientManager.setPlayer(this.playerManager.player);

        await this.clientManager.login();
    }
}

async function startBot() {
    const bot = new BotApplication();
    try {
        await bot.run();
    }
    catch (error) {
        logError(error as Error, 'Bot runtime', { message: 'Bot process failed.' });
        discordLogger.error(`Bot exited with error: ${error}`);
    }

}

// Start the bot (duh)
startBot();

//TODOS:
// - Separate the youtube download logic into a separate worker proccess. - done
// - Make play command more structured. - done
// - Add more QoL to existing commands. - in progress
// - Event listener for voice connection state changes (the bot voice connection, in case there is a timeout).
// - This might be impossible without modifying the discord-player library?
// - Make services use the proper dependency injection pattern. - Done
// - Make atGrok service a separate command instead of a message listener. 
// - Probably not possible, since you can't 'reply' with a command.
//   not sure if this is a good idea since it will lose the premise... but... oh well...\
//   still better than a message listener.
// - Make this use prisma instead of pg directly.
// - Make NetworkFileService a proper extractor
// - Make YTDLFallback have more flexibility.
// - Make a proper service/class to handle Icecast streams.
// - Backup active queues before shutdown. - Done but kinda scuffed? Metadata storage method needs to be reworked.
// - Add Spotify support.