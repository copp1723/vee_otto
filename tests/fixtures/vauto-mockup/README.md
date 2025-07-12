# vAuto Mockup Test Interface

This mockup provides a realistic testing environment for the vAuto integration without requiring access to the live vAuto system.

## Features

- **Complete UI Flow**: Login → Dealership Selection → Homepage → Inventory → Vehicle Details → Book Values → Report
- **Multiple Test Scenarios**:
  - VIN123ABC: Full flow with window sticker and features
  - VIN456DEF: Full flow with different features  
  - VIN789GHI: No sticker scenario (triggers flagging)
- **Interactive Elements**: Dropdowns, checkboxes, tabs, modals
- **Responsive Design**: Works on desktop and mobile viewports

## Quick Start

### 1. Run the Mockup Server

```bash
# From the project root
node tests/serve-vauto-mockup.js
```

The mockup will be available at: http://localhost:3001

### 2. Manual Testing

1. Open http://localhost:3001 in your browser
2. Login with any username/password
3. Select any dealership
4. Navigate: Pricing menu → View Inventory
5. Click on vehicles to test different scenarios

### 3. Automated Testing

```bash
# Run the automated test suite
npx ts-node tests/test-vauto-mockup.ts
```

## Test Flow Details

### Login Process
1. **Username Page**: Enter any username
2. **Password Page**: Enter any password  
3. **Dealership Selection**: Choose from dropdown
4. **Homepage**: Main dashboard with dropdown menus

### Inventory Management
- **Filter Options**: Days in stock filter
- **Vehicle List**: Three test vehicles with different scenarios
- **Flag Indicators**: Red flag for vehicles without stickers

### Vehicle Processing
1. **Window Sticker**: View standard and optional features
2. **Description Editor**: Toggle feature checkboxes
3. **Book Value Sync**: 
   - Three tabs: J.D. Power, KBB, Black Book
   - Dynamic value calculations based on selected features
   - Sync summary showing all values
4. **Report Generation**: Success confirmation with details

## Customization

### Adding Vehicles

Edit the `vehicleData` object in `index.html`:

```javascript
'NEW_VIN': {
    name: '2024 Model Name',
    stock: '12345',
    price: '$35,000',
    hasSticker: true,
    features: [
        { name: 'Feature Name', price: 500, standard: false, checked: false },
        // Add more features...
    ],
    bookValues: {
        jdpower: { base: 33000 },
        kbb: { base: 33500 },
        blackbook: { base: 32800 }
    }
}
```

### Modifying Selectors

Update selectors in `config.ts` to match any UI changes:

```typescript
selectors: {
    login: {
        username: '#username',  // Update if ID changes
        // etc...
    }
}
```

## Integration with Main Test Suite

The mockup can be used as a replacement for the live vAuto site during development:

```typescript
// In your test configuration
const usesMockup = process.env.USE_VAUTO_MOCKUP === 'true';
const baseUrl = usesMockup ? 'http://localhost:3001' : 'https://vauto.com';
```

## Troubleshooting

- **Server won't start**: Check if port 3001 is already in use
- **Page not loading**: Ensure the server is running and check browser console
- **Tests failing**: Run with `headless: false` to see what's happening

## Benefits

1. **No External Dependencies**: Works offline, no vAuto credentials needed
2. **Consistent Test Data**: Same vehicles and features every time
3. **Fast Development**: Instant page loads, no network delays
4. **Safe Testing**: No risk of affecting production data
5. **Easy Debugging**: Full control over the test environment

## Future Enhancements

- [ ] Add more vehicle types and edge cases
- [ ] Implement search functionality
- [ ] Add pagination for large inventories
- [ ] Include more detailed error scenarios
- [ ] Add data persistence between sessions