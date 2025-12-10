# Cloudflare Worker Integration

This document describes the integration with the Cloudflare Worker at `hail-mary.martinbibb.workers.dev` which provides API keys and email services to the Hail-Mary application.

## Overview

The Cloudflare Worker serves as a secure storage for API keys and provides email sending capabilities. This keeps sensitive API keys out of the application codebase and environment variables, and centralizes email functionality.

## Required Endpoints

### 1. GET / - Fetch API Keys

Returns the API keys needed by the application.

**Request:**
```
GET https://hail-mary.martinbibb.workers.dev
Accept: application/json
```

**Response:**
```json
{
  "GRMINI_API_KEY": "your-grmini-api-key",
  "OPENAI_API_KEY": "your-openai-api-key",
  "ANTHROPIC_API_KEY": "your-anthropic-api-key"
}
```

**Priority Order:**
The application uses these keys in the following priority order:
1. GRMINI_API_KEY (first choice)
2. OPENAI_API_KEY (second choice)
3. ANTHROPIC_API_KEY (third choice)

**Notes:**
- All fields are optional - the worker can omit keys that are not configured
- The application will fall back to environment variables if the worker is unavailable
- Keys are cached for 5 minutes to minimize worker requests

### 2. POST /send-email - Send Email

Sends an email using the worker's email service.

**Request:**
```
POST https://hail-mary.martinbibb.workers.dev/send-email
Content-Type: application/json

{
  "to": "user@example.com",
  "subject": "Email Subject",
  "text": "Plain text version of the email",
  "html": "<html><body>HTML version of the email</body></html>"
}
```

**Response:**
```json
{
  "success": true
}
```

Or on error:
```json
{
  "success": false,
  "error": "Error message description"
}
```

## Example Cloudflare Worker Implementation

```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // CORS headers for API access
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // GET / - Return API keys
    if (request.method === 'GET' && url.pathname === '/') {
      const keys = {
        GRMINI_API_KEY: env.GRMINI_API_KEY,
        OPENAI_API_KEY: env.OPENAI_API_KEY,
        ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
      };
      
      return new Response(JSON.stringify(keys), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }
    
    // POST /send-email - Send email
    if (request.method === 'POST' && url.pathname === '/send-email') {
      try {
        const { to, subject, text, html } = await request.json();
        
        // Use your preferred email service (e.g., SendGrid, Resend, etc.)
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'noreply@yourdomain.com',
            to,
            subject,
            text,
            html,
          }),
        });
        
        if (!emailResponse.ok) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Failed to send email',
          }), {
            status: 500,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          });
        }
        
        return new Response(JSON.stringify({ success: true }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error.message,
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      }
    }
    
    return new Response('Not Found', { status: 404 });
  },
};
```

## Environment Variables in Cloudflare Worker

Configure these secrets in your Cloudflare Worker:

1. **GRMINI_API_KEY** - GRMINI API key (optional)
2. **OPENAI_API_KEY** - OpenAI API key (optional)
3. **ANTHROPIC_API_KEY** - Anthropic API key (optional)
4. **RESEND_API_KEY** - Email service API key (or use your preferred email service)

## Security Considerations

1. **API Key Storage**: Keep API keys in Cloudflare Worker secrets, never in code
2. **CORS**: Configure appropriate CORS headers for production (don't use `*` in production)
3. **Rate Limiting**: Consider implementing rate limiting on the worker endpoints
4. **Email Validation**: Validate email addresses before sending
5. **Authentication**: Consider adding authentication to the worker endpoints if needed

## Application Fallback Behavior

The Hail-Mary application implements graceful fallbacks:

1. **API Keys**: If the worker is unavailable, the app falls back to environment variables:
   - `OPENAI_API_KEY`
   - `ANTHROPIC_API_KEY`

2. **Email Sending**: If the worker email service fails, the app logs the password reset URL to the console

## Testing

To test the worker integration:

1. Test API key endpoint:
   ```bash
   curl https://hail-mary.martinbibb.workers.dev
   ```

2. Test email endpoint:
   ```bash
   curl -X POST https://hail-mary.martinbibb.workers.dev/send-email \
     -H "Content-Type: application/json" \
     -d '{
       "to": "test@example.com",
       "subject": "Test Email",
       "text": "Test message",
       "html": "<p>Test message</p>"
     }'
   ```

## Monitoring

Monitor these metrics for the worker:

- Request count and latency
- Email send success/failure rate
- API key fetch errors
- Rate limit hits (if implemented)

## Troubleshooting

**API keys not working:**
- Check worker logs for errors
- Verify secrets are configured correctly in Cloudflare dashboard
- Check CORS headers are allowing requests from your domain

**Emails not sending:**
- Check email service API key is valid
- Verify email service is working
- Check worker logs for email sending errors
- Ensure "from" email address is verified with your email service
