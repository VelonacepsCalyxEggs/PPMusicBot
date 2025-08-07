import { Pool } from "pg";
import { databaseLogger } from "../../utils/loggerUtil";
export class DatabasePoolWrapper {
    public pool: Pool;

    constructor(pool: Pool) {
        this.pool = pool;
    }
}
export class DatabaseManager {
    public pool: Pool;

    public async init() {
        databaseLogger.info('Loading DB config...');
        if (!process.env.DATABASE_URL) {
            throw new Error('DATABASE_URL environment variable is not set.');
        }
        this.pool = new Pool({connectionString: process.env.DATABASE_URL || 'postgres://user:password@localhost:5432/mydatabase'});
        databaseLogger.info('Connecting to DB...');
        this.pool.connect();
    }


    public getPoolWrapper() {
        const poolInstance = this.pool;
        return class DatabasePoolWrapper {
            public pool: Pool;
            constructor() {
                this.pool = poolInstance;
            }
        };
    }
}