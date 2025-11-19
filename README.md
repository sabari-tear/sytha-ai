# SythaAI - Indian Legal Chatbot

An AI-powered legal assistant specializing in Indian law (IPC, BNS, BSA, CrPC) using Retrieval-Augmented Generation (RAG) with Pinecone vector database and OpenAI GPT-4.

## 🚀 Features

- **AI-Powered Legal Assistance**: Get accurate answers to legal questions based on Indian law
- **Vector-Based Retrieval**: Uses Pinecone for semantic search through legal documents
- **Source Citations**: Every answer includes references to relevant legal sections
- **Modern UI**: Clean, responsive interface built with Next.js and Tailwind CSS
- **Production-Ready**: Comprehensive logging, error handling, and monitoring

## 📋 Prerequisites

- Node.js 18+ and npm
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))
- Pinecone account and API key ([Sign up here](https://www.pinecone.io/))

## 🛠 Setup Instructions

### 1. Clone and Install

```bash
git clone <repository-url>
cd project
npm install
```

### 2. Configure Environment

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

```env
OPENAI_API_KEY=sk-proj-YOUR_OPENAI_KEY_HERE
PINECONE_API_KEY=pcsk_YOUR_PINECONE_KEY_HERE
PINECONE_INDEX=legal-sections
```

**⚠️ Security Warning**: Never commit your `.env` file to version control!

### 3. Verify Configuration

Check that your environment is properly configured:

```bash
npm run check-env
```

This will verify:
- ✅ Environment variables are set
- ✅ OpenAI API is accessible
- ✅ Pinecone connection is working

### 4. Create Pinecone Index

1. Log into your [Pinecone dashboard](https://app.pinecone.io/)
2. Create a new index with:
   - **Name**: `legal-sections`
   - **Dimensions**: `1536` (for text-embedding-3-small)
   - **Metric**: `cosine`
   - **Cloud**: Any available region

### 5. Index Legal Documents

Load the legal dataset into Pinecone:

```bash
# First-time indexing
npm run index-docs

# To clear and re-index
npm run index-docs:clear
```

This will:
- Load legal sections from CSV files (IPC, BNS, BSA, CrPC)
- Load additional statutes from JSON files
- Generate embeddings using OpenAI
- Upload vectors to Pinecone

### 6. Start the Application

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to use the chatbot.

## 📁 Project Structure

```
project/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── chat/         # Chat endpoint
│   │   └── health/       # Health check endpoint
│   ├── admin/            # Admin dashboard
│   └── page.tsx          # Main chat interface
├── components/            # React components
│   └── Chat.tsx          # Chat UI component
├── lib/                   # Core libraries
│   ├── env.ts            # Environment configuration
│   ├── logger.ts         # Logging system
│   ├── openai.ts         # OpenAI client
│   ├── pinecone.ts       # Pinecone client
│   ├── rag.ts            # RAG implementation
│   └── upload.ts         # Document upload utilities
├── scripts/               # Utility scripts
│   ├── index-legal-docs.ts    # Document indexing
│   └── check-environment.ts   # Environment checker
└── dataset/              # Legal documents
    ├── *.csv            # Legal sections
    └── *.json           # Statute files
```

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run index-docs` - Index legal documents to Pinecone
- `npm run index-docs:clear` - Clear and re-index documents
- `npm run check-env` - Verify environment configuration
- `npm run lint` - Run ESLint

## 📊 Monitoring

### Health Check

Check system status at: [http://localhost:3000/api/health](http://localhost:3000/api/health)

### Admin Dashboard

Access the monitoring dashboard at: [http://localhost:3000/admin](http://localhost:3000/admin)

Features:
- Real-time system status
- Service health indicators
- Vector database statistics
- Environment configuration status

## 🔍 Logging

The application includes comprehensive logging:

- **API Requests**: All incoming requests and responses
- **RAG Operations**: Document retrieval and answer generation
- **Pinecone Operations**: Vector searches and uploads
- **OpenAI Calls**: Embeddings and completions

Set log level in `.env`:

```env
LOG_LEVEL=DEBUG  # Options: DEBUG, INFO, WARN, ERROR, FATAL
```

## 🚨 Troubleshooting

### "Vector database is not configured"

1. Check that `PINECONE_API_KEY` and `PINECONE_INDEX` are set in `.env`
2. Verify Pinecone credentials are correct
3. Ensure the index exists in your Pinecone dashboard

### "No matching documents found"

1. Run `npm run index-docs` to populate the vector database
2. Check that the indexing completed successfully
3. Verify your Pinecone index has vectors (check admin dashboard)

### High latency

1. Ensure you're using an appropriate OpenAI model
2. Check Pinecone index region (use closest to your server)
3. Review the number of retrieved documents (default: 8)

## 🔐 Security Best Practices

1. **API Keys**: Never commit API keys to version control
2. **Environment Variables**: Use `.env` for local development only
3. **Production**: Use a secrets management service (e.g., Vercel Environment Variables)
4. **Key Rotation**: Regularly rotate API keys
5. **Access Control**: Implement authentication for production deployments

## 🚀 Deployment

### Deploy to Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/legal-chatbot)

1. Click the button above or manually import your GitHub repository to Vercel
2. Configure environment variables:
   ```
   OPENAI_API_KEY=your_openai_api_key
   PINECONE_API_KEY=your_pinecone_api_key
   ```
3. Deploy! Vercel will automatically build and deploy your application

### Deploy to Netlify

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/yourusername/legal-chatbot)

1. Click the button above or connect your GitHub repository
2. Set environment variables in Netlify dashboard
3. Build command: `npm run build`
4. Publish directory: `.next`

### Deploy to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

1. Connect your GitHub repository
2. Railway will auto-detect Next.js and configure accordingly
3. Add environment variables in the dashboard

### Deploy to Render

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Use these settings:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
4. Add environment variables

### Manual Deployment (VPS/Cloud)

```bash
# Clone the repository
git clone https://github.com/yourusername/legal-chatbot.git
cd legal-chatbot

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Build the application
npm run build

# Start the production server
npm start
```

### Production Checklist

Before deploying to production:

- [ ] **Environment Variables**: Ensure all required environment variables are set
- [ ] **API Keys**: Rotate any exposed API keys and use production keys
- [ ] **Database**: Verify Pinecone index is created and populated
- [ ] **Build Test**: Run `npm run build` locally to ensure no build errors
- [ ] **Environment Check**: Run `npm run check-env` to verify configuration
- [ ] **Initial Data**: Use the `/upload` page to populate the database if empty
- [ ] **HTTPS**: Ensure your deployment uses HTTPS
- [ ] **Domain**: Set up your custom domain (optional)
- [ ] **Monitoring**: Set up error tracking (e.g., Sentry) and analytics (optional)

## 📝 License

This project is for educational and informational purposes only. The legal information provided by this chatbot should not be considered as professional legal advice. Always consult with qualified legal professionals for actual legal matters.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Support

For issues and questions, please open an issue on GitHub or contact the maintainers.

## ⚠️ Disclaimer

This chatbot provides general legal information based on Indian statutes. It is not a substitute for professional legal advice. For any critical legal matter, please consult a qualified advocate or legal professional.