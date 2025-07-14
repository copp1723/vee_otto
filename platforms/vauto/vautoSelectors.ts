// vAuto UI selectors configuration
export const vAutoSelectors = {
  login: {
    url: 'https://vauto.signin.coxautoinc.com/?solutionID=VAT_prod&clientId=68e5c360aa114799a67e94c4d587ff65',
    username: '//input[@id="username"]',
    nextButton: '//button[contains(text(), "Next")]',
    password: '//input[@type="password"]',
    submit: '//button[@type="submit"]',
    phoneOption: '//button[contains(text(), "Text") or contains(text(), "SMS") or contains(text(), "Phone")] | //div[contains(text(), "Text") or contains(text(), "SMS") or contains(text(), "Phone")] | //span[contains(text(), "Text") or contains(text(), "SMS") or contains(text(), "Phone")] | //a[contains(text(), "Text") or contains(text(), "SMS") or contains(text(), "Phone")] | //*[contains(@class, "phone") or contains(@class, "sms") or contains(@class, "text")]',
    otpInput: '//input[contains(@id, "otp")] | //input[contains(@name, "otp")] | //input[contains(@placeholder, "code")] | //input[@type="text"][contains(@class, "code")] | //input[@type="number"] | //input[contains(@id, "verification")] | //input[contains(@name, "verification")]',
    otpSubmit: '//button[contains(text(), "Verify")] | //button[contains(text(), "Submit")] | //button[contains(text(), "Continue")] | //button[@type="submit"] | //input[@type="submit"]',
  },
  
  dashboard: {
    url: 'https://provision.vauto.app.coxautoinc.com/Va/Dashboard/ProvisionEnterprise/Default.aspx',
  },
  
  inventory: {
    viewInventoryLink: '//a[contains(text(), "View Inventory")]',
    filterButton: '//button[contains(text(), "Filter")]',
    ageFilterLabel: '//label[contains(text(), "Age")]',
    ageMinInput: '//input[@id="ext-gen114"]',
    ageMaxInput: '//input[@id="ext-gen115"]',
    applyFilter: '//button[@id="ext-gen745"]',
    vehicleRows: '//div[@id="ext-gen25"]/div/table/tbody/tr/td[4]/div/div[1]/a/div',
    nextPageButton: '//button[@id="ext-gen41"]',
    nextPageDisabled: '//button[@id="ext-gen41" and @disabled]',
    totalVehiclesText: '//div[contains(@class, "total-count")]',
  },
  
  vehicleDetails: {
    factoryEquipmentTab: '//a[@id="ext-gen201"]',
    windowStickerButton: '//button[contains(text(), "View Window Sticker")]',
    stickerContentContainer: '//div[contains(@class, "window-sticker-details")]',
    // Alternative selectors for window sticker content
    stickerContentAlt1: '//div[@id="window-sticker-content"]',
    stickerContentAlt2: '//iframe[contains(@src, "window-sticker")]',
    
    // Checkbox patterns - will use dynamic xpath generation
    checkboxByLabel: (label: string) => `//label[contains(text(), "${label}")]/preceding-sibling::input[@type="checkbox"]`,
    checkboxByLabelAlt: (label: string) => `//label[contains(text(), "${label}")]/parent::*/input[@type="checkbox"]`,
    
    // Save button variations
    saveButton: '//button[contains(text(), "Save")]',
    saveButtonAlt: '//button[contains(@class, "save-button")]',
    updateButton: '//button[contains(text(), "Update")]',
    
    // VIN field for logging
    vinField: '//span[contains(@class, "vin")] | //div[contains(@class, "vehicle-vin")]',
  },
  
  // Loading indicators
  loading: {
    spinner: '//div[contains(@class, "loading")] | //div[contains(@class, "spinner")]',
    progressBar: '//div[contains(@class, "progress")]',
    overlay: '//div[contains(@class, "overlay")]',
  },
  
  // Error messages
  errors: {
    genericError: '//div[contains(@class, "error")] | //div[contains(@class, "alert-danger")]',
    sessionTimeout: '//div[contains(text(), "session") and contains(text(), "expired")]',
  }
};

// Helper function to get all possible selectors for an element
export function getSelectors(path: string[]): string[] {
  let obj: any = vAutoSelectors;
  for (const key of path) {
    obj = obj[key];
  }
  return Array.isArray(obj) ? obj : [obj];
}
