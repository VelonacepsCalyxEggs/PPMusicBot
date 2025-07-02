export abstract class ServiceInterface {
    protected serviceName: string;
    protected serviceDescription: string;
    public abstract init(): Promise<void>;
}