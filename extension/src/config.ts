// Backend configuration for the extension. These are PUBLIC values (publishable
// anon key + REST URL); the user's access token gates all reads/writes via RLS.
export const SUPABASE_URL = "https://oqcqrxvwbzjgtyeoavzo.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xY3FyeHZ3YnpqZ3R5ZW9hdnpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NTQ0NTksImV4cCI6MjA5ODMzMDQ1OX0.EYdSjDIel5DCiZFi2zmdDJ7vNR-tJo_ipGIh2y6dCIQ";
// Web app origin the extension will hand off to during the auth handshake.
// Override at build time via APP_URL env var; defaults to localhost for dev.
export const APP_URL = process.env.APP_URL ?? "http://localhost:8080";
export const LINK_PATH = "/extension/connect";
export const AUTH_STORAGE_KEY = "careeros_ext_session_v1";
