# Cartesia Voice Conversation Demo

A real-time streaming voice conversation application using **Cartesia.ai** for Speech-to-Text (STT) and Text-to-Speech (TTS), powered by **OpenAI GPT-4o-mini** for intelligent responses in Hebrew.

## 🌟 Features

- **Real-time Speech-to-Text**: Stream audio from your microphone directly to Cartesia's STT API
- **AI-Powered Responses**: GPT-4o-mini processes transcriptions and generates intelligent responses in Hebrew
- **Streaming Text-to-Speech**: AI responses are streamed back as natural-sounding Hebrew voice
- **Full-Duplex Communication**: Everything works in real-time with optimized streaming
- **Comprehensive Latency Tracking**: Monitor performance at every stage with detailed metrics
- **Beautiful UI**: Clean, modern interface with visual feedback, audio visualizer, and performance dashboard

## 🏗️ Architecture

### Current Implementation (Node.js + WebSockets)

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │ Audio        │───▶│ WebSocket    │───▶│ Audio        │      │
│  │ Capture      │    │ Connection   │    │ Playback     │      │
│  │ (16kHz PCM)  │    │              │    │ (Real-time)  │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                    │                    ▲              │
│         │ Base64 Audio       │ Audio Chunks       │              │
│         ▼                    ▼                    │              │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ WebSocket (Bidirectional)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                   NODE.JS SERVER (Express + WS)                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  WebSocket Handler                                       │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐             │   │
│  │  │ Receive  │─▶│ Pipeline │─▶│ Stream   │             │   │
│  │  │ Audio    │  │ Manager  │  │ Response │             │   │
│  │  └──────────┘  └──────────┘  └──────────┘             │   │
│  │       │              │              │                   │   │
│  │       │ Latency Tracking (7 stages)│                   │   │
│  │       ▼              ▼              ▼                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│         │              │              │                         │
└─────────┼──────────────┼──────────────┼─────────────────────────┘
          │              │              │
          ▼              ▼              ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Cartesia    │  │   OpenAI     │  │  Cartesia    │
│     STT      │  │  GPT-4o-mini │  │     TTS      │
│  (WebSocket) │  │  (Streaming) │  │  (WebSocket) │
│   Hebrew     │  │   Hebrew     │  │ sonic-multi  │
└──────────────┘  └──────────────┘  └──────────────┘
```

### Upcoming: Vercel Deployment (Edge Functions + HTTP Streaming)

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT (Vite React App)                       │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │ Audio        │───▶│ HTTP POST    │───▶│ Audio        │      │
│  │ Capture      │    │ + SSE Stream │    │ Playback     │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                    │                    ▲              │
│         │ POST /api/conversation  │ SSE Events    │              │
│         ▼                    ▼                    │              │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ HTTP (Request + Streaming Response)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│              VERCEL EDGE FUNCTION (Global Edge Network)          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  /api/conversation.ts (Edge Runtime)                     │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐             │   │
│  │  │ Receive  │─▶│ Stream   │─▶│ Stream   │             │   │
│  │  │ Audio    │  │ Pipeline │  │ Response │             │   │
│  │  │ (POST)   │  │          │  │ (SSE)    │             │   │
│  │  └──────────┘  └──────────┘  └──────────┘             │   │
│  │       │              │              │                   │   │
│  │       │  Latency Tracking + Secure API Keys            │   │
│  │       ▼              ▼              ▼                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│         │              │              │                         │
└─────────┼──────────────┼──────────────┼─────────────────────────┘
          │              │              │
          ▼              ▼              ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Cartesia    │  │   OpenAI     │  │  Cartesia    │
│     STT      │  │  GPT-4o-mini │  │     TTS      │
│  (WebSocket) │  │  (Streaming) │  │  (WebSocket) │
│   Hebrew     │  │   Hebrew     │  │ sonic-multi  │
└──────────────┘  └──────────────┘  └──────────────┘
```

## 🔄 Streaming Solution Explained

### Why Streaming?

Traditional request-response patterns introduce significant latency in voice conversations. Our streaming architecture ensures:
- **Immediate feedback**: Users see transcription as they speak
- **Faster responses**: AI starts speaking before completing the full response
- **Natural conversation flow**: Mimics human-to-human interaction
- **Lower perceived latency**: Progressive rendering keeps users engaged

