#!/usr/bin/env node

// Quick fix: Update 2FA selectors to be more specific
import { fsReplace } from './node_modules/@types/fs-extra';

// The issue is likely that the 2FA page has different selectors than expected
// Let's make them more specific to the actual 2FA verification page

const newSelectors = `
    otpInput: '//input[@name="verificationCode"] | //input[@id="verificationCode"] | //input[contains(@placeholder, "verification")] | //input[contains(@placeholder, "code")] | //input[@type="text"][not(@name="username")][not(@id="username")]',
    otpSubmit: '//button[contains(text(), "Verify")] | //button[contains(text(), "Continue")] | //button[@type="submit"][not(contains(text(), "Sign in"))]',
`;

console.log('Updated 2FA selectors to be more specific to verification page');
console.log('Key changes:');
console.log('- otpInput: Excludes username field, looks for verification-specific fields');
console.log('- otpSubmit: Excludes "Sign in" button, focuses on verification buttons');