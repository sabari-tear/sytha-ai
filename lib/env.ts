/**
 * Environment configuration and validation
 */

type EnvironmentConfig = {
  gemini: {
    apiKey: string;
    model: string;
  };
  huggingface: {
    apiKey?: string;  // Optional - works without key but with rate limits
    embeddingModel: string;
  };
  pinecone: {
    apiKey: string;
    index: string;
    environment?: string;
  };
  app: {
    nodeEnv: string;
    isDevelopment: boolean;
    isProduction: boolean;
  };
};

class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

function validateEnvVar(name: string, value: string | undefined, required: boolean = true): string {
  if (!value && required) {
    throw new ConfigurationError(`Missing required environment variable: ${name}`);
  }
  return value || '';
}

function getConfig(): EnvironmentConfig {
  // Validate critical environment variables
  const geminiApiKey = validateEnvVar('GEMINI_API_KEY', process.env.GEMINI_API_KEY);
  
  // Pinecone is REQUIRED for vector-based retrieval
  const pineconeApiKey = validateEnvVar('PINECONE_API_KEY', process.env.PINECONE_API_KEY, true);
  const pineconeIndex = validateEnvVar('PINECONE_INDEX', process.env.PINECONE_INDEX, true);
  
  // HuggingFace API key is optional - it works without it but with rate limits
  const huggingfaceApiKey = process.env.HUGGINGFACE_API_KEY;

  // Warn about exposed API keys
  if (geminiApiKey.startsWith('AI') && geminiApiKey.length > 20) {
    console.warn('[SECURITY WARNING] Gemini API key appears to be hardcoded. Please use environment variables.');
  }

  return {
    gemini: {
      apiKey: geminiApiKey,
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    },
    huggingface: {
      apiKey: huggingfaceApiKey,
      embeddingModel: process.env.HF_EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2',
    },
    pinecone: {
      apiKey: pineconeApiKey,
      index: pineconeIndex,
      environment: process.env.PINECONE_ENVIRONMENT,
    },
    app: {
      nodeEnv: process.env.NODE_ENV || 'development',
      isDevelopment: process.env.NODE_ENV === 'development',
      isProduction: process.env.NODE_ENV === 'production',
    },
  };
}

// Create singleton config instance
let _config: EnvironmentConfig | null = null;

export function getEnvConfig(): EnvironmentConfig {
  if (!_config) {
    _config = getConfig();
  }
  return _config;
}

export function validateEnvironment(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    const config = getEnvConfig();
    
    // Validate Gemini configuration
    if (!config.gemini.apiKey) {
      errors.push('GEMINI_API_KEY is not configured');
    } else if (!config.gemini.apiKey.startsWith('AI')) {
      errors.push('GEMINI_API_KEY appears to be invalid (should start with "AI")');
    }
    
    // HuggingFace API key is optional but recommend having one
    if (!config.huggingface.apiKey) {
      console.warn('[Config] No HUGGINGFACE_API_KEY found. Will use free tier with rate limits.');
    }

    // Pinecone is optional - we can use MongoDB-only retrieval
    if (!config.pinecone.apiKey) {
      console.warn('[Config] PINECONE_API_KEY not configured. Using MongoDB-only retrieval.');
    }
    
    if (!config.pinecone.index) {
      console.warn('[Config] PINECONE_INDEX not configured. Using MongoDB-only retrieval.');
    }

    // Validate Gemini model
    if (!config.gemini.model) {
      errors.push('GEMINI_MODEL is not configured');
    }

  } catch (error) {
    if (error instanceof ConfigurationError) {
      errors.push(error.message);
    } else {
      errors.push(`Configuration validation error: ${error}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export { ConfigurationError };