### Multi-Stage Streaming Pipeline

#### Stage 1: Audio Capture → STT (Speech-to-Text)
```
Microphone → Web Audio API → PCM 16kHz Mono → Cartesia STT WebSocket
                                                     ↓
                                            Streaming Transcript
```
- **Format**: PCM S16LE (16-bit signed little-endian)
- **Sample Rate**: 16kHz (optimal for speech recognition)
- **Language**: Hebrew (`language=he`)
- **Model**: `ink-whisper` (optimized for conversational AI)

#### Stage 2: Transcript → LLM (Large Language Model)
```
Transcript → OpenAI GPT-4o-mini Streaming API → Token-by-token Response
                                                        ↓
                                                   Hebrew Text
```
- **Streaming Mode**: Server-Sent Events (SSE)
- **First Token Latency**: <300ms (tracked)
- **System Prompt**: Hebrew conversation assistant
- **Context**: Full conversation history maintained

#### Stage 3: Text → TTS (Text-to-Speech)
```
Text Chunks → Cartesia TTS Context-based Streaming → Audio Chunks
              (sentence boundaries)                         ↓
                                                      PCM Audio
```
- **Context ID**: Maintains prosody across chunks
- **Continue Flag**: `true` for streaming, `false` for final chunk
- **Model**: `sonic-multilingual` with explicit `language: 'he'`
- **Voice**: Custom Hebrew voice (configurable)
- **First Byte Latency**: <150ms (tracked)

#### Stage 4: Audio Playback
```
Audio Chunks → Web Audio API Buffer → Real-time Playback
```
- **Buffering**: Queue-based with automatic playback
- **Sample Rate**: 16kHz
- **Decoding**: Base64 → PCM → Float32 → AudioBuffer

### Latency Optimization Techniques

1. **Pre-connected WebSockets**: Connections established before first use
2. **Aggressive Chunking**: Stream on all punctuation boundaries (`.!?,;:`)
3. **Context-based TTS**: Maintains natural prosody across chunks
4. **Parallel Processing**: STT, LLM, and TTS overlap when possible
5. **Client-side Buffering**: Smooth audio playback without gaps

## 📊 Latency Tracking

The application tracks latency at every stage:

| Stage | Description | Target | Tracked Metric |
|-------|-------------|--------|----------------|
| **Recording** | Audio capture duration | N/A | User-controlled |
| **STT** | Speech-to-text processing | <500ms | `sttLatency` |
| **LLM First Token** | Time to first AI response | <300ms | `llmFirstToken` |
| **LLM Total** | Full AI response generation | Variable | `llmLatency` |
| **TTS First Byte** | Time to first audio output | <150ms | `ttsFirstByte` |
| **TTS Total** | Full audio generation | Variable | `ttsLatency` |
| **End-to-End** | Complete turn latency | <2000ms | `e2eLatency` |

### Performance Metrics UI

The application displays real-time latency metrics with:
- **Color-coded indicators**: Green (<3s), Orange (<5s), Red (>5s)
- **Stage breakdown**: See exactly where time is spent
- **Console logging**: Detailed timing information for debugging

## 🚀 Vercel Deployment Strategy

### Why Vercel Edge Functions?

| Feature | Traditional Server | Vercel Edge Functions |
|---------|-------------------|----------------------|
| **WebSocket Support** | ✅ Native | ❌ Not supported |
| **HTTP Streaming** | ✅ Supported | ✅ Native support |
| **Global Distribution** | ❌ Single region | ✅ 300+ edge locations |
| **Cold Start** | ~1s | <50ms |
| **API Key Security** | ✅ Server-side | ✅ Server-side |
| **Auto-scaling** | ❌ Manual | ✅ Automatic |
| **Deployment** | Complex | `vercel deploy` |

### Architecture Differences

**Current (Node.js)**:
- Client ↔ WebSocket ↔ Server ↔ APIs
- Bidirectional persistent connection
- Server maintains state per connection

**Vercel (Edge Functions)**:
- Client → HTTP POST → Edge Function → APIs
- Client ← SSE Stream ← Edge Function ← APIs
- Stateless, streaming responses
- Edge Function acts as streaming proxy

