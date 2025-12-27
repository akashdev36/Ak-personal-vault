export const GOOGLE_CONFIG = {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
    scopes: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive.appdata',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
    ],
    discoveryDocs: [
        'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
    ],
    driveFolder: 'MyNotesApp',
}
