/**
 * vAuto Vision Selectors and Configurations
 * 
 * Specialized selectors and configurations based on the actual vAuto walkthrough
 * and interface patterns. These selectors are optimized for vision-enhanced
 * automation of the real vAuto system.
 */

export interface VAutoVisionSelector {
  // Traditional selectors (Plan A)
  xpath?: string;
  css?: string;
  
  // Vision-enhanced selectors (Plan B)
  visionDescription: string;
  visualContext?: string;
  expectedText?: string;
  
  // Metadata
  humanName: string;
  workflow: string;
  priority: 'high' | 'medium' | 'low';
  reliability: number; // 1-10 scale based on testing
}

/**
 * Complete vAuto Vision Selector Configuration
 * Based on the actual walkthrough workflow and UI patterns
 */
export const VAUTO_VISION_SELECTORS: Record<string, VAutoVisionSelector> = {
  
  // ===== LOGIN WORKFLOW =====
  
  USERNAME_FIELD: {
    xpath: '//input[@type="text" and contains(@placeholder, "Username")]',
    css: 'input[type="text"]#username',
    visionDescription: 'username input field on the login screen',
    visualContext: 'login form with username and password fields',
    expectedText: 'Username',
    humanName: 'Username Field',
    workflow: 'login',
    priority: 'high',
    reliability: 9
  },

  USERNAME_ENTER_BUTTON: {
    xpath: '//button[contains(text(), "Enter") or contains(@onclick, "goToPassword")]',
    css: 'button[onclick="goToPassword()"]',
    visionDescription: 'Enter button to proceed after entering username',
    visualContext: 'blue button below username field',
    expectedText: 'Enter',
    humanName: 'Username Enter Button',
    workflow: 'login',
    priority: 'high',
    reliability: 9
  },

  PASSWORD_FIELD: {
    xpath: '//input[@type="password"]',
    css: 'input[type="password"]#password',
    visionDescription: 'password input field on the password screen',
    visualContext: 'password form after username entry',
    expectedText: 'Password',
    humanName: 'Password Field',
    workflow: 'login',
    priority: 'high',
    reliability: 9
  },

  PASSWORD_ENTER_BUTTON: {
    xpath: '//button[contains(text(), "Enter") or contains(@onclick, "goToSelector")]',
    css: 'button[onclick="goToSelector()"]',
    visionDescription: 'Enter button to proceed after entering password',
    visualContext: 'blue button below password field',
    expectedText: 'Enter',
    humanName: 'Password Enter Button',
    workflow: 'login',
    priority: 'high',
    reliability: 9
  },

  VERIFICATION_OPTION: {
    xpath: '//select[contains(@class, "verification")] | //button[contains(text(), "Phone")] | //button[contains(text(), "Email")]',
    css: 'select, button',
    visionDescription: 'phone or email verification option selector',
    visualContext: 'verification method selection screen',
    expectedText: 'Phone|Email',
    humanName: 'Verification Option',
    workflow: 'login',
    priority: 'high',
    reliability: 8
  },

  DEALERSHIP_SELECTOR: {
    xpath: '//select[@id="dealership"] | //button[contains(@onclick, "goToHomepage")]',
    css: 'select#dealership, button[onclick="goToHomepage()"]',
    visionDescription: 'dealership selection dropdown or continue button',
    visualContext: 'dealership selection screen with dropdown menu',
    expectedText: 'Select|Cox Automotive|vAuto',
    humanName: 'Dealership Selector',
    workflow: 'login',
    priority: 'high',
    reliability: 9
  },

  // ===== NAVIGATION WORKFLOW =====

  PRICING_MENU: {
    xpath: '//button[contains(text(), "Pricing")] | //div[contains(@class, "group")]//button',
    css: '.group button, button:contains("Pricing")',
    visionDescription: 'Pricing dropdown menu button in main navigation',
    visualContext: 'main navigation bar with dropdown menus',
    expectedText: 'Pricing',
    humanName: 'Pricing Menu',
    workflow: 'navigation',
    priority: 'high',
    reliability: 8
  },

  VIEW_INVENTORY_LINK: {
    xpath: '//a[contains(text(), "View Inventory") or contains(@onclick, "goToInventory")]',
    css: 'a[onclick="goToInventory()"]',
    visionDescription: 'View Inventory link in the pricing dropdown menu',
    visualContext: 'dropdown menu with inventory and analysis options',
    expectedText: 'View Inventory',
    humanName: 'View Inventory Link',
    workflow: 'navigation',
    priority: 'high',
    reliability: 9
  },

  SAVE_FILTER_OPTION: {
    xpath: '//button[contains(text(), "SAVE Filter")] | //button[contains(text(), "Save Filter")]',
    css: 'button:contains("SAVE Filter"), button:contains("Save Filter")',
    visionDescription: 'SAVE Filter option button for inventory filtering setup',
    visualContext: 'inventory filter controls section',
    expectedText: 'SAVE Filter',
    humanName: 'Save Filter Option',
    workflow: 'navigation',
    priority: 'medium',
    reliability: 7
  },

  DAYS_FILTER_DROPDOWN: {
    xpath: '//select[@id="days-filter"] | //select[contains(@class, "days")]',
    css: 'select#days-filter',
    visionDescription: 'Days in stock filter dropdown with 0-1 day option',
    visualContext: 'filter controls with days in stock selection',
    expectedText: '0-1 day|2-7 days',
    humanName: 'Days Filter Dropdown',
    workflow: 'navigation',
    priority: 'high',
    reliability: 9
  },

  APPLY_FILTER_BUTTON: {
    xpath: '//button[contains(text(), "Apply Filter") or contains(@onclick, "applyFilter")]',
    css: 'button[onclick="applyFilter()"]',
    visionDescription: 'Apply Filter button to execute inventory filtering',
    visualContext: 'filter controls section with apply button',
    expectedText: 'Apply Filter',
    humanName: 'Apply Filter Button',
    workflow: 'navigation',
    priority: 'high',
    reliability: 9
  },

  // ===== VEHICLE PROCESSING WORKFLOW =====

  VEHICLE_LINK: {
    xpath: '//a[contains(@class, "font-semibold") and contains(@class, "text-blue-600")]',
    css: 'a.font-semibold.text-blue-600',
    visionDescription: 'clickable vehicle name link in the inventory list',
    visualContext: 'inventory list with vehicle names as clickable links',
    expectedText: 'Ford Explorer|Honda CR-V|Toyota Camry|Dodge Grand Caravan',
    humanName: 'Vehicle Link',
    workflow: 'vehicle_processing',
    priority: 'high',
    reliability: 9
  },

  VEHICLE_INFO_TAB: {
    xpath: '//button[contains(text(), "VEHICLE INFO")] | //tab[contains(text(), "Vehicle Info")]',
    css: 'button:contains("VEHICLE INFO"), .tab:contains("Vehicle Info")',
    visionDescription: 'VEHICLE INFO tab in the vehicle details page',
    visualContext: 'vehicle details page with multiple tabs',
    expectedText: 'VEHICLE INFO',
    humanName: 'Vehicle Info Tab',
    workflow: 'vehicle_processing',
    priority: 'high',
    reliability: 8
  },

  FACTORY_EQUIPMENT_BUTTON: {
    xpath: '//button[contains(text(), "Factory Equipment")] | //a[contains(text(), "Factory Equipment")]',
    css: 'button:contains("Factory Equipment"), a:contains("Factory Equipment")',
    visionDescription: 'Factory Equipment button to access the window sticker',
    visualContext: 'vehicle info tab with equipment and options buttons',
    expectedText: 'Factory Equipment',
    humanName: 'Factory Equipment Button',
    workflow: 'vehicle_processing',
    priority: 'high',
    reliability: 9
  },

  WINDOW_STICKER_POPUP: {
    xpath: '//div[contains(@class, "popup") or contains(@class, "modal")] | //div[@id="window-sticker-popup"]',
    css: '#window-sticker-popup, .popup, .modal',
    visionDescription: 'window sticker popup or new window displaying vehicle features',
    visualContext: 'popup window with vehicle specifications and features',
    expectedText: 'Window Sticker|MSRP|Standard Features|Optional',
    humanName: 'Window Sticker Popup',
    workflow: 'vehicle_processing',
    priority: 'high',
    reliability: 9
  },

  EDIT_DESCRIPTION_BUTTON: {
    xpath: '//button[contains(text(), "Edit Description") or contains(@onclick, "closePopupAndGoToDescription")]',
    css: 'button[onclick="closePopupAndGoToDescription()"]',
    visionDescription: 'Edit Description button in the window sticker popup',
    visualContext: 'window sticker popup with close and edit options',
    expectedText: 'Edit Description',
    humanName: 'Edit Description Button',
    workflow: 'vehicle_processing',
    priority: 'high',
    reliability: 9
  },

  // ===== DESCRIPTION SYNCHRONIZATION =====

  DESCRIPTION_CHECKBOXES_CONTAINER: {
    xpath: '//div[@id="description-checkboxes"] | //div[contains(@class, "checkbox")]',
    css: '#description-checkboxes, .checkbox-container',
    visionDescription: 'scrollable container with vehicle feature checkboxes',
    visualContext: 'description page with scrollable list of feature checkboxes',
    expectedText: 'Leather Seats|Navigation|Sunroof|Sound System',
    humanName: 'Description Checkboxes Container',
    workflow: 'description_sync',
    priority: 'high',
    reliability: 9
  },

  FEATURE_CHECKBOX: {
    xpath: '//input[@type="checkbox"]',
    css: 'input[type="checkbox"]',
    visionDescription: 'individual feature checkbox for vehicle options',
    visualContext: 'checkbox list with feature names and prices',
    expectedText: 'checkbox',
    humanName: 'Feature Checkbox',
    workflow: 'description_sync',
    priority: 'high',
    reliability: 9
  },

  SAVE_AND_SYNC_BUTTON: {
    xpath: '//button[contains(text(), "Save") and contains(text(), "Sync")] | //button[contains(@onclick, "saveDescriptionAndGoToBooks")]',
    css: 'button[onclick="saveDescriptionAndGoToBooks()"]',
    visionDescription: 'Save & Sync Book Values button to proceed to book values',
    visualContext: 'bottom of description page with green save button',
    expectedText: 'Save & Sync Book Values',
    humanName: 'Save & Sync Button',
    workflow: 'description_sync',
    priority: 'high',
    reliability: 9
  },

  // ===== BOOK VALUE SYNCHRONIZATION =====

  JD_POWER_TAB: {
    xpath: '//button[contains(text(), "J.D. Power") or contains(@onclick, "jdpower")]',
    css: 'button[onclick*="jdpower"]',
    visionDescription: 'J.D. Power tab in the book values section',
    visualContext: 'book values page with provider tabs',
    expectedText: 'J.D. Power',
    humanName: 'J.D. Power Tab',
    workflow: 'book_values',
    priority: 'high',
    reliability: 9
  },

  KBB_TAB: {
    xpath: '//button[contains(text(), "KBB") or contains(@onclick, "kbb")]',
    css: 'button[onclick*="kbb"]',
    visionDescription: 'KBB or Kelley Blue Book tab in book values',
    visualContext: 'book values page with provider tabs',
    expectedText: 'KBB',
    humanName: 'KBB Tab',
    workflow: 'book_values',
    priority: 'high',
    reliability: 9
  },

  BLACK_BOOK_TAB: {
    xpath: '//button[contains(text(), "Black Book") or contains(@onclick, "blackbook")]',
    css: 'button[onclick*="blackbook"]',
    visionDescription: 'Black Book tab for vehicle valuation',
    visualContext: 'book values page with provider tabs',
    expectedText: 'Black Book',
    humanName: 'Black Book Tab',
    workflow: 'book_values',
    priority: 'high',
    reliability: 9
  },

  BOOK_VALUE_CHECKBOX: {
    xpath: '//div[@id="jdpower"]//input[@type="checkbox"] | //div[@id="kbb"]//input[@type="checkbox"] | //div[@id="blackbook"]//input[@type="checkbox"]',
    css: '#jdpower input[type="checkbox"], #kbb input[type="checkbox"], #blackbook input[type="checkbox"]',
    visionDescription: 'feature checkbox within book value provider tab',
    visualContext: 'book value tab with feature checkboxes and pricing',
    expectedText: 'checkbox',
    humanName: 'Book Value Feature Checkbox',
    workflow: 'book_values',
    priority: 'high',
    reliability: 9
  },

  VALUATION_SUMMARY: {
    xpath: '//div[@id="sync-summary"] | //div[contains(@class, "valuation")]',
    css: '#sync-summary, .valuation-summary',
    visionDescription: 'valuation summary showing calculated values across providers',
    visualContext: 'book values page with summary grid showing final values',
    expectedText: 'Base Value|Options|Adjusted Value',
    humanName: 'Valuation Summary',
    workflow: 'book_values',
    priority: 'medium',
    reliability: 8
  },

  CONFIRM_VALUES_BUTTON: {
    xpath: '//button[contains(text(), "Confirm Values") or contains(@onclick, "confirmBookValues")]',
    css: 'button[onclick="confirmBookValues()"]',
    visionDescription: 'Confirm Values & Generate Report button to finalize',
    visualContext: 'bottom of book values page with blue confirmation button',
    expectedText: 'Confirm Values & Generate Report',
    humanName: 'Confirm Values Button',
    workflow: 'book_values',
    priority: 'high',
    reliability: 9
  },

  // ===== REPORTING AND COMPLETION =====

  SUCCESS_MESSAGE: {
    xpath: '//div[contains(@class, "success") or contains(@class, "green")] | //div[contains(text(), "Report Generated")]',
    css: '.success, .green-100, div:contains("Report Generated")',
    visionDescription: 'success message or report generated confirmation',
    visualContext: 'final page with green success notification',
    expectedText: 'Report Generated Successfully|Success',
    humanName: 'Success Message',
    workflow: 'reporting',
    priority: 'medium',
    reliability: 8
  },

  RESET_BUTTON: {
    xpath: '//button[contains(text(), "Back to Login") or contains(@onclick, "resetMockup")]',
    css: 'button[onclick="resetMockup()"]',
    visionDescription: 'Back to Login or reset button to start over',
    visualContext: 'success page with option to return to beginning',
    expectedText: 'Back to Login',
    humanName: 'Reset Button',
    workflow: 'reporting',
    priority: 'low',
    reliability: 9
  },

  // ===== ERROR HANDLING AND EDGE CASES =====

  ALERT_POPUP: {
    xpath: '//div[@id="custom-alert"] | //div[contains(@class, "alert")]',
    css: '#custom-alert, .alert, .popup',
    visionDescription: 'alert popup or notification message',
    visualContext: 'overlay popup with message and OK button',
    expectedText: 'OK|Alert|Error|Warning',
    humanName: 'Alert Popup',
    workflow: 'error_handling',
    priority: 'medium',
    reliability: 8
  },

  ALERT_OK_BUTTON: {
    xpath: '//button[contains(text(), "OK") and contains(@onclick, "closeCustomAlert")]',
    css: 'button[onclick="closeCustomAlert()"]',
    visionDescription: 'OK button to close alert or notification popup',
    visualContext: 'alert popup with OK button',
    expectedText: 'OK',
    humanName: 'Alert OK Button',
    workflow: 'error_handling',
    priority: 'medium',
    reliability: 9
  },

  FLAGGED_VEHICLE: {
    xpath: '//svg[contains(@class, "text-red-500")] | //span[contains(@class, "flag")]',
    css: '.text-red-500, .flag-icon',
    visionDescription: 'red flag icon indicating flagged vehicle',
    visualContext: 'inventory list with red flag icon next to vehicle name',
    expectedText: 'flag',
    humanName: 'Flagged Vehicle Icon',
    workflow: 'error_handling',
    priority: 'low',
    reliability: 7
  },

  LOADING_INDICATOR: {
    xpath: '//div[contains(@class, "loading") or contains(@class, "spinner")]',
    css: '.loading, .spinner, .progress',
    visionDescription: 'loading spinner or progress indicator',
    visualContext: 'page with loading animation or progress bar',
    expectedText: 'Loading|Progress',
    humanName: 'Loading Indicator',
    workflow: 'error_handling',
    priority: 'low',
    reliability: 6
  }
};

