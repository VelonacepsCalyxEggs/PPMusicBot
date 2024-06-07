const { Client, GatewayIntentBits, Collection, REST, Routes, ActivityType } = require('discord.js');
const { Player } = require("discord-player")
const { ExtractorPlugin } = require('@discord-player/extractor');

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
        'updquotes': '644950708160036864'
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
        client.channels.cache.get('1129406347448950845').send('The bot is online.')
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
        // Read the JSON file containing the messages
        dir = 'C:\\Server\\DSMBot\\PP_DMB'
        const jsonFilePath = path.join(dir, 'quotes.json');
        const messagesJson = fs.readFileSync(jsonFilePath);
        const messages = JSON.parse(messagesJson);
    
        // Select a random message from the array
        const randomIndex = Math.floor(Math.random() * messages.length);
        const randomQuote = messages[randomIndex];
        try
        {
            await interaction.reply({content: `There was an error executing this command\n ${randomQuote}: \`\`\`js\n ${error} \`\`\``});
        }
        catch(error_follow){
            await interaction.followUp({content: `There was an error executing this command\n ${randomQuote}: \`\`\`js\n ${error} \`\`\``});
        }
    }
});

// check if the queue is empty
client.player.events.on("emptyQueue", (queue) => {
    interaction = queue.metadata
    if (interaction.channel) {
        interaction.channel.send("The queue is now empty!");
    } else {
        console.log("No text channel with 'bot' in the name found.");
    }
});


client.player.events.on("emptyChannel", (queue) => {
    interaction = queue.metadata
    if (interaction.channel) {
        try {
        queue.delete()
        console.log('Managed to delete a queue like a normal person.')
        interaction.channel.send("Left the channel, since I am alone.");
        }
        catch(error) {
            client.player.nodes.delete(queue)
            console.log('Managed to delete a queue like a crazy person.')
            interaction.channel.send("Left the channel, since I am alone.");
        }
    } else {
        console.log("No text channel found.");
    }
});

client.player.events.on("playerFinish", (queue) => {
    if (queue.tracks.size !== 0) {
    queue.tracks.at(0).startedPlaying = new Date()
    }
});

client.player.events.on("playerError", (queue, error) => {
    if (client.channels.cache.get('1129406347448950845')) {
        client.channels.cache.get('1129406347448950845').send(`The player had an error: \n \`\`\`js \n${error}\`\`\``)
    }
});


client.login(TOKEN);

