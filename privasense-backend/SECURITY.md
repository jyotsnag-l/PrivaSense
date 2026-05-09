# Security Guidelines for PrivaSense

This document outlines security best practices for deploying and operating PrivaSense.

## 🔐 API Key Management

### Generating Secure API Keys

```bash
# Generate a cryptographically secure API key
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### API Key Best Practices

1. **Never commit API keys to version control**
   - Add `.env` to `.gitignore`
   - Use environment variables or secret management services

2. **Rotate keys periodically**
   - Change API keys every 90 days
   - Have a key rotation process in place

3. **Use different keys for different environments**
   - Development: `dev-api-key-xxx`
   - Staging: `staging-api-key-xxx`
   - Production: `prod-api-key-xxx`

4. **Store keys securely in production**
   - Use AWS Secrets Manager, Azure Key Vault, or similar
   - Never hardcode keys in source code

## 🌐 CORS Configuration

### Development
```env
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

### Production
```env
CORS_ORIGINS=https://yourapp.vercel.app,https://your-domain.com
```

**Never use `*` for CORS origins in production!**

## 🔒 Transport Security

### HTTPS Requirements

- **Always use HTTPS in production**
- Obtain SSL certificates from Let's Encrypt (free) or your hosting provider
- Redirect all HTTP traffic to HTTPS

### Example Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 📊 Rate Limiting

### Default Limits

| Endpoint | Limit | Purpose |
|----------|-------|---------|
| `/health` | 60/min | Health checks |
| `/analyze` | 10/min | Expensive audio processing |
| `/demo` | 20/min | Demo mode |
| `/history` | 30/min | Data retrieval |
| `/status` | 30/min | Status checks |
| `/link` | 10/min | Caregiver linking |

### Adjusting Limits

```env
RATE_LIMIT_PER_MINUTE=30  # Default limit
```

## 🛡️ Input Validation

### User ID Validation

- Must be 3-50 characters
- Only alphanumeric, hyphens, and underscores allowed
- Pattern: `^[a-zA-Z0-9_-]{3,50}$`

### File Upload Validation

- Maximum file size: 25MB (configurable via `MAX_UPLOAD_SIZE`)
- Allowed formats: WAV, WebM, MP3, M4A, OGG
- Files are validated before processing

## 📝 Logging and Monitoring

### Security Events to Monitor

1. **Authentication failures**
   - Multiple failed API key attempts
   - Missing API keys

2. **Rate limit violations**
   - Repeated 429 responses

3. **Invalid input attempts**
   - Malformed user IDs
   - Invalid file types

### Log Configuration

```python
# In config.py or main.py
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
```

## 🔑 Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `API_KEY` | API authentication key | `secure-random-key-32-chars` |
| `CORS_ORIGINS` | Allowed origins | `https://app.example.com` |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `RATE_LIMIT_PER_MINUTE` | Rate limit | `30` |
| `MAX_UPLOAD_SIZE` | Max file size (bytes) | `26214400` (25MB) |
| `DEBUG` | Debug mode | `false` |

## 🚨 Incident Response

### If API Key is Compromised

1. **Immediately generate a new API key**
2. **Update all clients with the new key**
3. **Review logs for unauthorized access**
4. **Consider implementing key rotation automation**

### If Rate Limits are Exceeded

1. **Check if it's legitimate traffic spike**
2. **Review logs for abuse patterns**
3. **Consider adjusting limits if needed**
4. **Implement IP blocking for persistent abusers**

## 📋 Security Checklist

### Before Deployment

- [ ] Generate a strong, unique API key
- [ ] Configure CORS for specific origins only
- [ ] Enable HTTPS
- [ ] Set appropriate rate limits
- [ ] Review and test input validation
- [ ] Enable logging
- [ ] Store secrets securely (not in code)
- [ ] Update all dependencies

### Regular Maintenance

- [ ] Rotate API keys every 90 days
- [ ] Review access logs weekly
- [ ] Update dependencies monthly
- [ ] Audit rate limit settings quarterly
- [ ] Review CORS origins quarterly

## 🛠️ Additional Security Measures (Future)

Consider implementing these for enhanced security:

1. **JWT Authentication** - For user-specific authentication
2. **API Key Scoping** - Different keys for different permissions
3. **IP Whitelisting** - Restrict access to known IPs
4. **Request Signing** - HMAC signatures for requests
5. **Audit Logging** - Detailed logs for compliance
6. **WAF Integration** - Web Application Firewall

## 📞 Security Contact

If you discover a security vulnerability, please report it responsibly:

- Email: [your-security-email@example.com]
- Do not open a public GitHub issue for security vulnerabilities

---

**Note:** This document provides guidelines for MVP deployment. For production deployments handling sensitive health data, consult with security professionals and ensure compliance with relevant regulations (HIPAA, GDPR, etc.).