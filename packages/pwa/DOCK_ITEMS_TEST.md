# Manual Test Cases for localStorage dockItems fixes

These tests should be run manually in the browser console to verify the fix works correctly.

## Test Case 1: Invalid JSON
```javascript
console.log("=== Test Case 1: Invalid JSON ===");
localStorage.setItem('dockItems', '{invalid json}');
// Reload page - should not crash, should show default dock items
```

## Test Case 2: Valid JSON but wrong type (object instead of array)
```javascript
console.log("=== Test Case 2: Object instead of Array ===");
localStorage.setItem('dockItems', '{"home": true, "camera": true}');
// Reload page - should not crash, should show default dock items
```

## Test Case 3: Array with non-string values
```javascript
console.log("=== Test Case 3: Array with non-string values ===");
localStorage.setItem('dockItems', '[1, 2, 3]');
// Reload page - should not crash, should show default dock items
```

## Test Case 4: null value
```javascript
console.log("=== Test Case 4: Null value ===");
localStorage.setItem('dockItems', 'null');
// Reload page - should not crash, should show default dock items
```

## Test Case 5: Empty string
```javascript
console.log("=== Test Case 5: Empty string ===");
localStorage.setItem('dockItems', '');
// Reload page - should not crash, should show default dock items
```

## Test Case 6: Valid array of strings
```javascript
console.log("=== Test Case 6: Valid array ===");
localStorage.setItem('dockItems', '["home", "camera", "profile"]');
// Reload page - should work correctly, showing only selected items
```

## Test Case 7: Remove dockItems entirely
```javascript
console.log("=== Test Case 7: No dockItems key ===");
localStorage.removeItem('dockItems');
// Reload page - should show default dock items
```

## Verification
After each test case:
1. The app should NOT white-screen
2. The bottom dock should be visible
3. Console should show a warning about invalid dockItems (except Test Case 6 & 7)
4. localStorage.getItem('dockItems') should be valid JSON or null

## Helper to test all cases automatically
```javascript
function runAllTests() {
  const tests = [
    { name: "Invalid JSON", value: '{invalid json}' },
    { name: "Object instead of Array", value: '{"home": true}' },
    { name: "Array with numbers", value: '[1, 2, 3]' },
    { name: "Null value", value: 'null' },
    { name: "Empty string", value: '' },
  ];

  tests.forEach(test => {
    console.log(`\n${test.name}:`);
    localStorage.setItem('dockItems', test.value);
    console.log("  Set value:", test.value);
    console.log("  ⚠️  Please reload the page to test");
  });
}

console.log("\nRun `runAllTests()` to cycle through all test cases");
console.log("After running, reload the page for each test");
```