/**
 * Vision Configuration for different vAuto workflows
 */
export const VAUTO_VISION_CONFIGS = {
  
  // Login workflow configuration
  LOGIN_WORKFLOW: {
    name: 'vAuto Login Workflow',
    description: 'Complete login process from username to homepage',
    steps: [
      'USERNAME_FIELD',
      'USERNAME_ENTER_BUTTON', 
      'PASSWORD_FIELD',
      'PASSWORD_ENTER_BUTTON',
      'VERIFICATION_OPTION',
      'DEALERSHIP_SELECTOR'
    ],
    visionSettings: {
      model: 'claude-3-5-sonnet-20241022',
      confidence_threshold: 0.8,
      timeout: 15000,
      retries: 2
    }
  },

  // Navigation workflow configuration  
  NAVIGATION_WORKFLOW: {
    name: 'vAuto Navigation Workflow',
    description: 'Navigate from homepage to inventory with filtering',
    steps: [
      'PRICING_MENU',
      'VIEW_INVENTORY_LINK',
      'DAYS_FILTER_DROPDOWN',
      'APPLY_FILTER_BUTTON'
    ],
    visionSettings: {
      model: 'claude-3-5-sonnet-20241022',
      confidence_threshold: 0.85,
      timeout: 10000,
      retries: 3
    }
  },

  // Vehicle processing workflow configuration
  VEHICLE_PROCESSING_WORKFLOW: {
    name: 'vAuto Vehicle Processing Workflow', 
    description: 'Complete vehicle processing from selection to window sticker',
    steps: [
      'VEHICLE_LINK',
      'VEHICLE_INFO_TAB',
      'FACTORY_EQUIPMENT_BUTTON',
      'WINDOW_STICKER_POPUP',
      'EDIT_DESCRIPTION_BUTTON'
    ],
    visionSettings: {
      model: 'claude-3-5-sonnet-20241022',
      confidence_threshold: 0.9,
      timeout: 20000,
      retries: 2
    }
  },

  // Description synchronization workflow
  DESCRIPTION_SYNC_WORKFLOW: {
    name: 'vAuto Description Sync Workflow',
    description: 'Synchronize window sticker features with description checkboxes',
    steps: [
      'DESCRIPTION_CHECKBOXES_CONTAINER',
      'FEATURE_CHECKBOX',
      'SAVE_AND_SYNC_BUTTON'
    ],
    visionSettings: {
      model: 'claude-3-5-sonnet-20241022',
      confidence_threshold: 0.85,
      timeout: 15000,
      retries: 3
    }
  },

  // Book value synchronization workflow
  BOOK_VALUES_WORKFLOW: {
    name: 'vAuto Book Values Workflow',
    description: 'Synchronize features across all book value providers',
    steps: [
      'JD_POWER_TAB',
      'KBB_TAB', 
      'BLACK_BOOK_TAB',
      'BOOK_VALUE_CHECKBOX',
      'VALUATION_SUMMARY',
      'CONFIRM_VALUES_BUTTON'
    ],
    visionSettings: {
      model: 'claude-3-5-sonnet-20241022',
      confidence_threshold: 0.9,
      timeout: 25000,
      retries: 2
    }
  }
};

