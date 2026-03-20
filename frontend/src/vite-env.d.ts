/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly NEXT_PUBLIC_RPC_URL?: string;
  readonly NEXT_PUBLIC_POLKASTREAM_ADDRESS?: string;
  readonly NEXT_PUBLIC_USAGE_SETTLEMENT_HUB_ADDRESS?: string;
  readonly NEXT_PUBLIC_TOKEN_PRESETS?: string;
  readonly NEXT_PUBLIC_API_BASE_URL?: string;
  readonly NEXT_PUBLIC_API_AUTH_TOKEN?: string;
  readonly VITE_RPC_URL?: string;
  readonly VITE_POLKASTREAM_ADDRESS?: string;
  readonly VITE_USAGE_SETTLEMENT_HUB_ADDRESS?: string;
  readonly VITE_TOKEN_PRESETS?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_AUTH_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
