// This service will query a OpenRouter API endpoint, and return a response from an LLM of choice.

import { discordLogger } from "../utils/loggerUtil";
import { ServiceInterface } from "../types/serviceInterface";
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

// It is designed to mock the '@Grok is this true?' question.
export class AtGrokIsThisTrueService extends ServiceInterface {
    private model: string;
    private apiKey: string;
    private cacheDir: string;
    private imageSupport: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private queryQueues: Map<string, Promise<any>> = new Map();
    constructor() {
        super();
        this.serviceName = 'AtGrokIsThisTrueService';
        this.serviceDescription = 'Service to query "Grok" LLM for "truth" verification.';
    }

    async init() {
        discordLogger.info('Initializing AtGrokIsThisTrueService...');
        
        this.model = process.env.MOCK_GROK_MODEL || 'grok-llama-3-70b';
        this.apiKey = process.env.MOCK_GROK_API_KEY || '';
        this.cacheDir = process.env.CACHE_DIR || './cache';
        this.imageSupport = process.env.MOCK_IMAGE_SUPPORT === 'true';
        
        discordLogger.debug('Environment variables loaded', {
            hasApiKey: !!this.apiKey,
            apiKeyLength: this.apiKey?.length || 0,
            model: this.model,
            cacheDir: this.cacheDir,
            imageSupport: this.imageSupport
        });
        
        if (!this.apiKey) {
            discordLogger.error('MOCK_GROK_API_KEY not found in environment variables');
            throw new Error('MOCK_GROK_API_KEY is not set');
        }
        
        if (!this.model) {
            discordLogger.error('MOCK_GROK_MODEL not found in environment variables');
            throw new Error('MOCK_GROK_MODEL is not set');
        }

        // Ensure cache directory exists if image support is enabled
        if (this.imageSupport) {
            try {
                if (!fs.existsSync(this.cacheDir)) {
                    fs.mkdirSync(this.cacheDir, { recursive: true });
                    discordLogger.info('Created cache directory', { cacheDir: this.cacheDir });
                }
            } catch (error) {
                discordLogger.error('Failed to create cache directory', { 
                    error: (error as Error).message,
                    cacheDir: this.cacheDir
                });
                throw new Error('Failed to create cache directory');
            }
        }
        
        // Test API connectivity (optional)
        try {
            const testResponse = await fetch('https://openrouter.ai/api/v1/models', {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                },
                signal: AbortSignal.timeout(10000) // 10 second timeout
            });
            
            if (testResponse.ok) {
                discordLogger.info('API connectivity test successful');
            } else {
                discordLogger.warn('API connectivity test failed', {
                    status: testResponse.status,
                    statusText: testResponse.statusText
                });
            }
        } catch (testError) {
            discordLogger.warn('API connectivity test error', {
                error: (testError as Error).message
            });
        }
        
