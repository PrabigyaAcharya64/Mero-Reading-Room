/// &lt;reference types="vite/client" />

interface ImportMetaEnv {
    // Firebase Configuration
    readonly VITE_FIREBASE_API_KEY: string
    readonly VITE_FIREBASE_AUTH_DOMAIN: string
    readonly VITE_FIREBASE_PROJECT_ID: string
    readonly VITE_FIREBASE_STORAGE_BUCKET: string
    readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string
    readonly VITE_FIREBASE_APP_ID: string
    readonly VITE_FIREBASE_MEASUREMENT_ID: string

    // Google OAuth
    readonly VITE_GOOGLE_OAUTH_CLIENT_ID: string

    // Brevo Email API
    readonly VITE_BREVO_API_KEY: string
    readonly VITE_BREVO_SENDER_EMAIL: string

    // ImgBB Image Upload API
    readonly VITE_IMGBB_API_KEY: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
