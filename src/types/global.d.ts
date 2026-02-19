// Global type definitions

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DATABASE_URL: string;
      JWT_SECRET: string;
      JWT_REFRESH_SECRET: string;
      NODE_ENV: 'development' | 'production' | 'test';
      PORT?: string;
      BCRYPT_ROUNDS?: string;
    }
  }

  interface Crypto {
    randomUUID(): string;
  }

  var crypto: Crypto;
}

export {};