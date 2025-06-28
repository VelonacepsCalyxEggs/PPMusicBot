# PPMusicBot

A feature-rich Discord music bot built with TypeScript for the Prosto Patka Tier 9001 Discord server. This bot provides comprehensive music playback capabilities with support for YouTube, Spotify, local files, and database-stored tracks.

## 🎵 Features

### Music Playback
- **Multiple Audio Sources**: YouTube videos/playlists, Spotify tracks, direct URLs, and local files
- **Database Integration**: Play tracks from a connected PostgreSQL database
- **Queue Management**: Full queue control with shuffle, loop, skip, and replay functionality
- **Real-time Controls**: Play, pause, skip, replay, and volume management
- **Track Information**: Display current playing track with duration and metadata

### Queue Features
- **Paginated Queue Display**: View queue with navigation buttons
- **Track Manipulation**: Move, remove, and re-add tracks to queue
- **Loop Modes**: Support for single track and queue looping
- **Shuffle**: Randomize queue order

### Advanced Features
- **Live Stream Support**: Handle live streams and real-time audio
- **File Upload Support**: Play audio files directly uploaded to Discord
- **Database Search**: Search and play tracks from your music database
- **Channel Scanning**: Extract and save messages from channels for debugging
- **Smart Duration Tracking**: Accurate playback position tracking
- **Error Handling**: Comprehensive error logging and recovery

## Technology Stack

- **Runtime**: Node.js with TypeScript
- **Discord Library**: discord.js v14
- **Audio Engine**: discord-player v7 with multiple extractors
- **Database**: PostgreSQL with pg driver
- **Logging**: Winston for structured logging
- **Build Tool**: TypeScript compiler
- **Process Management**: Cross-platform environment support

## rerequisites

- Node.js 18^
- PostgreSQL database (for database music features and analytics)
- Discord Bot Token
- FFmpeg installed on system

## 🚀 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd PP_DMB_TS
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.production` file in the root directory:
   ```env
    TOKEN=YOUR_BOT_TOKEN_HERE
    CLIENT_ID=YOUR_BOT_CLIENT_ID_HERE
    DATABASE_URL=YOUR_POSTGRES_DATABASE_URL_HERE
    PATH_TO_STATUS_JSON=./resources
    API_URL=https://www.funckenobi42.space/api
    PATH_TO_MUSIC=PATH_TO_YOUR_MUSIC_DIRECTORY_HERE
    YT_ACCESS_TOKEN="YOUTUBE_ACCESS_TOKEN_HERE"
   ```

4. **Build the project**
   ```bash
   npx tsc
   ```

5. **Run the bot**
   ```bash
   npm run start:prod
   ```

## Commands

### Music Commands
- `/play song <query>` - Play a song from YouTube or search term
- `/play fromdb <query>` - Play a song from the database
- `/play file <attachment>` - Play an uploaded audio file
- `/queue [page]` - Display the current queue
- `/np` - Show currently playing track
- `/pause` - Pause/resume playback
- `/skip` - Skip current track
- `/replay` - Replay current track
- `/loop` - Toggle loop modes
- `/shuffle` - Shuffle the queue
- `/move <from> <to>` - Move track position in queue
- `/remove <position> <position2>` - Remove track from queue, or multiple tracks in between positions.
- `/re-add` - Re-add the last played track
- `/leave` - Leave voice channel

### Utility Commands
- `/whereami` - Shows in which servers the bot resides in.

### Debug Commands
- `/scan <channelid> <limit>` - Extract messages from channel for debugging.
- `/error` - Invoke an error.

## 🔧 Configuration

### Environment Variables
- `TOKEN` - Discord bot token (required)
- `DATABASE_URL` - PostgreSQL connection string (optional)
- `NODE_ENV` - Environment mode (development/production)

### Bot Permissions
The bot requires the following Discord permissions:
- Send Messages
- Use Slash Commands
- Connect to Voice Channels
- Speak in Voice Channels
- Read Message History
- Embed Links
- Attach Files

## Logging

The bot uses Winston for comprehensive logging:
- **Console Output**: Colored, formatted logs for development
- **File Logging**: Structured JSON logs in `/logs` directory
- **Error Tracking**: Separate error, exception, and rejection logs
- **Context Logging**: Specialized loggers for different bot components

Log files:
- `logs/app.log` - General application logs
- `logs/error.log` - Error-only logs
- `logs/exceptions.log` - Uncaught exceptions
- `logs/rejections.log` - Unhandled promise rejections

## Available Scripts

```bash
npm run start        # Production mode
npm run start:dev    # Development mode
npm run start:debug  # Development with nodemon
npm run start:prod   # Production mode (alternative)
```

## Database Integration

The bot supports PostgreSQL for storing and retrieving music tracks made by my other project (to be released soon)

## Features in Detail

### Audio Sources
1. **YouTube**: Videos and playlists with automatic metadata extraction
2. **Spotify**: Soon™
3. **Direct URLs**: Support for various audio stream formats
4. **File Uploads**: Discord attachment support
5. **Database Tracks**: Stored music with custom metadata

## Acknowledgments

- Built with [discord.js](https://discord.js.org/)
- Audio powered by [discord-player](https://discord-player.js.org/)
- Youtube Search powered by [discord-player-youtube](https://github.com/retrouser955/discord-player-youtubei)
- Database support via [node-postgres](https://node-postgres.com/)
- Logging by [Winston](https://github.com/winstonjs/winston)