/**
 * Vision prompt templates for different interaction types
 */
export const VAUTO_VISION_PROMPTS = {
  
  CLICK_ELEMENT: (elementDescription: string, context: string) => `
    I need to click on "${elementDescription}" in the context of "${context}".
    
    Please analyze this vAuto interface screenshot and:
    1. Locate the exact clickable element that matches "${elementDescription}"
    2. Provide the precise coordinates for clicking
    3. Confirm this is the correct element based on the visual context
    4. Rate your confidence level (1-100%)
    
    The element should be clearly visible and clickable in the current viewport.
  `,

  TYPE_TEXT: (fieldDescription: string, text: string, context: string) => `
    I need to type "${text}" into the "${fieldDescription}" field in the context of "${context}".
    
    Please analyze this vAuto interface screenshot and:
    1. Locate the input field that matches "${fieldDescription}"
    2. Provide the precise coordinates for clicking into the field
    3. Confirm this is a text input field that can accept the text "${text}"
    4. Rate your confidence level (1-100%)
    
    The field should be clearly visible and editable in the current viewport.
  `,

  SELECT_OPTION: (selectDescription: string, option: string, context: string) => `
    I need to select "${option}" from the "${selectDescription}" dropdown in the context of "${context}".
    
    Please analyze this vAuto interface screenshot and:
    1. Locate the dropdown/select element that matches "${selectDescription}"
    2. Identify if the dropdown is open or needs to be opened first
    3. Locate the specific option "${option}" within the dropdown
    4. Provide coordinates for the appropriate action (open dropdown or select option)
    5. Rate your confidence level (1-100%)
  `,

  VERIFY_ELEMENT: (elementDescription: string, context: string) => `
    I need to verify that "${elementDescription}" is present and visible in the context of "${context}".
    
    Please analyze this vAuto interface screenshot and:
    1. Locate the element that matches "${elementDescription}"
    2. Confirm it is visible and properly rendered
    3. Describe what you see to verify it matches expectations
    4. Rate your confidence level (1-100%)
    
    This is for verification purposes only, no interaction needed.
  `,

  EXTRACT_FEATURES: (context: string) => `
    I need to extract vehicle features from this vAuto window sticker or feature list in the context of "${context}".
    
    Please analyze this vAuto interface screenshot and:
    1. Identify all visible vehicle features, options, and equipment
    2. Note which features appear to be standard vs optional
    3. Extract any pricing information associated with features
    4. Organize the features into a structured list
    5. Rate your confidence level (1-100%) for the extraction
    
    Focus on automotive features like: leather seats, navigation, sunroof, sound systems, safety features, etc.
  `,

  ANALYZE_FORM: (formDescription: string, context: string) => `
    I need to analyze the "${formDescription}" form in the context of "${context}".
    
    Please analyze this vAuto interface screenshot and:
    1. Identify all form fields, checkboxes, dropdowns, and buttons
    2. Determine the purpose and expected input for each field
    3. Note any validation requirements or constraints
    4. Identify the primary action button (submit, save, etc.)
    5. Suggest the optimal interaction strategy for this form
    6. Rate your confidence level (1-100%)
    
    Provide a comprehensive analysis of the form structure and interaction requirements.
  `
};

