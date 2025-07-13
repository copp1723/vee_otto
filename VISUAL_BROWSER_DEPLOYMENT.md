# Visual Browser Deployment on Render

This setup allows you to run the vAuto automation with a visible Chrome browser on Render cloud deployment, accessible through a web interface.

## How It Works

1. **Virtual Display**: Uses Xvfb to create a virtual display (since cloud servers don't have physical displays)
2. **VNC Server**: x11vnc captures the virtual display
3. **Web Access**: noVNC provides web-based access to view the browser
4. **Automation**: The vAuto agent runs with `HEADLESS=false` in this virtual display

## Deployment Steps

### 1. Set up Render

1. Push your code to a GitHub repository
2. Connect your GitHub account to Render
3. Create a new Web Service using the `render.yaml` blueprint

### 2. Configure Environment Variables

In Render dashboard, set these secret environment variables:
- `VAUTO_USERNAME` - Your vAuto username
- `VAUTO_PASSWORD` - Your vAuto password
- `MAILGUN_API_KEY` - Your Mailgun API key
- `OPENROUTER_API_KEY` - Your OpenRouter API key
- `TWILIO_ACCOUNT_SID` - Your Twilio account SID
- `TWILIO_AUTH_TOKEN` - Your Twilio auth token

### 3. Configure Twilio Webhook

After deployment, get your Render URL (e.g., `https://vee-otto-visual.onrender.com`) and configure Twilio:

1. Go to Twilio Console → Phone Numbers → Active Numbers
2. Click on your phone number (+13137658345)
3. Set the Messaging webhook URL to:
   ```
   https://vee-otto-visual.onrender.com/webhooks/twilio/sms
   ```
4. Set method to HTTP POST and save

## Accessing the Visual Browser

Once deployed:

1. **Main Dashboard**: Visit `https://your-app.onrender.com`
2. **VNC Browser View**: Visit `https://your-app.onrender.com:6080/vnc.html`
   - Password: `veeotto`
3. **Visual Interface**: Visit `https://your-app.onrender.com:8080`

## Running the Automation

The automation will start automatically after deployment. You can:

1. Watch the browser automation in real-time through the VNC viewer
2. Monitor progress on the dashboard
3. Check logs in the Render dashboard

## Architecture

```
┌─────────────────────────────────────────────┐
│            Render Container                  │
├─────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐        │
│  │   Xvfb      │────│   Chrome    │        │
│  │ (Display:99)│    │ (Visible)   │        │
│  └─────────────┘    └─────────────┘        │
│         │                   │                │
│  ┌─────────────┐    ┌─────────────┐        │
│  │   x11vnc    │────│   noVNC     │        │
│  │  (VNC:5900) │    │ (Web:6080)  │        │
│  └─────────────┘    └─────────────┘        │
│                                             │
│  ┌─────────────────────────────────┐        │
│  │     vAuto Agent + Dashboard     │        │
│  │        (Port: 10000)            │        │
│  └─────────────────────────────────┘        │
└─────────────────────────────────────────────┘
```

## Troubleshooting

### Browser Not Visible
- Check if all services are running: Look at Render logs
- Ensure VNC password is correct: `veeotto`
- Try refreshing the VNC viewer page

### 2FA Not Working
- Verify Twilio webhook URL is correctly configured
- Check Render logs for webhook hits
- Ensure PUBLIC_URL environment variable is set correctly

### Performance Issues
- Render's standard plan should handle the visual browser well
- If slow, increase `SLOW_MO` environment variable
- Consider using headless mode for production runs

## Local Testing

To test the visual browser setup locally:

```bash
# Build and run the Docker container
docker build -f Dockerfile.vnc -t vee-otto-visual .
docker run -p 10000:10000 -p 6080:6080 -p 8080:8080 \
  -e VAUTO_USERNAME="your-username" \
  -e VAUTO_PASSWORD="your-password" \
  # ... other env vars
  vee-otto-visual
```

Then access:
- Dashboard: http://localhost:10000
- VNC Viewer: http://localhost:6080/vnc.html
- Visual Interface: http://localhost:8080