# VAuto MVP End-to-End Automation

This is the MVP (Minimum Viable Product) implementation that combines the best elements from all our previous implementations into one reliable, comprehensive solution.

## What It Does

The MVP automation performs the complete end-to-end workflow:

1. **Login & 2FA** - Handles authentication with session persistence
2. **Navigate to Inventory** - Accesses the vehicle inventory page
3. **Apply Age Filter** - Filters vehicles aged 0-1 days
4. **Process Vehicles** - For each vehicle:
   - Clicks the vehicle link to open modal
   - Navigates to Factory Equipment tab
   - Accesses window sticker content
   - Extracts features from window sticker
   - Maps features to checkboxes
   - Updates checkboxes accordingly
   - Saves changes
5. **Handle Pagination** - Processes multiple pages of results
6. **Generate Reports** - Creates detailed JSON reports

## Key Features

### 🔄 Robust Error Handling
- Retry logic for flaky operations
- Graceful error recovery
- Detailed error logging

### 💾 Session Persistence
- Saves authentication session
- Skips login on subsequent runs if session is valid

### 📸 Debug Screenshots
- Takes screenshots at key points
- Captures errors for debugging

### 📊 Comprehensive Reporting
- JSON reports with all processing details
- Per-vehicle success/failure tracking
- Feature and checkbox update counts

### ⚙️ Configurable
- Control number of vehicles to process
- Control number of pages to process
- Headless/headed mode
- Adjustable action delays

## Usage

### Basic Usage

```bash
# Set credentials
export VAUTO_USERNAME="your-username"
export VAUTO_PASSWORD="your-password"

# Run the MVP
./scripts/run-mvp.sh
```

### Advanced Usage

```bash
# Process 10 vehicles across 2 pages in headless mode
HEADLESS=true MAX_VEHICLES=10 MAX_PAGES=2 ./scripts/run-mvp.sh

# Process all vehicles on first page with slow actions for debugging
MAX_PAGES=1 SLOW_MO=2000 ./scripts/run-mvp.sh

# Process just 1 vehicle for testing
MAX_VEHICLES=1 ./scripts/run-mvp.sh
```

### Direct TypeScript Execution

```bash
# Run directly with ts-node
npx ts-node scripts/run-mvp-end-to-end.ts
```

## Environment Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `VAUTO_USERNAME` | VAuto username | Required | `john.doe@example.com` |
| `VAUTO_PASSWORD` | VAuto password | Required | `secretpass123` |
| `HEADLESS` | Run browser in headless mode | `false` | `true` |
| `MAX_VEHICLES` | Maximum vehicles to process | All | `10` |
| `MAX_PAGES` | Maximum pages to process | All | `2` |
| `SLOW_MO` | Delay between actions (ms) | `1000` | `500` |

## Output

### Directory Structure

```
vee_otto/
├── screenshots/mvp/     # Debug screenshots
├── reports/mvp/         # JSON reports
├── session/             # Saved auth sessions
└── logs/                # Execution logs
```

### Report Format

```json
{
  "totalVehicles": 25,
  "successful": 23,
  "failed": 2,
  "totalFeaturesFound": 450,
  "totalCheckboxesUpdated": 380,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "results": [
    {
      "vin": "1C4RJKBG5S8733448",
      "success": true,
      "featuresFound": 18,
      "checkboxesUpdated": 15,
      "timestamp": "2024-01-15T10:31:00.000Z"
    }
  ]
}
```

## Troubleshooting

### Vehicle Clicking Issues

The MVP uses multiple strategies to click vehicles:
1. Direct link click
2. Force click
3. JavaScript evaluation

If clicking fails, check:
- Screenshots in `screenshots/mvp/`
- Ensure inventory grid is fully loaded
- Adjust `SLOW_MO` for slower actions

### Factory Equipment Access

The MVP uses the `VehicleModalNavigationService` which:
1. Ensures Vehicle Info tab is active first
2. Uses multiple selectors for Factory Equipment
3. Detects both popup windows and iframe content

### Session Issues

If you see authentication errors:
1. Delete `session/auth-session.json`
2. Run again to create fresh session
3. Ensure 2FA code is entered correctly

## Best Practices

1. **Start Small**: Test with `MAX_VEHICLES=1` first
2. **Use Headed Mode**: Set `HEADLESS=false` for debugging
3. **Check Reports**: Always review JSON reports for success rates
4. **Monitor Logs**: Tail logs in real-time with `tail -f logs/mvp-*.log`

## Implementation Details

This MVP combines the best elements from:

- **Modular Scripts**: Clean separation of concerns, session persistence
- **Visual End-to-End**: Simple, direct selectors
- **Enhanced Processing**: Robust error handling, retry logic
- **Hybrid Processing**: Advanced configuration, comprehensive reporting

Key improvements:
- Unified error handling across all operations
- Better vehicle link detection using row-based approach
- Robust Factory Equipment navigation with tab verification
- Comprehensive reporting with per-vehicle details
- Session persistence to avoid repeated logins

## Next Steps

After validating the MVP:
1. Monitor success rates across multiple runs
2. Tune selectors based on failures
3. Add email notifications for reports
4. Implement parallel processing for speed
5. Add more detailed feature mapping analytics