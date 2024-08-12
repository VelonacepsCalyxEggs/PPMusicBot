const { Client, GatewayIntentBits, Collection, REST, Routes, ActivityType } = require('discord.js');
const { Player } = require("discord-player")
const { ExtractorPlugin } = require('@discord-player/extractor');
const { YoutubeiExtractor } = require("discord-player-youtubei")
const { Client: PgClient } = require('pg');
const dbConfig = require('./config/dbCfg'); 
const youtubeCfg = require('./config/ytCfg')

// PostgreSQL client setup using the imported config
console.log('Loading DB config...')
const pgClient = new PgClient(dbConfig);
console.log('Connecting to DB...')
pgClient.connect();

const fs = require('fs');
const path = require('path');
const { type } = require('os');

const { TOKEN, CLIENT_ID } = require('./config/botCfg');
//const { TOKEN, CLIENT_ID } = require('./config/devBotCfg');

async function main() {
    console.log('Starting main...')
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildVoiceStates
        ]
    });

    console.log('Initializing player...')
    // Add the player on the client
    client.player = new Player(client, {
        ytdlOptions: {
            quality: "highestaudio",
            highWaterMark: 1 << 25
        }
    })
    console.log('Loading default extractors.')
    await client.player.extractors.loadDefault()
    //console.log('Loading Youtubei extractor.')
    //await client.player.extractors.register(YoutubeiExtractor, {
    //    authentication: youtubeCfg
    //})
    
    // List of all commands
    const commands = [];
    client.commands = new Collection();

    const commandsPath = path.join(__dirname, "commands"); 
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for(const file of commandFiles)
    {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);

        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
    }
    console.log('Waiting for client...')
    client.on("ready", async () => {
        console.log('Client is ready!')
        // Define a list of commands that are restricted to specific guilds
        const restrictedCommands = {
            'scan': '644950708160036864',
            'updquotes': '644950708160036864',
            'playin': '644950708160036864',
            'movein': '644950708160036864',
            'queuein': '644950708160036864',
            'removein': '644950708160036864',
            // ... add more commands and their respective guild IDs
        };

        // Get all ids of the servers
        const guild_ids = client.guilds.cache.map(guild => guild.id);
        console.log('Registering bot...')
        const rest = new REST({version: '9'}).setToken(TOKEN);

        for (const guildId of guild_ids) {
            // Filter commands based on the guild ID
            const guildCommands = commands.filter(command => {
                // If the command is restricted, check if the guild ID matches
                if (restrictedCommands[command.name]) {
                    return restrictedCommands[command.name] === guildId;
                }
                // If the command is not restricted, include it
                return true;
            });

            // Register the filtered list of commands for the guild
            await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guildId), 
                { body: guildCommands })
            .then(() => console.log('Successfully updated commands for guild ' + guildId))
            .catch(console.error);
        }

        const { ActivityType } = require('discord.js')

        client.user.setPresence({ 
            activities: [{ 
                name: 'some based tunes...', 
                type: ActivityType.Listening, 
                url: 'http://www.funckenobi42.space' 
            }], 
            status: 'dnd' 
        });
        if (client.channels.cache.get('1129406347448950845')) {
            //client.channels.cache.get('1129406347448950845').send('The bot is online.')
        }
        console.log(`[${new Date()}] Bot is online.`)
        console.log(client.player.scanDeps());client.player.on('debug',console.log).events.on('debug',(_,m)=>console.log(m));
    });

    client.on("interactionCreate", async interaction => {
        if(!interaction.isCommand()) return;

        const command = client.commands.get(interaction.commandName);
        if(!command) return;

        try
        {   
            console.log(`[${new Date().toISOString()}] Command: ${interaction.commandName} | User: ${interaction.user.tag} | Guild: ${interaction.guild.name}`);
            await command.execute({client, interaction});
        }
        catch(error)
        {
            console.error(error);
                // Fetch a random quote from the database
                const res = await pgClient.query('SELECT quote FROM quotes ORDER BY RANDOM() LIMIT 1');
                const randomQuote = res.rows[0].quote;
                const quoteLines = randomQuote.split('\n');
                const randomLineIndex = Math.floor(Math.random() * quoteLines.length);
                const randomLine = quoteLines[randomLineIndex];
        
                // Reply with the random line and the error message
                if (interaction.deferred) {
                    await interaction.editReply({content: `Oops! Something went wrong. Here's a random quote to lighten the mood:\n"${randomLine}"\n\nError details: \`\`\`js\n${error}\`\`\``});
                }
                else {
                    await interaction.channel.send({content: `Oops! Something went wrong. Here's a random quote to lighten the mood:\n"${randomLine}"\n\nError details: \`\`\`js\n${error}\`\`\``});
                }
                

        
        }});


    client.player.events.on("emptyChannel", (queue) => {
        const interaction = queue.metadata;
        try {
            if (queue.connection.state.status == 'destroyed') {
                return; // exit if the connection is not active, meaning the bot was disconnected
            }
            interaction.channel.send("Everyone left the channel.");
            queue.delete();
            console.log('Managed to delete a queue like a normal person.');
        } catch(error) { 
            console.log('No queue was deleted:', error);
        }
    });


    client.player.events.on("playerFinish", (queue) => {
        if (queue.tracks.size !== 0) {
        queue.tracks.at(0).startedPlaying = new Date()
        } else {
            queue.currentTrack.startedPlaying = new Date()
        }
    });

    client.player.events.on("audioTrackAdd", async (queue, track) => {
        console.log('track added')
        if (queue.tracks.size != 0) {
        queue.tracks.at(0).startedPlaying = new Date()
        //console.log(queue.node.isPlaying())
        }
    });

    client.player.events.on("playerError", (queue, error) => {
        const interaction = queue.metadata;
        if (interaction && interaction.channel) {
            interaction.channel.send(`The player encountered an error while trying to play the track: \n\`\`\`js\n${error.message}\`\`\``);
        } else {
            console.log(`Player Error: ${error.message}`);
        }
    });

    client.player.events.on("playerStart", (queue) => {
        const interaction = queue.metadata;
        if (!queue.isPlaying()) {
            if (interaction && interaction.channel) {
                interaction.channel.send(`*OMEGA ALERT, MEGA ULTRA UNKNOWN ASS ERROR DETECTED*\n Here's the queue Object, maybe it helps...:  \n\`\`\`js\n${queue}\`\`\``);
            } else {
                console.log(`*OMEGA ALERT, MEGA ULTRA UNKNOWN ASS ERROR DETECTED*\n Here's the queue Object, maybe it helps...:  \n\`\`\`js\n${queue}\`\`\``);
            }
        }
    });

    client.player.events.on("error", (queue, error) => {
        const interaction = queue.metadata;
        if (interaction && interaction.channel) {
            interaction.channel.send(`The queue encountered an error while trying to play the track: \n\`\`\`js\n${error.message}\`\`\``);
        } else {
            console.log(`Queue Error: ${error.message}`);
        }
    });

    // check if the queue is empty
    client.player.events.on("emptyQueue", (queue) => {

        if (queue.connection.state.status != 'destroyed') {
            const interaction = queue.metadata;
            if (!interaction || !interaction.channel) {
                console.log("No interaction or channel found.");
                return;
            }
            try {
                //queue.delete();
                //console.log('Managed to delete a queue like a normal person.');
                interaction.channel.send("The queue is now empty.");
            } catch(error) { 
                console.error('Error when handling emptyQueue:', error);
            }
        }
    });

    client.player.events.on("connectionDestroyed", (queue) => {
        const interaction = queue.metadata;
        if (!interaction || !interaction.channel) {
            console.log("No interaction or channel found.");
            return;
        }
        try {
            console.log(queue.connection.state.status)
            if (queue.connection.state.status != 'destroyed') {
                interaction.channel.send("I was manually disconnected.");
            } else {
                return; // exit if the disconnection was not manual
            }
            queue.delete();
            console.log('Managed to delete a queue like a normal person.');
        } catch(error) { 
            console.error('Error when handling connectionDestroyed:', error);
        }
    });



    client.player.events.on("connection", (queue, error) => {
        
    });


    client.login(TOKEN);
}
main()

