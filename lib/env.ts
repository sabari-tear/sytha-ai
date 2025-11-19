/**
 * Environment configuration and validation
 */

type EnvironmentConfig = {
  openai: {
    apiKey: string;
    model: string;
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
  const openaiApiKey = validateEnvVar('OPENAI_API_KEY', process.env.OPENAI_API_KEY);
  const pineconeApiKey = validateEnvVar('PINECONE_API_KEY', process.env.PINECONE_API_KEY);
  const pineconeIndex = validateEnvVar('PINECONE_INDEX', process.env.PINECONE_INDEX);

  // Warn about exposed API keys
  if (openaiApiKey.startsWith('sk-') && openaiApiKey.length > 20) {
    console.warn('[SECURITY WARNING] OpenAI API key appears to be hardcoded. Please use environment variables.');
  }

  return {
    openai: {
      apiKey: openaiApiKey,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
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
    
    // Validate OpenAI configuration
    if (!config.openai.apiKey) {
      errors.push('OPENAI_API_KEY is not configured');
    } else if (!config.openai.apiKey.startsWith('sk-')) {
      errors.push('OPENAI_API_KEY appears to be invalid (should start with "sk-")');
    }

    // Validate Pinecone configuration
    if (!config.pinecone.apiKey) {
      errors.push('PINECONE_API_KEY is not configured');
    }
    
    if (!config.pinecone.index) {
      errors.push('PINECONE_INDEX is not configured');
    }

    // Additional model validation
    const validModels = ['gpt-4o-mini', 'gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'];
    if (!validModels.includes(config.openai.model)) {
      console.warn(`[Config] Using non-standard OpenAI model: ${config.openai.model}`);
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