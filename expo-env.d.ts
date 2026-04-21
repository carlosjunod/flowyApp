/// <reference types="expo/types" />

declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_API_BASE_URL: string;
    EXPO_PUBLIC_PB_URL: string;
    EXPO_PUBLIC_R2_PUBLIC_URL: string;
  }
}
