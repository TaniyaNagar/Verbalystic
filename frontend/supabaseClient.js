(function () {
  const config = {
    backendBaseUrl: "https://verbalystic-idto.onrender.com",
    supabaseUrl: "https://lbacierqszcgokimijtg.supabase.co",
    supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxiYWNpZXJxc3pjZ29raW1panRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0ODEyMTEsImV4cCI6MjA3OTA1NzIxMX0.roI92a8edtAlHGL78effXlQ3XRCwAF2lGpBkyX4SQIE"
  };

  window.VERBALYSTIC_CONFIG = {
    ...(window.VERBALYSTIC_CONFIG || {}),
    ...config
  };

  if (window.supabase && !window.supabaseClient) {
    window.supabaseClient = window.supabase.createClient(
      window.VERBALYSTIC_CONFIG.supabaseUrl,
      window.VERBALYSTIC_CONFIG.supabaseAnonKey
    );
  }

  window.getAuthHeaders = async function getAuthHeaders(extraHeaders = {}) {
    const headers = { ...extraHeaders };

    if (!window.supabaseClient) return headers;

    const { data } = await window.supabaseClient.auth.getSession();
    const token = data?.session?.access_token;

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  };

  window.authenticatedFetch = async function authenticatedFetch(url, options = {}) {
    const headers = await window.getAuthHeaders(options.headers || {});
    return fetch(url, { ...options, headers });
  };

  window.ensureBackendUserProfile = async function ensureBackendUserProfile() {
    const res = await window.authenticatedFetch(
      `${window.VERBALYSTIC_CONFIG.backendBaseUrl}/sync-user-profile`,
      { method: "POST" }
    );

    if (!res.ok) {
      throw new Error("Backend user profile sync failed");
    }

    return res.json();
  };
})();
