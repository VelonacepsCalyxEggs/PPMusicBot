export interface ServiceConstructor<T = object> {
    new (...args: unknown[]): T;
}

export interface ServiceDefinition {
    constructor: ServiceConstructor;
    dependencies?: string[];
    singleton?: boolean;
}

export class DIContainer {
    private services = new Map<string, ServiceDefinition>();
    private instances = new Map<string, unknown>();

    register<T = object>(
        name: string, 
        constructor: ServiceConstructor<T>, 
        dependencies: string[] = [], 
        singleton = true
    ): void {
        this.services.set(name, {
            constructor: constructor as ServiceConstructor,
            dependencies,
            singleton
        });
    }

    get<T>(name: string): T {
        // Return cached instance if singleton
        if (this.instances.has(name)) {
            return this.instances.get(name) as T;
        }

        const service = this.services.get(name);
        if (!service) {
            throw new Error(`Service '${name}' not found`);
        }

        // Resolve dependencies
        const dependencies = service.dependencies?.map(dep => this.get(dep)) || [];
        
        // Create instance
        const instance = new service.constructor(...dependencies);

        // Cache if singleton
        if (service.singleton) {
            this.instances.set(name, instance);
        }

        return instance as T;
    }

    async initialize(): Promise<void> {
        // Initialize all services that have an init method
        for (const [name] of this.services) {
            const instance = this.get(name);
            if (instance && typeof instance === 'object' && 'init' in instance && typeof instance.init === 'function') {
                await instance.init();
            }
        }
    }
}