# Cartesia Voice Conversation Demo

A real-time streaming voice conversation application using **Cartesia.ai** for Speech-to-Text (STT) and Text-to-Speech (TTS), powered by **OpenAI GPT-4o-mini** for intelligent responses.

## Features

- **Real-time Speech-to-Text**: Stream audio from your microphone directly to Cartesia's STT API
- **AI-Powered Responses**: GPT-4o-mini processes transcriptions and generates intelligent responses
- **Streaming Text-to-Speech**: AI responses are streamed back as natural-sounding voice using Cartesia TTS
- **Full-Duplex Communication**: Everything works in real-time with WebSocket connections
- **Beautiful UI**: Clean, modern interface with visual feedback and audio visualizer

## Architecture

```
User speaks → Cartesia STT → OpenAI GPT-4o-mini → Cartesia TTS → Audio playback
     ↓              ↓                ↓                   ↓              ↓
  Browser ←→ WebSocket ←→ Node.js Server ←→ External APIs ←→ Streaming Response
```

## Prerequisites

- Node.js 18+ (for ES modules and WebSocket support)
- Cartesia.ai API key ([Get it here](https://cartesia.ai))
- OpenAI API key ([Get it here](https://platform.openai.com))

## Installation

1. **Clone or navigate to the project directory**:
   ```bash
   cd cartesia-conversation-demo
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```

4. **Edit `.env` and add your API keys**:
   ```env
   # Cartesia API Configuration
   CARTESIA_API_KEY=your_cartesia_api_key_here
   CARTESIA_API_VERSION=2025-04-16

   # Cartesia Voice Configuration
   CARTESIA_VOICE_ID=a0e99841-438c-4a64-b679-ae501e7d6091
   CARTESIA_MODEL_ID=sonic-english

   # OpenAI API Configuration
   OPENAI_API_KEY=your_openai_api_key_here
   OPENAI_MODEL=gpt-4o-mini

   # Server Configuration
   PORT=3000
   ```

## Getting API Keys

### Cartesia.ai API Key

1. Visit [https://cartesia.ai](https://cartesia.ai)
2. Sign up for an account
3. Navigate to your dashboard
4. Generate an API key
5. Copy the key to your `.env` file

### OpenAI API Key

1. Visit [https://platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Go to API keys section
4. Create a new API key
5. Copy the key to your `.env` file

## Usage

1. **Start the server**:
   ```bash
   npm start
   ```

   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

2. **Open your browser**:
   Navigate to `http://localhost:3000`

3. **Start a conversation**:
   - Click "Connect" to initialize all connections
   - Click "Start Recording" and speak your message
   - Click "Stop Recording" when done
   - The AI will transcribe your speech, process it, and respond with voice

## How It Works

### Backend (`src/server.js`)

1. **WebSocket Server**: Manages bidirectional communication between client and APIs
2. **Cartesia STT Connection**: Receives audio chunks and streams transcriptions
3. **OpenAI Integration**: Sends transcriptions to GPT-4o-mini and receives streaming responses
4. **Cartesia TTS Connection**: Converts AI responses to speech in real-time
5. **Conversation Management**: Maintains conversation history for context

### Frontend (`public/`)

1. **Audio Capture**: Uses Web Audio API to capture microphone input at 16kHz PCM S16LE
2. **Audio Streaming**: Sends audio chunks to server via WebSocket
3. **Real-time Display**: Shows transcriptions and AI responses as they stream in
4. **Audio Playback**: Plays TTS audio chunks as they arrive
5. **Visual Feedback**: Audio visualizer and status indicators

## Technical Details

### Audio Format

- **Sample Rate**: 16000 Hz (recommended for best performance)
- **Encoding**: PCM S16LE (signed 16-bit little-endian)
- **Channels**: Mono (1 channel)

### API Endpoints

- **Cartesia STT**: `wss://api.cartesia.ai/stt/stream`
- **Cartesia TTS**: `wss://api.cartesia.ai/tts/websocket`
- **OpenAI Chat**: Streaming completions via REST API

### Streaming Flow

1. User audio is captured and converted to PCM S16LE format
2. Audio chunks are sent to Cartesia STT WebSocket
3. Transcriptions are forwarded to OpenAI GPT-4o-mini with streaming enabled
4. GPT responses are chunked by sentences and sent to Cartesia TTS
5. TTS audio chunks are played back immediately as they arrive

## Configuration Options

### Voice Selection

You can change the AI voice by modifying `CARTESIA_VOICE_ID` in `.env`. Visit [Cartesia's voice library](https://cartesia.ai/voices) to browse available voices.

### Model Selection

- **STT Model**: Currently using `ink-whisper` (optimized for conversational AI)
- **LLM Model**: Using `gpt-4o-mini` (fast and cost-effective)
- **TTS Model**: Using `sonic-english` (natural-sounding voice)

## Troubleshooting

### Microphone Access Denied

- Check browser permissions for microphone access
- Ensure you're using HTTPS (or localhost for testing)
- Try refreshing the page and granting permission again

### Connection Errors

- Verify all API keys are correctly set in `.env`
- Check that you have sufficient credits/quota on Cartesia and OpenAI accounts
- Ensure firewall isn't blocking WebSocket connections

### Audio Issues

- Check browser console for errors
- Verify audio format settings match (16kHz, PCM S16LE)
- Test your microphone in other applications
- Try using headphones to prevent echo/feedback

### API Rate Limits

- Cartesia STT: $0.13/hour
- OpenAI GPT-4o-mini: $0.15/1M input tokens, $0.60/1M output tokens
- Monitor your usage on respective dashboards

## Project Structure

```
cartesia-conversation-demo/
├── public/
│   ├── index.html          # Frontend UI
│   └── app.js              # Client-side logic
├── src/
│   └── server.js           # Backend WebSocket server
├── .env.example            # Environment variables template
├── package.json            # Dependencies and scripts
└── README.md              # This file
```

## Technologies Used

- **Node.js**: Backend runtime
- **Express**: Web server framework
- **ws**: WebSocket library for Node.js
- **OpenAI SDK**: Official OpenAI client
- **Web Audio API**: Browser audio capture and playback
- **WebSocket API**: Real-time bidirectional communication

## Future Enhancements

- [ ] Add support for multiple languages
- [ ] Implement voice activity detection (VAD)
- [ ] Add conversation export/import
- [ ] Support for custom system prompts
- [ ] Voice interruption handling
- [ ] Audio visualization improvements
- [ ] Mobile responsive design
- [ ] Docker containerization

## License

MIT

## Credits

Created by **aviz**

Powered by:
- [Cartesia.ai](https://cartesia.ai) - STT/TTS APIs
- [OpenAI](https://openai.com) - GPT-4o-mini LLM

## Support

For issues related to:
- **Cartesia API**: [Cartesia Documentation](https://docs.cartesia.ai)
- **OpenAI API**: [OpenAI Documentation](https://platform.openai.com/docs)
- **This project**: Open an issue in the repository
