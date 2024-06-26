const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder, AttachmentFlags, Embed, InteractionCollector } = require("discord.js");
const { QueryType, GuildQueue, useQueue, Player } = require("discord-player");
const https = require('https');
const http = require('http')
const fs = require('fs');
const path = require('path');
const { Track } = require("discord-player");

const downloadFile = (file, url) => {
    return new Promise((resolve, reject) => {
        const fileExtension = path.extname(file);
        // Corrected the random number generation and concatenation with file extension
        const localPath = 'C:/Server/DSMBot/PP_DMB/cache/' + Math.random().toString().slice(2, 11) + fileExtension;
        const writeStream = fs.createWriteStream(localPath);

        // Determine the protocol from the URL
        const protocol = url.startsWith('https') ? https : http;

        protocol.get(url, (res) => {
            res.pipe(writeStream);

            writeStream.on('finish', () => {
                writeStream.close();
                console.log('Download completed! File saved at:', localPath);
                resolve(localPath); // Resolve the promise
            });
        }).on('error', (err) => {
            console.error('Error downloading file:', err.message);
            reject(err); // Reject the promise
        });
    });
};
module.exports = {
    data: new SlashCommandBuilder()
        .setName("play")
        .setDescription("play a song from YouTube.")
        .addSubcommand(subcommand =>
            subcommand
                .setName("song")
                .setDescription("plays a song")
                .addStringOption(option =>
                    option.setName("searchterm").setDescription("url/search/playlist").setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("file")
                .setDescription("plays a file")
                .addAttachmentOption(option =>
                    option.setName("file").setDescription("play's the song").setRequired(true)
                )
        ),
    execute: async ({ client, interaction }) => {
        // Defer the reply to ensure the interaction is acknowledged
        await interaction.deferReply();
        

        // Make sure the user is inside a voice channel
        if (!interaction.member.voice.channel) {
            return interaction.followUp("You need to be in a Voice Channel to play a song.");
        }

        // Create a play guildQueue for the server
        const { player } = client; // Access the player instance from the client
        let guildQueue = useQueue(interaction.guildId)
        // If there is no guildQueue for the guild, create one
        if (!guildQueue) {
            console.log(`[${new Date().toISOString()}] Created a new queue for guild ${interaction.guild.name}`)
            guildQueue = new GuildQueue(player, {
                    leaveOnEnd: false,
                    leaveOnEmpty: false,
                    leaveOnStop: false,
                    guild: interaction.guild,
                    metadata: interaction,
                });
        }
        else {
            if (guildQueue.deleted) {
                guildQueue.revive()
            }
            console.log(`[${new Date().toISOString()}] Using an existing queue for guild ${interaction.guild.name}`)
        }

        console.log(Object.prototype.toString.call(guildQueue));
        console.log(guildQueue.constructor.name);
        // Wait until connected to the channel
        if (!guildQueue.connection) await guildQueue.connect(interaction.member.voice.channel);

        let embed = new EmbedBuilder();
        if (interaction.options.getSubcommand() === "song") {
            let argument = interaction.options.getString("searchterm");
            
                if (String(argument).includes('watch?v=') || (String(argument).includes('youtu.be'))) {
              
                let result = await client.player.search(argument, {
                    requestedBy: interaction.user,
                    searchEngine: QueryType.YOUTUBE_VIDEO
                });
                song = result.tracks[0];   
                embed
                    .setDescription(`**${song.title}** has been added to the queue`)
                    .setThumbnail(song.thumbnail)
                    .setFooter({ text: `Duration: ${song.duration} Position: ${guildQueue.tracks.size + 1}`}); 
                if (result.tracks.length === 0) {
                    return interaction.followUp("No results");
                }    
            }
            else if (String(argument).includes('playlist?list=')) {
                
                let result = await client.player.search(argument, {
                    requestedBy: interaction.user,
                    searchEngine: QueryType.YOUTUBE_PLAYLIST
                });
                const playlist = result.playlist;
                if (!playlist) {
                    return interaction.followUp("No results");
                }
                let i = 0;
                for (track in result.tracks) {
                    if (i == 0) {
                        song = result.tracks[i]
                    } else {
                        guildQueue.addTrack(result.tracks[i]);
                        i++;
                    }
                }
                result.tracks[0].startedPlaying = new Date()

                embed
                    .setDescription(`**${result.tracks.length} songs from ${playlist.title}** have been added to the queue`)
                    .setThumbnail(playlist.thumbnail);
                if (result.tracks.length === 0) {
                    return interaction.followUp("No songs in the playlist.");
                }
            }
            else if (String(argument).includes('http') || String(argument).includes('https')) {
                console.log('URL Detected');
                let argument = interaction.options.getString("searchterm");
                try {
                    // Check if the URL has a port, indicating a live stream
                    if (/:([0-9]+)/.test(argument)) { // Regex to check for a port number

                        console.log('Live stream detected');
                        // create a stream using ytdl-core with audioonly filter
                        let result = await player.search(argument, {
                            requestedBy: interaction.user,
                            searchEngine: QueryType.AUTO,
   
                        });
    
                        song = result.tracks[0];
                        song.duration = "∞"
                        

                        // Send a message to the channel about the added track
                        if (argument == "http://95.31.138.156:55060/stream" || argument == "http://www.funckenobi42.space:55060/stream" || argument == "192.168.0.50:55060/stream") {
                            embed
                            .setDescription(`**The 42 Radio** has been added to the queue`)
                            .setThumbnail("http://www.funckenobi42.space/42.png")
                            .setFooter({ text: `Duration: ∞ Position: ${guildQueue.tracks.size + 1}`});
                            song.title = "The 42 Radio"
                            song.author = "func_kenobi"
                            song.thumbnail = "http://www.funckenobi42.space/42.png"
                        }
                        else {
                        embed
                            .setDescription(`**${song.title}** has been added to the queue`)
                            .setThumbnail(song.thumbnail)
                            .setFooter({ text: `Duration: ∞ Position: ${guildQueue.tracks.size + 1}`});
                        }
                    } else {
                    file = argument.split('?')[0]
                    file = String(file).replace('?', '')
                    // Search for the attached file (without playing it)

                        const localPath = await downloadFile(file, argument);
                        // Search for the attached file (without playing it)
                        let result = await player.search(localPath, {
                            requestedBy: interaction.user,
                            searchEngine: QueryType.FILE,
   
                        });
                        song = result.tracks[0];
                        console.log(song)  
                        embed
                            .setDescription(`**${song.title}** has been added to the queue`)
                            .setThumbnail(song.thumbnail)
                            .setFooter({ text: `Duration: ${song.duration} Position: ${guildQueue.tracks.size + 1}`}); 
                        if (result.tracks.length === 0) {
                            return interaction.followUp("No results");
                        }  
                    }        
                } catch (error) {
                    console.error('Error searching the file:', error.message);
                    message.reply('Oops! Something went wrong while searching the file.');
                }
            }
            else {
                let result = await client.player.search(argument, {
                    requestedBy: interaction.user,
                    searchEngine: QueryType.YOUTUBE_SEARCH
                });
                song = result.tracks[0]
                embed
                        .setDescription(`**${song.title}** has been added to the queue`)
                        .setThumbnail(song.thumbnail)
                        .setFooter({ text: `Duration: ${song.duration} Position: ${guildQueue.tracks.size + 1}` });
                if (result.tracks.length === 0) {
                    return interaction.followUp("No results");
                }
                           
                //guildQueue.addTrack(song);
            }
            // Search for the song using the discord-player


            // Add the track to the guildQueue
        }
        else if (interaction.options.getSubcommand() === "file") {
            let file = interaction.options.getAttachment("file");
            file = file.url.split('?')[0]
            file = String(file).replace('?', '')
            let url = interaction.options.getAttachment("file").url
            if (file) {
                try {
                    const localPath = await downloadFile(file, url);
                    // Search for the attached file (without playing it)
                    var result = await player.search(localPath, {
                        requestedBy: interaction.user,
                        searchEngine: QueryType.FILE,
                        // ... (other options if nSeeded)
                    });
                    song = result.tracks[0];

                    //guildQueue.addTrack(song)
                    // Add the search result to your custom tracks list
                    // For example:
                    // myCustomTracks.push(searchResult.tracks[0]);

                    interaction.followUp('Attached file added to queue!');

                    embed
                    .setDescription(`**${song.title}** has been added to the queue!`)
                    .setThumbnail(song.thumbnail)
                    .setFooter({ text: `Duration: ${song.duration} Position: ${guildQueue.tracks.size + 1}`});
                } catch (error) {
                    console.error('Error searching the file:', error.message);
                    interaction.followUp('Oops! Something went wrong while searching the file.');
                }
            }
        } 
            // Play the song
            // Start playing the first track in the guildQueue
            await guildQueue.play(song, {nodeOptions: {
                metadata: interaction,
                noEmitInsert: true,
                leaveOnStop: false,
                leaveOnEmpty: false,
                leaveOnEnd: false,
                pauseOnEmpty: true,
                //preferBridgedMetadata: true,
                disableBiquad: true,
        }});


        // Respond with the embed containing information about the player
        await interaction.editReply({
            embeds: [embed]
        });
    },
};
