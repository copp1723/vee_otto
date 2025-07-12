/**
 * vAuto Mockup Test Configuration
 * This configuration allows testing against the local mockup instead of the live vAuto site
 */

export const vAutoMockupConfig = {
  // Base URL for the mockup server
  baseUrl: 'http://localhost:3001',
  
  // Mockup selectors (matching the HTML structure)
  selectors: {
    login: {
      url: 'http://localhost:3001',
      username: '#username',
      password: '#password',
      submitButton: 'button[onclick="goToPassword()"]',
      passwordSubmit: 'button[onclick="goToSelector()"]'
    },
    
    dealershipSelector: {
      dropdown: '#dealership',
      submitButton: 'button[onclick="goToHomepage()"]'
    },
    
    homepage: {
      pricingMenu: '.group button:has-text("Pricing")',
      inventoryLink: 'a[onclick="goToInventory()"]'
    },
    
    inventory: {
      filterDropdown: '#days-filter',
      applyButton: 'button[onclick="applyFilter()"]',
      vehicleList: '#inventory-list',
      vehicleItem: '#inventory-list li'
    },
    
    windowSticker: {
      popup: '#window-sticker-popup',
      closeButton: 'button[onclick="closePopup()"]',
      editButton: 'button[onclick="closePopupAndGoToDescription()"]'
    },
    
    description: {
      checkboxContainer: '#description-checkboxes',
      checkbox: '#description-checkboxes input[type="checkbox"]',
      saveButton: 'button[onclick="saveDescriptionAndGoToBooks()"]'
    },
    
    bookValues: {
      tabButtons: '.tab-button',
      syncButton: 'button[onclick="confirmBookValues()"]'
    },
    
    report: {
      vinElement: '#report-vin',
      featuresElement: '#report-features',
      resetButton: 'button[onclick="resetMockup()"]'
    }
  },
  
  // Test data
  testData: {
    credentials: {
      username: 'testuser',
      password: 'testpass'
    },
    dealership: 'vAuto Test Dealership',
    vehicles: [
      {
        vin: 'VIN123ABC',
        name: '2024 Ford Explorer',
        hasSticker: true
      },
      {
        vin: 'VIN456DEF', 
        name: '2023 Honda CR-V',
        hasSticker: true
      },
      {
        vin: 'VIN789GHI',
        name: '2024 Toyota Camry',
        hasSticker: false // Will trigger error flow
      }
    ]
  }
};

export default vAutoMockupConfig;