        discordLogger.info('AtGrokIsThisTrueService initialized successfully');
    }

    private async downloadImage(url: string): Promise<string | null> {
        if (!this.imageSupport) {
            discordLogger.debug('Image support disabled, skipping download');
            return null;
        }

        try {
            discordLogger.info('Downloading image', { url });

            // Create filename based on URL hash
            const urlHash = createHash('md5').update(url).digest('hex');
            const urlObj = new URL(url);
            const extension = path.extname(urlObj.pathname) || '.jpg';
            const filename = `${urlHash}${extension}`;
            const filepath = path.join(this.cacheDir, filename);

            // Check if file already exists in cache
            if (fs.existsSync(filepath)) {
                discordLogger.debug('Image found in cache', { filepath });
                return filepath;
            }

            // Download the image
            const response = await fetch(url, {
                signal: AbortSignal.timeout(15000), // 15 second timeout for downloads
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; DiscordBot/1.0)',
                }
            });

            if (!response.ok) {
                discordLogger.error('Failed to download image', {
                    status: response.status,
                    statusText: response.statusText,
                    url
                });
                return null;
            }

            // Check content type
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.startsWith('image/')) {
                discordLogger.warn('URL does not point to an image', { contentType, url });
                return null;
            }

            // Save to cache
            const buffer = await response.arrayBuffer();
            fs.writeFileSync(filepath, Buffer.from(buffer));

            discordLogger.info('Image downloaded and cached', {
                filepath,
                size: buffer.byteLength,
                contentType
            });

            return filepath;

        } catch (error) {
            discordLogger.error('Error downloading image', {
                error: (error as Error).message,
                url
            });
            return null;
        }
    }

    private imageToBase64(filepath: string): string | null {
        try {
            const imageBuffer = fs.readFileSync(filepath);
            const base64 = imageBuffer.toString('base64');
            const extension = path.extname(filepath).toLowerCase();
            
            let mimeType = 'image/jpeg'; // default
            switch (extension) {
                case '.png':
                    mimeType = 'image/png';
                    break;
                case '.gif':
                    mimeType = 'image/gif';
                    break;
                case '.webp':
                    mimeType = 'image/webp';
                    break;
            }

            return `data:${mimeType};base64,${base64}`;
        } catch (error) {
            discordLogger.error('Error converting image to base64', {
                error: (error as Error).message,
                filepath
            });
            return null;
        }
    }

    private async enqueueOperation<T>(
            key: string,
            operation: () => Promise<T>,
        ): Promise<T> {
        const existingQueue = this.queryQueues.get(key) || Promise.resolve();

        const newQueue = existingQueue
        .then(() => operation())
        .finally(() => {
            if (this.queryQueues.get(key) === newQueue) {
            this.queryQueues.delete(key);
            }
        });

        this.queryQueues.set(key, newQueue);
        return newQueue;
    }

    async query(question: string, guildId: string, attachmentUrl?: string): Promise<string> {
        if (!this.model || !this.apiKey) {
            throw new Error('Service not initialized. Call init() first.');
        }
        return await this.enqueueOperation(guildId, async () => {

            discordLogger.info('Making "Grok" API request', {
                model: this.model,
                questionLength: question.length,
                hasApiKey: !!this.apiKey,
                apiKeyLength: this.apiKey.length,
                hasAttachment: !!attachmentUrl,
                imageSupport: this.imageSupport
            });

            let imagePath: string | null = null;
            let imageBase64: string | null = null;

            // Download and process image if provided
            if (attachmentUrl && this.imageSupport) {
                imagePath = await this.downloadImage(attachmentUrl);
                if (imagePath) {
                    imageBase64 = this.imageToBase64(imagePath);
                }
            }

            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const messages: any[] = [
                    { 
                        role: 'system', 
                        content: 'You are an extremely skeptical AI assistant. Answer with an EXTREME true or false response followed by a short explanation. Keep your response under 200 characters.' 
                    }
                ];

                // Add user message with or without image
                if (imageBase64) {
                    messages.push({
                        role: 'user',
                        content: [
                            { type: 'text', text: question },
                            { 
                                type: 'image_url', 
                                image_url: { 
                                    url: imageBase64,
                                    detail: 'high'
                                } 
                            }
                        ]
                    });
                    discordLogger.debug('Added image to request', { hasImage: true });
                } else {
                    messages.push({ role: 'user', content: question });
                }

                const requestBody = {
                    model: this.model,
                    messages: messages,
                    max_tokens: 1000, // Increased to allow for reasoning + content
                    temperature: 0.3,
                    // Force the model to output the final answer in content, not just reasoning
                    response_format: { type: "text" },
                    // Some models need this to ensure content is populated
                    stream: false
                };

                discordLogger.debug('Request body', { 
                    model: requestBody.model,
                    messageCount: requestBody.messages.length,
                    hasImage: !!imageBase64
                });

                const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`,
                        'HTTP-Referer': process.env.API_URL || 'https://example.com',
                        'X-Title': 'Discord Bot Grok Service'
                    },
                    body: JSON.stringify(requestBody),
                    signal: AbortSignal.timeout(60000)
                });

                discordLogger.info('API Response received', {
                    status: response.status,
                    statusText: response.statusText,
                    ok: response.ok
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    discordLogger.error('API Error Response', {
                        status: response.status,
                        statusText: response.statusText,
                        body: errorText
                    });
                    
                    if (response.status === 401) {
                        throw new Error('Invalid API key. Please check your MOCK_GROK_API_KEY.');
                    } else if (response.status === 429) {
                        throw new Error('Rate limit exceeded. Please try again later.');
                    } else if (response.status === 400) {
                        throw new Error(`Bad request: ${errorText}`);
                    } else {
                        throw new Error(`API Error (${response.status}): ${errorText}`);
                    }
                }

                const data = await response.json();
                discordLogger.debug('API Response data', { 
                    hasChoices: !!data.choices,
                    choiceCount: data.choices?.length || 0
                });

                // Validate response structure
                if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                    discordLogger.error('Invalid API response structure', { data });
                    throw new Error('Invalid response format from API');
                }

                const choice = data.choices[0];
                let responseContent = choice.message.content;
                
                // If content is empty, try to extract from reasoning or create a fallback
                if (!responseContent || responseContent.trim() === '') {
                    if (choice.message.reasoning) {
                        // Extract the actual answer from reasoning if possible
                        const reasoning = choice.message.reasoning;
                        discordLogger.debug('Content empty, extracting from reasoning', { 
                            reasoningLength: reasoning.length 
                        });
                        
                        // Try to find the final answer in the reasoning
                        const lines = reasoning.split('\n');
                        const lastLine = lines[lines.length - 1]?.trim();
                        
                        // Look for patterns like "True:" "False:" or simple true/false statements
                        const answerPattern = /(true|false)/i;
                        const match = lastLine?.match(answerPattern) || reasoning.match(answerPattern);
                        
                        if (match) {
                            responseContent = `${match[1].toLowerCase() === 'true' ? 'True' : 'False'}: Based on analysis, this appears to be ${match[1].toLowerCase()}.`;
                        } else {
                            // Fallback: take first 200 chars of reasoning
                            responseContent = reasoning.substring(0, 200) + (reasoning.length > 200 ? '...' : '');
                        }
                    } else {
                        // Ultimate fallback
                        responseContent = "Unable to determine truth value. Please rephrase your question.";
                    }
                }
                
                // Ensure we have content before proceeding
                if (!responseContent || responseContent.trim() === '') {
                    discordLogger.error('Still empty response after all attempts', { 
                        choice,
                        finishReason: choice.finish_reason
                    });
                    throw new Error('Unable to generate response content');
                }

                // Handle truncated responses
                if (choice.finish_reason === 'length') {
                    responseContent += ' (Response was truncated)';
                }

                // Update last query time
                //this.lastQueryDate = new Date();

                discordLogger.info('Grok query successful', {
                    responseLength: responseContent.length,
                    finishReason: choice.finish_reason,
                    hadToExtractFromReasoning: !choice.message.content,
                    processedImage: !!imageBase64
                });

                return responseContent.trim() + '\n-# This response was generated by AI, it may be completely innacurate.(duh)';

            } catch (error) {
                if (error instanceof Error) {
                    discordLogger.error('Grok query error details', {
                        name: error.name,
                        message: error.message,
                        stack: error.stack
                    });

                    if (error.name === 'AbortError') {
                        throw new Error('Request timed out. The API might be slow or unavailable.');
                    } else if (error.message.includes('fetch failed')) {
                        throw new Error('Network error: Unable to connect to the API. This might be a temporary issue.');
                    } else if (error.message.includes('ENOTFOUND')) {
                        throw new Error('DNS error: Cannot resolve API domain. Check your internet connection.');
                    } else if (error.message.includes('ECONNRESET')) {
                        throw new Error('Connection reset: The API server closed the connection unexpectedly.');
                    }
                }
                
                throw error;
            } finally {
                // Clean up downloaded image if it exists (might want to keep cache, idk, for later prob)
                // if (imagePath && fs.existsSync(imagePath)) {
                //     fs.unlinkSync(imagePath);
                //     discordLogger.debug('Cleaned up temporary image file', { imagePath });
                // }
            }
        });
    }
}