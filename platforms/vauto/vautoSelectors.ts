// vAuto UI selectors configuration
export const vAutoSelectors = {
  login: {
    url: 'https://vauto.signin.coxautoinc.com/?solutionID=VAT_prod&clientId=68e5c360aa114799a67e94c4d587ff65',
    username: '//input[@id="username"]',
    nextButton: '//button[contains(text(), "Next")]',
    password: '//input[@type="password"]',
    submit: '//button[@type="submit"]',
    phoneOption: '//button[contains(text(), "Text") or contains(text(), "SMS") or contains(text(), "Phone")] | //div[contains(text(), "Text") or contains(text(), "SMS") or contains(text(), "Phone")] | //span[contains(text(), "Text") or contains(text(), "SMS") or contains(text(), "Phone")] | //a[contains(text(), "Text") or contains(text(), "SMS") or contains(text(), "Phone")] | //*[contains(@class, "phone") or contains(@class, "sms") or contains(@class, "text")]',
    otpInput: '//input[@type="text" or @type="number" or @type="tel"]',
    otpSubmit: '//button[@type="submit" or contains(text(), "Verify") or contains(text(), "Submit") or contains(text(), "Continue")]',
    twoFactorTitle: '//*[contains(text(), "Verify your identity")]',
    phoneSelectButton: '//button[contains(text(), "Select")]',
  },
  
  dashboard: {
    url: 'https://provision.vauto.app.coxautoinc.com/Va/Dashboard/ProvisionEnterprise/Default.aspx',
  },
  
  inventory: {
    viewInventoryLink: '//a[contains(text(), "View Inventory")]',
    
    // SAVED FILTERS APPROACH (Much more reliable!)
    filtersButton: '//*[@id="ext-gen77"]', // Real FILTERS button ID from user
    
    // Saved Filters dropdown button (the main trigger) - based on screenshot
    savedFiltersDropdown: '//button[contains(text(), "Saved Filters")] | //div[contains(text(), "Saved Filters")] | //span[contains(text(), "Saved Filters")] | //td[contains(text(), "Saved Filters")]',
    savedFiltersDropdownButton: '//button[contains(text(), "Saved Filters")] | //div[contains(text(), "Saved Filters")] | //span[contains(text(), "Saved Filters")] | //td[contains(text(), "Saved Filters")]',
    
    // ExtJS dropdown trigger (arrow/button part) - try multiple approaches
    savedFiltersDropdownTrigger: '//div[contains(@class, "x-form-trigger")] | //img[contains(@class, "x-form-trigger")] | //button[contains(@class, "x-btn-small")] | //div[contains(@class, "x-combo-arrow")]',
    
    // Alternative approach: look for the dropdown arrow next to "Saved Filters"
    savedFiltersArrow: '//td[contains(text(), "Saved Filters")]/following-sibling::td | //div[contains(text(), "Saved Filters")]/following-sibling::div | //span[contains(text(), "Saved Filters")]/following-sibling::span',
    
    // Recent inventory filter options (multiple selectors to try)
    recentInventoryFilter: '//*[@id="ext-gen514"]', // Real RECENT INVENTORY ID from user
    recentInventoryFilterAlt1: '//div[contains(text(), "recent inventory")]',
    recentInventoryFilterAlt2: '//li[contains(text(), "recent inventory")]',
    recentInventoryFilterAlt3: '//option[contains(text(), "recent inventory")]',
    recentInventoryFilterAlt4: '//a[contains(text(), "recent inventory")]',
    
    // Target the 4th dropdown item specifically (since you mentioned it's the 4th one)
    recentInventoryFilter4th: '//div[contains(@class, "x-combo-list-item")][4]',
    recentInventoryFilterNth: (n: number) => `//div[contains(@class, "x-combo-list-item")][${n}]`,
    
    // Generic saved filter item selectors
    savedFilterItem: '//div[contains(@class, "x-combo-list-item")]',
    savedFilterItemByText: (text: string) => `//div[contains(@class, "x-combo-list-item") and contains(text(), "${text}")]`,
    
    // More specific ExtJS dropdown selectors
    extjsDropdownItem: '//div[contains(@class, "x-combo-list-item")] | //div[contains(@class, "x-menu-item")] | //li[contains(@class, "x-menu-item")]',
    extjsDropdownItemByText: (text: string) => `//div[contains(@class, "x-combo-list-item") and contains(text(), "${text}")] | //div[contains(@class, "x-menu-item") and contains(text(), "${text}")] | //li[contains(@class, "x-menu-item") and contains(text(), "${text}")]`,
    
    // Fallback manual filter approach (if saved filters fail)
    filterButton: '//button[contains(text(), "Filter")]',
    filterButtonAlt: '//button[@id="ext-gen73"]', // Real ExtJS ID from logs
    filterButtonPlural: '//button[contains(text(), "Filters")]', // Real text from logs
    ageFilterLabel: '//label[contains(text(), "Age")]',
    ageMinInput: '//input[@id="ext-gen114"]',
    ageMaxInput: '//input[@id="ext-gen115"]',
    applyFilter: '//button[@id="ext-gen745"]',
    applyFilterAlt1: '//button[contains(text(), "Search")]',
    applyFilterAlt2: '//button[contains(text(), "Apply")]',
    applyFilterAlt3: '//button[contains(text(), "Filter")]',
    applyFilterAlt4: '//input[@type="submit"]',
    applyFilterAlt5: '//button[@type="submit"]',
    
    // Real ExtJS grid structure (from user's interface data)
    vehicleRows: '//tr[contains(@class, "x-grid3-row")]',
    vehicleRowData: '//tr[contains(@class, "x-grid3-row")]/td',
    
    // Vehicle link selectors for clicking on vehicle URLs in inventory list
    vehicleLink: '//tr[contains(@class, "x-grid3-row")]//a[contains(@href, "javascript") or contains(@onclick, "javascript")]',
    vehicleLinkByRow: (rowIndex: number) => `(//tr[contains(@class, "x-grid3-row")])[${rowIndex}]//a`,
    vehicleNameLink: '//td[contains(@class, "x-grid3-col")]//a[contains(text(), " ")]',
    
    // Additional vehicle link selectors based on vAuto's actual structure
    vehicleLinkInGrid: '//div[@class="x-grid3-scroller"]//a',
    vehicleLinkByText: '//a[contains(@class, "x-grid3") or contains(@class, "grid")]',
    vehicleFirstColumnLink: '//tr[contains(@class, "x-grid3-row")]//td[1]//a',
    vehicleYearMakeModelLink: '//td[contains(@class, "x-grid3-td-first")]//a',
    
    // Grid column selectors (actual ExtJS classes from user's data)
    vinColumn: '//td[contains(@class, "x-grid3-col-vin")]',
    ageColumn: '//td[contains(@class, "x-grid3-col-age")]',
    dealerColumn: '//td[contains(@class, "x-grid3-col-dealer")]',
    stockColumn: '//td[contains(@class, "x-grid3-col-stock")]',
    
    // Grid headers
    ageHeader: '//th[contains(@class, "x-grid3-hd") and contains(text(), "Age")]',
    vinHeader: '//th[contains(@class, "x-grid3-hd") and contains(text(), "VIN")]',
    dealerHeader: '//th[contains(@class, "x-grid3-hd") and contains(text(), "Dealer")]',
    
    nextPageButton: '//button[@id="ext-gen41"]',
    nextPageDisabled: '//button[@id="ext-gen41" and @disabled]',
    totalVehiclesText: '//div[contains(@class, "total-count")]',
  },
  
  vehicleDetails: {
    // Vehicle Info tab and iframe selectors
    vehicleInfoTab: '//a[contains(text(), "Vehicle Info")] | //div[contains(text(), "Vehicle Info")] | //span[contains(text(), "Vehicle Info")]',
    vehicleInfoTabActive: '//div[contains(@class, "x-tab-strip-active")]//span[contains(text(), "Vehicle Info")]',
    gaugePageIFrame: '#GaugePageIFrame',
    gaugePageIFrameXPath: '//iframe[@id="GaugePageIFrame"]',
    
    // Real ExtJS Factory Equipment tab selector (from user's interface data)
    factoryEquipmentTab: '//*[@id="ext-gen175"]',
    factoryEquipmentTabCSS: '#ext-gen175',
    factoryEquipmentTabAlt: '//div[contains(@class, "x-tab") and contains(text(), "Factory Equipment")]',
    factoryEquipmentTabInFrame: '//a[@id="ext-gen201"] | //div[@id="ext-gen201"]',
    
    // Factory Equipment PDF button and window selectors
    factoryEquipmentPDFButton: '//button[contains(text(), "Factory Equipment")] | //a[contains(text(), "Factory Equipment PDF")] | //div[contains(text(), "Factory Equipment")]',
    factoryEquipmentWindow: 'factory-equipment-details',
    
    // Window sticker popup selectors
    windowStickerPopup: '//div[contains(@class, "window-sticker") or contains(@class, "factory-equipment-popup")]',
    windowStickerContent: '//div[contains(@class, "window-sticker-details") or contains(@class, "factory-equipment-content")]',
    windowStickerSections: '//div[contains(@class, "window-sticker-details")]//div[contains(@class, "section")]',
    
    // Specific window sticker content sections
    interiorSection: '//div[contains(@class, "window-sticker")]//div[contains(text(), "Interior")]/following-sibling::*',
    mechanicalSection: '//div[contains(@class, "window-sticker")]//div[contains(text(), "Mechanical")]/following-sibling::*',
    comfortSection: '//div[contains(@class, "window-sticker")]//div[contains(text(), "Comfort") or contains(text(), "Convenience")]/following-sibling::*',
    
    // Window sticker and content selectors
    windowStickerButton: '//button[contains(text(), "View Window Sticker")]',
    stickerContentContainer: '//iframe[contains(@src, "sticker")]',
    stickerContentAlt1: '//div[@id="window-sticker-content"]',
    stickerContentAlt2: '//div[contains(@class, "sticker-content")]',
    
    // Real ExtJS checkbox structure (from user's interface data)
    checkboxContainer: '//div[contains(@class, "x-fieldset")]//div[contains(@class, "x-form-check-group")]',
    checkboxPattern: '//input[starts-with(@id, "ext-va-feature-checkbox-")]',
    checkboxInput: (checkboxId: string) => `//input[@id="${checkboxId}"]`,
    checkboxByLabel: (label: string) => `//div[contains(text(), "${label}")]/preceding-sibling::input[@type="checkbox"] | //div[contains(text(), "${label}")]/following-sibling::input[@type="checkbox"]`,
    checkboxByLabelAlt: (label: string) => `//label[contains(text(), "${label}")]/input[@type="checkbox"] | //label[contains(text(), "${label}")]/preceding-sibling::input[@type="checkbox"]`,
    checkboxImg: (checkboxId: string) => `//div[@id="${checkboxId}"]/img`,
    
    // ExtJS feature checkbox categories
    featureFieldset: '//fieldset[legend[contains(text(), "Features")] or legend[contains(text(), "Equipment")]]',
    categoryFieldset: (category: string) => `//fieldset[legend[contains(text(), "${category}")]]//input[@type="checkbox"]`,
    
    // Real Save button selector (from user's interface data)
    saveButton: '//*[@id="ext-gen58"]',
    saveButtonCSS: '#ext-gen58',
    saveButtonAlt: '//button[contains(text(), "Save")]',
    saveAndCloseButton: '//button[contains(text(), "Save & Close")]',
    
    // VIN field for logging
    vinField: '//span[contains(@class, "vin")] | //div[contains(@class, "vehicle-vin")] | //td[contains(@class, "x-grid3-col-vin")]',
  },
  
  // Loading indicators and ExtJS masks
  loading: {
    spinner: '//div[contains(@class, "loading")] | //div[contains(@class, "spinner")]',
    progressBar: '//div[contains(@class, "progress")]',
    overlay: '//div[contains(@class, "overlay")]',
    // ExtJS specific loading masks (from real interface logs)
    extjsMask: '//div[contains(@class, "ext-el-mask")]',
    extjsMaskVisible: '//div[contains(@class, "ext-el-mask") and not(contains(@style, "display: none"))]',
    loadingMask: '//div[@id="loading-mask"]',
  },
  
  // Error messages and session handling
  errors: {
    genericError: '//div[contains(@class, "error")] | //div[contains(@class, "alert-danger")]',
    sessionTimeout: '//div[contains(text(), "session") and contains(text(), "expired")]',
    sessionExpiredDialog: '//div[contains(@class, "x-window") and contains(text(), "Session Expired")]',
    sessionExpiredModal: '//div[contains(@class, "x-message-box") and .//div[contains(text(), "Session Expired")]]',
    loginRedirect: '//div[contains(text(), "Please log in again")]',
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
