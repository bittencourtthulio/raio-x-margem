export function webAuthConfig() {
  return { apiKey: process.env.FIREBASE_WEB_API_KEY ?? '', authDomain: process.env.FIREBASE_AUTH_DOMAIN ?? '', projectId: process.env.FIREBASE_PROJECT_ID ?? '', appId: process.env.FIREBASE_WEB_APP_ID ?? '' };
}