### Trade-offs

**Advantages of Vercel:**
- ✅ Lower global latency (edge network)
- ✅ Better scalability (auto-scaling)
- ✅ Simpler deployment (no server management)
- ✅ Cost-effective (pay per execution)
- ✅ Built-in CDN for static assets

**Considerations:**
- ⚠️ No persistent WebSocket connections (use HTTP streaming)
- ⚠️ 60s max function duration (sufficient for our use case)
- ⚠️ Requires refactoring to HTTP-based streaming

### Migration Plan

See `VERCEL_DEPLOYMENT_PLAN.md` for the complete migration strategy including:
- New Vite + React architecture
- Edge Function implementation
- HTTP streaming with SSE
- Performance optimization strategies

## 🛠️ Prerequisites

- Node.js 18+ (for ES modules and WebSocket support)
- Cartesia.ai API key ([Get it here](https://cartesia.ai))
- OpenAI API key ([Get it here](https://platform.openai.com))

## 📥 Installation

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
   CARTESIA_VOICE_ID=5351f3f8-06be-4963-800d-fce17daab951
   CARTESIA_MODEL_ID=sonic-multilingual

   # OpenAI API Configuration
   OPENAI_API_KEY=your_openai_api_key_here
   OPENAI_MODEL=gpt-4o-mini

   # Server Configuration
   PORT=3000
   ```

## 🎯 Usage

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
   - Click "Start Recording" and speak your message in Hebrew
   - Click "Stop Recording" when done
   - The AI will transcribe your speech, process it, and respond with voice
   - Monitor latency metrics in real-time

## 🔧 Technical Details

### Audio Format

- **Sample Rate**: 16000 Hz (recommended for best performance)
- **Encoding**: PCM S16LE (signed 16-bit little-endian)
- **Channels**: Mono (1 channel)
- **Language**: Hebrew (ISO 639-1: `he`)

### API Endpoints

- **Cartesia STT**: `wss://api.cartesia.ai/stt/stream?language=he&model=ink-whisper`
- **Cartesia TTS**: `wss://api.cartesia.ai/tts/websocket`
- **OpenAI Chat**: `https://api.openai.com/v1/chat/completions` (streaming)

### Streaming Flow

1. **User speaks** → Audio captured via Web Audio API
2. **Audio → STT** → Converted to PCM S16LE and streamed to Cartesia STT WebSocket
3. **STT → LLM** → Transcript forwarded to OpenAI GPT-4o-mini with streaming enabled
4. **LLM → TTS** → Response chunked by sentence boundaries and sent to Cartesia TTS
5. **TTS → Client** → Audio chunks streamed back and played immediately
6. **Latency Tracking** → Every stage timed and displayed in UI

### Context-Based TTS Streaming

Cartesia's context-based streaming maintains natural prosody:

```javascript
// First chunk
{
  context_id: "ctx_12345",
  transcript: "שלום,",
  continue: true,  // More text coming
  language: "he",
  voice: { id: "..." }
}

// Middle chunk
{
  context_id: "ctx_12345",
  transcript: "מה שלומך?",
  continue: true,  // Still more
  language: "he",
  voice: { id: "..." }
}

// Final chunk
{
  context_id: "ctx_12345",
  transcript: "איך אני יכול לעזור?",
  continue: false,  // Done
  language: "he",
  voice: { id: "..." }
}
```

This ensures smooth, natural speech across multiple text chunks.

## ⚙️ Configuration Options

### Voice Selection

Change the AI voice by modifying `CARTESIA_VOICE_ID` in `.env`. Visit [Cartesia's voice library](https://cartesia.ai/voices) to browse available voices.

### Model Selection

- **STT Model**: `ink-whisper` (optimized for conversational AI with Hebrew support)
- **LLM Model**: `gpt-4o-mini` (fast, cost-effective, excellent Hebrew support)
- **TTS Model**: `sonic-multilingual` (natural-sounding multilingual voice)

### Language Configuration

Currently configured for Hebrew (`he`). To change language:
1. Update `language: 'he'` in `src/server.js` (STT and TTS)
2. Update system prompt in `src/server.js` to target language
3. Select appropriate voice from Cartesia's library

## 🐛 Troubleshooting

### Microphone Access Denied

- Check browser permissions for microphone access
- Ensure you're using HTTPS (or localhost for testing)
- Try refreshing the page and granting permission again

### Connection Errors

- Verify all API keys are correctly set in `.env`
- Check that you have sufficient credits/quota on Cartesia and OpenAI accounts
- Ensure firewall isn't blocking WebSocket connections
- Check console for detailed error messages

### Audio Issues

- Check browser console for errors
- Verify audio format settings match (16kHz, PCM S16LE)
- Test your microphone in other applications
- Try using headphones to prevent echo/feedback
- Check audio visualizer to confirm audio capture

### High Latency

- Check "Performance Metrics" panel to identify bottleneck
- Verify internet connection stability
- Consider server location (Vercel deployment recommended for global low latency)
- Check API service status pages

### API Rate Limits

- **Cartesia STT**: $0.13/hour
- **OpenAI GPT-4o-mini**: $0.15/1M input tokens, $0.60/1M output tokens
- Monitor your usage on respective dashboards

## 📁 Project Structure

### Current Structure (Node.js)
```
cartesia-conversation-demo/
├── public/
│   ├── index.html          # Frontend UI with latency panel
│   └── app.js              # Client-side WebSocket logic
├── src/
│   └── server.js           # Backend WebSocket server
├── .env.example            # Environment variables template
├── .env                    # Your configuration (not in git)
├── package.json            # Dependencies and scripts
├── README.md              # This file
└── VERCEL_DEPLOYMENT_PLAN.md  # Migration plan
```

### Future Structure (Vite + Vercel)
```
cartesia-conversation-demo/
├── api/
│   ├── conversation.ts     # Edge Function handler
│   └── health.ts          # Health check
├── src/
│   ├── components/        # React components
│   ├── services/          # API clients
│   └── main.ts           # Entry point
├── public/                # Static assets
├── vercel.json           # Vercel configuration
├── vite.config.ts        # Vite configuration
└── package.json          # Dependencies
```

## 🛠️ Technologies Used

### Current Stack
- **Node.js**: Backend runtime
- **Express**: Web server framework
- **ws**: WebSocket library for Node.js
- **OpenAI SDK**: Official OpenAI client
- **Web Audio API**: Browser audio capture and playback
- **WebSocket API**: Real-time bidirectional communication

### Future Stack (Vercel)
- **Vite**: Lightning-fast build tool
- **React**: Modern UI framework
- **TypeScript**: Type-safe development
- **Vercel Edge Functions**: Serverless computing at the edge
- **HTTP Streaming (SSE)**: Real-time server-to-client communication
- **Tailwind CSS**: Utility-first styling

## 🎯 Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| STT Latency | <500ms | ✅ Optimized |
| LLM First Token | <300ms | ✅ Streaming enabled |
| TTS First Byte | <150ms | ✅ Context streaming |
| End-to-End | <2000ms | ✅ Aggressive chunking |

## 🚀 Deployment

### Current Deployment (Self-hosted)

1. Set up Node.js server
2. Configure environment variables
3. Run `npm start`
4. Open firewall for WebSocket connections

### Vercel Deployment (Coming Soon)

1. Install Vercel CLI: `npm i -g vercel`
2. Link project: `vercel link`
3. Add environment variables: `vercel env add`
4. Deploy: `vercel deploy --prod`

See `VERCEL_DEPLOYMENT_PLAN.md` for complete migration guide.

## 📝 License

MIT

## 👨‍💻 Credits

Created by **aviz**

Powered by:
- [Cartesia.ai](https://cartesia.ai) - STT/TTS APIs (sonic-multilingual)
- [OpenAI](https://openai.com) - GPT-4o-mini LLM

## 🆘 Support

For issues related to:
- **Cartesia API**: [Cartesia Documentation](https://docs.cartesia.ai)
- **OpenAI API**: [OpenAI Documentation](https://platform.openai.com/docs)
- **This project**: Open an issue in the repository

## 🔗 Resources

- **GitHub Repository**: https://github.com/aviz85/cartesia-conversation-demo
- **Deployment Plan**: See `VERCEL_DEPLOYMENT_PLAN.md`
- **Quick Start**: See `QUICKSTART.md`
