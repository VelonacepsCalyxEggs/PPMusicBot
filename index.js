const { Client, GatewayIntentBits, Collection, REST, Routes, ActivityType } = require('discord.js');
const { Player } = require("discord-player")
const { ExtractorPlugin } = require('@discord-player/extractor');

const { Client: PgClient } = require('pg');
const dbConfig = require('./config/dbCfg'); // Make sure the path is correct

// PostgreSQL client setup using the imported config
const pgClient = new PgClient(dbConfig);

pgClient.connect();

const fs = require('fs');
const path = require('path');
const { type } = require('os');

const { TOKEN, CLIENT_ID } = require('./config/botCfg');
//const { TOKEN, CLIENT_ID } = require('./config/devBotCfg');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// List of all commands
const commands = [];
client.commands = new Collection();

const commandsPath = path.join(__dirname, "commands"); // E:\yt\discord bot\js\intro\commands
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
for(const file of commandFiles)
{
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
}

// Add the player on the client
client.player = new Player(client, {
    ytdlOptions: {
        quality: "highestaudio",
        highWaterMark: 1 << 25
    }
})
//console.log(client.player.scanDeps());client.player.on('debug',console.log).events.on('debug',(_,m)=>console.log(m));
client.player.extractors.loadDefault();

client.on("ready", async () => {
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
        try {
            // Fetch a random quote from the database
            const res = await pgClient.query('SELECT quote FROM quotes ORDER BY RANDOM() LIMIT 1');
            const randomQuote = res.rows[0].quote;
            const quoteLines = randomQuote.split('\n');
            const randomLineIndex = Math.floor(Math.random() * quoteLines.length);
            const randomLine = quoteLines[randomLineIndex];
    
            // Reply with the random line and the error message
            await interaction.reply({content: `Oops! Something went wrong. Here's a random quote to lighten the mood:\n"${randomLine}"\n\nError details: \`\`\`js\n${error}\`\`\``});
        } catch (error_follow) {
            // If the initial reply fails, use followUp
            await interaction.followUp({content: `Oops! Something went wrong. Here's a random quote to lighten the mood:\n"${randomLine}"\n\nError details: \`\`\`js\n${error_follow}\`\`\``});
        }
    }
    
});


client.player.events.on("emptyChannel", (queue) => {
    const interaction = queue.metadata;
    try {
        if (queue.connection.state.status == 'destroyed') {
            return; // exit if the connection is not active, meaning the bot was disconnected
        }
        interaction.channel.send("Left the channel, since I am alone.");
        queue.delete();
        console.log('Managed to delete a queue like a normal person.');
    } catch(error) { 
        console.log('No queue was deleted:', error);
    }
});


client.player.events.on("playerFinish", (queue) => {
    if (queue.tracks.size !== 0) {
    queue.tracks.at(0).startedPlaying = new Date()
    }
});

client.player.events.on("audioTrackAdd", (queue) => {
    if (queue.tracks.size !== 0) {
    queue.tracks.at(0).startedPlaying = new Date()
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

// check if the queue is empty
client.player.events.on("emptyQueue", (queue) => {

    if (queue.connection.state.status != 'Destroyed') {
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
            interaction.channel.send("Left the channel since I was manually disconnected.");
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
    console.log(`[${new Date().toISOString()}] Connected sucsessfully.`);
});


client.login(TOKEN);

