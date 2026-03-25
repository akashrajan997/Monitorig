import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db from './db';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'workpulse-super-secret-key-2026';

// This URL is injected by AI Studio at runtime
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// ==========================================
// PASSWORD AUTHENTICATION
// ==========================================
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required' });
  }

  try {
    // Check if user already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const id = `local-${Date.now()}`;
    const role = 'manager';

    // Insert user
    const stmt = db.prepare(`
      INSERT INTO users (id, email, displayName, role, provider, passwordHash) 
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, email, name, role, 'local', passwordHash);

    // Generate JWT
    const token = jwt.sign({ uid: id, email, role }, JWT_SECRET, { expiresIn: '24h' });

    res.json({ token, user: { id, email, name, role } });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // Find user
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if user registered via OAuth but is trying to use password
    if (!user.passwordHash && user.provider !== 'local') {
      return res.status(401).json({ error: `Please sign in with ${user.provider}` });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT
    const token = jwt.sign({ uid: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

    res.json({ token, user: { id: user.id, email: user.email, name: user.displayName, role: user.role } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ==========================================
// GOOGLE OAUTH
// ==========================================
router.get('/google/url', (req, res) => {
  const redirectUri = `${APP_URL}/api/auth/google/callback`;
  const clientId = process.env.GOOGLE_CLIENT_ID || 'demo-client-id';
  
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'email profile',
    access_type: 'offline',
    prompt: 'consent'
  });

  res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
});

router.get('/google/callback', async (req, res) => {
  const code = req.query.code as string;
  const redirectUri = `${APP_URL}/api/auth/google/callback`;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    // Fallback to simulated login if credentials are not configured
    console.warn("Google OAuth credentials not configured. Using simulated login.");
    return handleSimulatedLogin(res, 'google-12345', 'admin@enterprise.local', 'Enterprise Admin', 'admin', 'google');
  }

  try {
    // 1. Exchange code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for token');
    }

    const tokenData = await tokenResponse.json();

    // 2. Fetch user profile
    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!profileResponse.ok) {
      throw new Error('Failed to fetch user profile');
    }

    const profile = await profileResponse.json();

    // 3. Upsert user in SQLite
    const stmt = db.prepare(`
      INSERT INTO users (id, email, displayName, role, provider) 
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET 
        displayName=excluded.displayName,
        provider=excluded.provider
    `);
    // Default to 'manager' role for new users, admin for specific emails if needed
    const role = 'manager'; 
    stmt.run(profile.id, profile.email, profile.name, role, 'google');

    // 4. Generate JWT
    const token = jwt.sign({ uid: profile.id, email: profile.email, role }, JWT_SECRET, { expiresIn: '24h' });

    sendAuthSuccessHtml(res, token);
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    res.status(500).send('Authentication failed');
  }
});

// ==========================================
// MICROSOFT OAUTH
// ==========================================
router.get('/microsoft/url', (req, res) => {
  const redirectUri = `${APP_URL}/api/auth/microsoft/callback`;
  const clientId = process.env.MICROSOFT_CLIENT_ID || 'demo-client-id';
  
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'user.read',
    response_mode: 'query'
  });

  res.json({ url: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}` });
});

router.get('/microsoft/callback', async (req, res) => {
  const code = req.query.code as string;
  const redirectUri = `${APP_URL}/api/auth/microsoft/callback`;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    // Fallback to simulated login if credentials are not configured
    console.warn("Microsoft OAuth credentials not configured. Using simulated login.");
    return handleSimulatedLogin(res, 'ms-67890', 'manager@enterprise.local', 'Enterprise Manager', 'manager', 'microsoft');
  }

  try {
    // 1. Exchange code for access token
    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        scope: 'user.read',
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for token');
    }

    const tokenData = await tokenResponse.json();

    // 2. Fetch user profile
    const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!profileResponse.ok) {
      throw new Error('Failed to fetch user profile');
    }

    const profile = await profileResponse.json();

    // 3. Upsert user in SQLite
    const stmt = db.prepare(`
      INSERT INTO users (id, email, displayName, role, provider) 
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET 
        displayName=excluded.displayName,
        provider=excluded.provider
    `);
    const role = 'manager';
    stmt.run(profile.id, profile.userPrincipalName || profile.mail, profile.displayName, role, 'microsoft');

    // 4. Generate JWT
    const token = jwt.sign({ uid: profile.id, email: profile.userPrincipalName || profile.mail, role }, JWT_SECRET, { expiresIn: '24h' });

    sendAuthSuccessHtml(res, token);
  } catch (error) {
    console.error('Microsoft OAuth callback error:', error);
    res.status(500).send('Authentication failed');
  }
});

// Helper function for simulated login fallback
function handleSimulatedLogin(res: express.Response, id: string, email: string, name: string, role: string, provider: string) {
  try {
    const stmt = db.prepare(`
      INSERT INTO users (id, email, displayName, role, provider) 
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET 
        displayName=excluded.displayName,
        provider=excluded.provider
    `);
    stmt.run(id, email, name, role, provider);

    const token = jwt.sign({ uid: id, email, role }, JWT_SECRET, { expiresIn: '24h' });
    sendAuthSuccessHtml(res, token);
  } catch (error) {
    console.error('Simulated OAuth callback error:', error);
    res.status(500).send('Authentication failed');
  }
}

// Helper function to send success HTML
function sendAuthSuccessHtml(res: express.Response, token: string) {
  res.send(`
    <html>
      <body>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', token: '${token}' }, '*');
            window.close();
          } else {
            window.location.href = '/';
          }
        </script>
        <p>Authentication successful. This window should close automatically.</p>
      </body>
    </html>
  `);
}

// Middleware to verify JWT
export const requireAuth = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export default router;
