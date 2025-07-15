// Reliable selectors that avoid dynamic ExtJS IDs
export const RELIABLE_SELECTORS = {
  // Text-based selectors (most reliable)
  factoryEquipmentTab: [
    'text=Factory Equipment',
    '//span[contains(text(), "Factory Equipment")]',
    '//a[contains(text(), "Factory Equipment")]'
  ],
  
  // Window sticker content
  windowStickerContent: [
    '//div[contains(@class, "window-sticker")]',
    '//div[contains(@class, "sticker-content")]',
    '//div[contains(@class, "factory-equipment")]',
    'body' // fallback
  ],
  
  // Checkboxes (avoid dynamic IDs)
  checkboxes: [
    'input[type="checkbox"][id*="feature"]',
    'input[type="checkbox"][id*="equipment"]',
    '//input[@type="checkbox" and contains(@id, "ext-va")]'
  ],
  
  // Save button (text-based)
  saveButton: [
    'text=Save',
    '//button[contains(text(), "Save")]',
    '//input[@type="submit" and contains(@value, "Save")]'
  ]
};

// Debug mode selector overrides
export const DEBUG_SELECTORS = {
  factoryEquipmentTab: process.env.DEBUG_FACTORY_TAB_SELECTOR,
  windowStickerContent: process.env.DEBUG_CONTENT_SELECTOR,
  saveButton: process.env.DEBUG_SAVE_SELECTOR
};