const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder, AttachmentFlags, Embed, InteractionCollector } = require("discord.js");
const { QueryType, GuildQueue, useQueue, Player } = require("discord-player");
const https = require('https');
const fs = require('fs');
const path = require('path');

const downloadFile = (file, url) => {
    return new Promise((resolve, reject) => {
        const fileExtension = path.extname(file);

        // Set the local path where you want to save the downloaded file
        const localPath = 'C:/Server/DSMBot/PP_DMB/cache/' + Math.random() * 999; + fileExtension;
        const writeStream = fs.createWriteStream(localPath);

        https.get(url, (res) => {
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
                  metadata: {
                    guild: interaction.guildId
                 },
                });

            // check if the queue is empty
            client.player.events.on("emptyQueue", (queue) => {

                if (interaction.channel) {
                    interaction.channel.send("The queue is now empty!");
                } else {
                    console.log("No text channel with 'bot' in the name found.");
                }
            });
            

            client.player.events.on("emptyChannel", (queue) => {

                if (interaction.channel) {
                    try {
                    guildQueue.delete()
                    console.log('Managed to delete a queue like a normal person.')
                    interaction.channel.send("Left the channel, since I am alone.");
                    }
                    catch(error) {
                        client.player.nodes.delete(guildQueue)
                        console.log('Managed to delete a queue like a crazy person.')
                        interaction.channel.send("Left the channel, since I am alone.");
                    }
                } else {
                    console.log("No text channel with 'bot' in the name found.");
                }
            });

            client.player.events.on("playerFinish", (queue) => {
                if (queue.tracks.size !== 0) {
                queue.tracks.at(0).startedPlaying = new Date()
                }
            });

        }
        else {
            console.log(`[${new Date().toISOString()}] Using an existing queue for guild ${interaction.guild.name}`)
        }


        // Wait until you are connected to the channel
        if (!guildQueue.connection) await guildQueue.connect(interaction.member.voice.channel);

        let embed = new EmbedBuilder();
        if (interaction.options.getSubcommand() === "song") {
            let argument = interaction.options.getString("searchterm");
                let urlRegex = new RegExp("https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)");
                if (String(argument).includes('watch?v=')) {
              
                var result = await client.player.search(argument, {
                    requestedBy: interaction.user,
                    searchEngine: QueryType.YOUTUBE_VIDEO
                });
                song = result.tracks[0];
                guildQueue.addTrack(song);     
                embed
                    .setDescription(`**${song.title}** has been added to the queue`)
                    .setThumbnail(song.thumbnail)
                    .setFooter({ text: `Duration: ${song.duration} Position: ${guildQueue.tracks.size}`}); 
                if (result.tracks.length === 0) {
                    return interaction.followUp("No results");
                }    
            }
            else if (String(argument).includes('playlist?list=')) {
                
                var result = await client.player.search(argument, {
                    requestedBy: interaction.user,
                    searchEngine: QueryType.YOUTUBE_PLAYLIST
                });
                const playlist = result.playlist;
                if (!playlist) {
                    return interaction.followUp("No results");
                }
                let i = 0;
                for (track in result.tracks) {
                    guildQueue.addTrack(result.tracks[i]);
                    i++;
                }
                embed
                    .setDescription(`**${result.tracks.length} songs from ${playlist.title}** have been added to the queue`)
                    .setThumbnail(playlist.thumbnail);
                if (result.tracks.length === 0) {
                    return interaction.followUp("No songs in the playlist.");
                }
            }
            
            else if (urlRegex.test(argument)) {
                console.log('File?')
                try {
                    // Search for the attached file (without playing it)
                    var result = await player.search(argument, {
                        requestedBy: message.author,
                        searchEngine: QueryType.FILE,
                        // ... (other options if needed)
                    });
        
                    // Add the search result to your custom tracks list
                    // For example:
                    // myCustomTracks.push(searchResult.tracks[0]);
                    
                    message.reply('Attached file added to custom tracks list!');
                    song = result.tracks[0];
                    embed
                        .setDescription(`**${song.title}** has been added to the queue`)
                        .setThumbnail(song.thumbnail)
                        .setFooter({ text: `Duration: ${song.duration} Position: ${guildQueue.tracks.size}`  });
                    if (result.tracks.length === 0) {
                        return interaction.followUp("No results");
                    }
        
                    guildQueue.addTrack(song);
                } catch (error) {
                    console.error('Error searching the file:', error.message);
                    message.reply('Oops! Something went wrong while searching the file.');
                }
            }
            else {
               
                var result = await client.player.search(argument, {
                    requestedBy: interaction.user,
                    searchEngine: QueryType.YOUTUBE_SEARCH
                });
                song = result.tracks[0]
                embed
                        .setDescription(`**${song.title}** has been added to the queue`)
                        .setThumbnail(song.thumbnail)
                        .setFooter({ text: `Duration: ${song.duration} Position: ${guildQueue.tracks.size}` });
                if (result.tracks.length === 0) {
                    return interaction.followUp("No results");
                }
                           
                guildQueue.addTrack(song);
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
                        // ... (other options if needed)
                    });

                    guildQueue.addTrack(result.tracks[0])
                    // Add the search result to your custom tracks list
                    // For example:
                    // myCustomTracks.push(searchResult.tracks[0]);

                    interaction.followUp('Attached file added to queue!');
                    song = result.tracks[0];
                    embed
                    .setDescription(`**${song.title}** has been added to the queue!`)
                    .setThumbnail(song.thumbnail)
                    .setFooter({ text: `Duration: ${song.duration} Position: ${guildQueue.tracks.size}`});
                } catch (error) {
                    console.error('Error searching the file:', error.message);
                    interaction.followUp('Oops! Something went wrong while searching the file.');
                }
            }
        } 
        // Play the song
        if (!guildQueue.isPlaying() && guildQueue.tracks.size> 0) {
            // Start playing the first track in the guildQueue
            const tracks = guildQueue.tracks.toArray();
            guildQueue.tracks.at(0).startedPlaying = new Date()
            await guildQueue.play(tracks[0], {nodeOptions: {
                noEmitInsert: true,
                leaveOnStop: false,
                leaveOnEmpty: false,
                leaveOnEnd: false,
                pauseOnEmpty: true,
                preferBridgedMetadata: true,
                disableBiquad: true,
        }});
            //await guildQueue.play(guildQueue.tracks[0]);
                    
        } else if (guildQueue.tracks.size === 0) {
            // The guildQueue is empty, handle this scenario appropriately
            console.log('The queue is empty.');
            return interaction.followUp('There are no songs in the queue to play.');
        }

        // Respond with the embed containing information about the player
        await interaction.editReply({
            embeds: [embed]
        });
    },
};
