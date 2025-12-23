## Media receiver: import + list + download (manual notes)

### API endpoints

- **POST** `/api/leads/:leadId/visits/:visitId/assets` (multipart/form-data)
  - Field name(s): `files` (supports multiple)
  - Optional field: `deviceId`
- **GET** `/api/leads/:leadId/visits/:visitId/assets`
- **GET** `/api/assets/:assetId/download`

### Storage layout (local)

Files are stored under:

`DATA_DIR/uploads/leads/{leadId}/visits/{visitId}/{kind}/{assetId}.{ext}`

### cURL examples

These endpoints require auth (cookie-based). Capture your session cookie from the browser and pass it via `-H "Cookie: ..."`.

```bash
# Upload (multiple files)
curl -X POST \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE_VALUE" \
  -F "deviceId=atlas-pwa-local" \
  -F "files=@./sample.jpg" \
  -F "files=@./sample.m4a" \
  http://localhost:3001/api/leads/1/visits/1/assets

# List assets
curl -H "Cookie: connect.sid=YOUR_SESSION_COOKIE_VALUE" \
  http://localhost:3001/api/leads/1/visits/1/assets

# Download an asset
curl -L -H "Cookie: connect.sid=YOUR_SESSION_COOKIE_VALUE" \
  -o downloaded.bin \
  http://localhost:3001/api/assets/<assetId>/download
```

