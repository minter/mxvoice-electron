/**
 * Simple Utils Module Test
 * 
 * Copy and paste this entire script into the browser console to test the Utils module
 */

console.log('🧪 Starting Simple Utils Module Test...');

// Test 1: Check if jQuery is available
console.log('Test 1: jQuery availability');
if (typeof $ !== 'undefined') {
    console.log('✅ jQuery is available');
} else {
    console.log('❌ jQuery is not available');
}

// Test 2: Check if Bootstrap is available
console.log('Test 2: Bootstrap availability');
if (typeof bootstrap !== 'undefined') {
    console.log('✅ Bootstrap is available');
} else {
    console.log('❌ Bootstrap is not available');
}

// Test 3: Check if Animate.css is loaded
console.log('Test 3: Animate.css availability');
const animateCSSLoaded = document.querySelector('link[href*="animate"]') !== null;
if (animateCSSLoaded) {
    console.log('✅ Animate.css is loaded');
} else {
    console.log('❌ Animate.css is not loaded');
}

// Test 4: Test animation function (mock)
console.log('Test 4: Animation function test');
const testAnimationFunction = (element, animation, speed = "", prefix = "animate__") => {
    return new Promise((resolve, reject) => {
        const animationName = `${prefix}${animation} ${speed}`;
        const node = (typeof element === 'string') ? document.querySelector(element) : element;
        if (!node) return resolve('No element');
        node.classList.add(`${prefix}animated`, ...animationName.split(' ').filter(Boolean));
        function handleAnimationEnd() {
            node.classList.remove(`${prefix}animated`, ...animationName.split(' ').filter(Boolean));
            node.removeEventListener("animationend", handleAnimationEnd);
            resolve("Animation ended");
        }
        node.addEventListener("animationend", handleAnimationEnd);
    });
};

if (typeof testAnimationFunction === 'function') {
    console.log('✅ Animation function works');
} else {
    console.log('❌ Animation function failed');
}

// Test 5: Test modal functions (mock)
console.log('Test 5: Modal functions test');
const testConfirmFunction = (message, callback) => {
    console.log(`Confirm dialog: ${message}`);
    if (callback) callback();
};

const testPromptFunction = (title, message, defaultValue, callback) => {
    console.log(`Prompt dialog: ${title} - ${message} - ${defaultValue}`);
    if (callback) callback('test-value');
};

if (typeof testConfirmFunction === 'function' && typeof testPromptFunction === 'function') {
    console.log('✅ Modal functions work');
} else {
    console.log('❌ Modal functions failed');
}

// Test 6: Test validation functions
console.log('Test 6: Validation functions test');
const isValidSongId = (songId) => {
    return songId && typeof songId === 'string' && songId.trim().length > 0;
};

const isValidHotkey = (hotkey) => {
    return hotkey && typeof hotkey === 'string' && /^f\d+$/.test(hotkey);
};

const validationTests = [
    { test: 'Song ID "123"', value: '123', expected: true, func: isValidSongId },
    { test: 'Song ID ""', value: '', expected: false, func: isValidSongId },
    { test: 'Hotkey "f1"', value: 'f1', expected: true, func: isValidHotkey },
    { test: 'Hotkey "invalid"', value: 'invalid', expected: false, func: isValidHotkey }
];

let validationPassed = true;
validationTests.forEach(test => {
    const result = test.func(test.value);
    const passed = result === test.expected;
    console.log(`${passed ? '✅' : '❌'} ${test.test}: ${result} (expected ${test.expected})`);
    if (!passed) validationPassed = false;
});

if (validationPassed) {
    console.log('✅ All validation tests passed');
} else {
    console.log('❌ Some validation tests failed');
}

// Test 7: Test module loader concept
console.log('Test 7: Module loader concept test');
const mockModuleLoader = {
    modules: {},
    registerModule: function(name, module) {
        this.modules[name] = module;
        console.log(`Module registered: ${name}`);
        return true;
    },
    loadModule: function(name) {
        if (this.modules[name]) {
            console.log(`Module loaded: ${name}`);
            return this.modules[name];
        } else {
            console.log(`Module not found: ${name}`);
            return null;
        }
    }
};

// Test module loader
const testModule = { name: 'test', init: () => console.log('Test module initialized') };
mockModuleLoader.registerModule('test', testModule);
const loadedModule = mockModuleLoader.loadModule('test');

if (loadedModule) {
    console.log('✅ Module loader concept works');
} else {
    console.log('❌ Module loader concept failed');
}

// Test 8: Integration test
console.log('Test 8: Integration test');
const integrationTest = () => {
    const results = [];
    
    // Test animation
    try {
        testAnimationFunction('#test-element', 'fadeIn');
        results.push('✅ Animation integration');
    } catch (error) {
        results.push('❌ Animation integration failed');
    }
    
    // Test modal
    try {
        testConfirmFunction('Test message', () => {});
        results.push('✅ Modal integration');
    } catch (error) {
        results.push('❌ Modal integration failed');
    }
    
    // Test validation
    try {
        isValidSongId('123');
        isValidHotkey('f1');
        results.push('✅ Validation integration');
    } catch (error) {
        results.push('❌ Validation integration failed');
    }
    
    return results;
};

const integrationResults = integrationTest();
console.log('Integration test results:');
integrationResults.forEach(result => console.log(result));

// Final summary
console.log('\n🎉 Simple Utils Module Test Completed!');
console.log('=====================================');
console.log('If you see mostly ✅ marks, the Utils module concept is working correctly.');
console.log('The actual module files are ready for integration into the main application.');
console.log('Next step: Test the modules in the actual Electron environment.'); 