/**
 * Utility functions for working with vAuto vision selectors
 */
export class VAutoVisionSelectorUtils {
  
  /**
   * Get selector by workflow and priority
   */
  static getSelectorsByWorkflow(workflow: string, priority?: 'high' | 'medium' | 'low'): VAutoVisionSelector[] {
    const selectors = Object.values(VAUTO_VISION_SELECTORS)
      .filter(selector => selector.workflow === workflow);
    
    if (priority) {
      return selectors.filter(selector => selector.priority === priority);
    }
    
    return selectors.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Get high-reliability selectors
   */
  static getHighReliabilitySelectors(minReliability: number = 8): VAutoVisionSelector[] {
    return Object.values(VAUTO_VISION_SELECTORS)
      .filter(selector => selector.reliability >= minReliability)
      .sort((a, b) => b.reliability - a.reliability);
  }

  /**
   * Get workflow configuration
   */
  static getWorkflowConfig(workflowName: string) {
    return VAUTO_VISION_CONFIGS[workflowName as keyof typeof VAUTO_VISION_CONFIGS];
  }

  /**
   * Generate vision prompt for selector
   */
  static generateVisionPrompt(selectorKey: string, action: 'click' | 'type' | 'select' | 'verify', additionalContext?: string): string {
    const selector = VAUTO_VISION_SELECTORS[selectorKey];
    if (!selector) {
      throw new Error(`Selector ${selectorKey} not found`);
    }

    const context = additionalContext || selector.visualContext || selector.workflow;
    
    switch (action) {
      case 'click':
        return VAUTO_VISION_PROMPTS.CLICK_ELEMENT(selector.visionDescription, context);
      case 'verify':
        return VAUTO_VISION_PROMPTS.VERIFY_ELEMENT(selector.visionDescription, context);
      default:
        return VAUTO_VISION_PROMPTS.CLICK_ELEMENT(selector.visionDescription, context);
    }
  }

  /**
   * Get fallback selectors for an element
   */
  static getFallbackSelectors(primarySelectorKey: string): VAutoVisionSelector[] {
    const primary = VAUTO_VISION_SELECTORS[primarySelectorKey];
    if (!primary) return [];

    // Find selectors in the same workflow with similar reliability
    return Object.values(VAUTO_VISION_SELECTORS)
      .filter(selector => 
        selector.workflow === primary.workflow &&
        selector.humanName !== primary.humanName &&
        Math.abs(selector.reliability - primary.reliability) <= 2
      )
      .sort((a, b) => b.reliability - a.reliability);
  }

  /**
   * Validate selector configuration
   */
  static validateSelector(selector: VAutoVisionSelector): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!selector.visionDescription) {
      issues.push('Missing vision description');
    }

    if (!selector.humanName) {
      issues.push('Missing human name');
    }

    if (!selector.workflow) {
      issues.push('Missing workflow assignment');
    }

    if (selector.reliability < 1 || selector.reliability > 10) {
      issues.push('Reliability must be between 1 and 10');
    }

    if (!selector.xpath && !selector.css) {
      issues.push('Missing traditional selectors (xpath or css)');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Export selectors for specific workflow
   */
  static exportWorkflowSelectors(workflow: string): Record<string, VAutoVisionSelector> {
    const workflowSelectors: Record<string, VAutoVisionSelector> = {};
    
    Object.entries(VAUTO_VISION_SELECTORS)
      .filter(([_, selector]) => selector.workflow === workflow)
      .forEach(([key, selector]) => {
        workflowSelectors[key] = selector;
      });

    return workflowSelectors;
  }
}

// Exports are already declared above with 'export const'

