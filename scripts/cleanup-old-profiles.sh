#!/bin/bash

# Cleanup script for old profile state from user-profiles branch
# Run this before testing the new profiles2 implementation
# 
# This script removes the old profile implementation data from the previous
# user-profiles branch. The new profiles2 branch uses a different directory
# structure and profile format.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Mx. Voice - Profile State Cleanup${NC}"
echo "This script will remove old profile state from the previous user-profiles branch."
echo ""

# Find userData directories (old and new)
if [[ "$OSTYPE" == "darwin"* ]]; then
    # Old directories that might have old profile data
    OLD_USER_DATA_1="$HOME/Library/Application Support/mxvoice"
    OLD_USER_DATA_2="$HOME/Library/Application Support/MxVoice"
    # New directory used by profiles2 branch
    NEW_USER_DATA="$HOME/Library/Application Support/Mx. Voice"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OLD_USER_DATA_1="$HOME/.config/mxvoice"
    OLD_USER_DATA_2="$HOME/.config/MxVoice"
    NEW_USER_DATA="$HOME/.config/Mx. Voice"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    OLD_USER_DATA_1="$APPDATA/mxvoice"
    OLD_USER_DATA_2="$APPDATA/MxVoice"
    NEW_USER_DATA="$APPDATA/Mx. Voice"
else
    echo -e "${RED}Unknown OS type: $OSTYPE${NC}"
    exit 1
fi

echo -e "${YELLOW}Note: This script cleans profile data from the old user-profiles branch.${NC}"
echo -e "${YELLOW}The new profiles2 branch uses: $NEW_USER_DATA${NC}"
echo ""

# Check which directories exist
FOUND_OLD=0
if [ -d "$OLD_USER_DATA_1" ]; then
    echo -e "Found old directory: ${YELLOW}$OLD_USER_DATA_1${NC}"
    FOUND_OLD=1
fi
if [ -d "$OLD_USER_DATA_2" ]; then
    echo -e "Found old directory: ${YELLOW}$OLD_USER_DATA_2${NC}"
    FOUND_OLD=1
fi

if [ $FOUND_OLD -eq 0 ]; then
    echo -e "${GREEN}No old profile directories found. Nothing to clean up.${NC}"
    exit 0
fi

echo ""
echo -e "${YELLOW}This will remove profile-related data from the old implementation.${NC}"
echo -e "${YELLOW}A backup will be created first.${NC}"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi
echo ""

# Function to clean a directory
cleanup_directory() {
    local DIR=$1
    local DIR_NAME=$(basename "$DIR")
    
    echo -e "${YELLOW}Processing: $DIR${NC}"
    
    # Backup first
    BACKUP_DIR="${DIR}-backup-$(date +%Y%m%d-%H%M%S)"
    echo "  Creating backup at: $BACKUP_DIR"
    cp -r "$DIR" "$BACKUP_DIR"
    echo -e "  ${GREEN}✓ Backup created${NC}"
    
    # Remove profile-related files
    cd "$DIR"
    
    if [ -f "profiles.json" ]; then
        echo "  Removing profiles.json..."
        rm -f "profiles.json"
        echo -e "  ${GREEN}✓ Removed profiles.json${NC}"
    fi
    
    if [ -d "profiles" ]; then
        echo "  Removing profiles/ directory..."
        rm -rf "profiles"
        echo -e "  ${GREEN}✓ Removed profiles/ directory${NC}"
    fi
    
    # Remove profile-related keys from config.json using Node.js
    if [ -f "config.json" ]; then
        echo "  Cleaning profile keys from config.json..."
        
        # Use Node.js to parse and clean the config
        node -e "
        const fs = require('fs');
        const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
        
        // Remove profile-related keys from old user-profiles branch
        delete config.active_profile;
        delete config.profile_selection_shown;
        delete config.profile_switch_restart;
        
        fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
        console.log('  ✓ Cleaned config.json');
        " 2>/dev/null || echo -e "  ${YELLOW}⚠ Could not clean config.json (Node.js required)${NC}"
    fi
    
    echo -e "  ${GREEN}✓ Cleanup complete for $DIR_NAME${NC}"
    echo -e "  ${YELLOW}Backup: $BACKUP_DIR${NC}"
    echo ""
}

# Clean up old directories
if [ -d "$OLD_USER_DATA_1" ]; then
    cleanup_directory "$OLD_USER_DATA_1"
fi

if [ -d "$OLD_USER_DATA_2" ]; then
    cleanup_directory "$OLD_USER_DATA_2"
fi

echo ""
echo -e "${GREEN}✓ All cleanup complete!${NC}"
echo ""
echo -e "${YELLOW}The new profiles2 implementation uses: $NEW_USER_DATA${NC}"
echo ""
echo "You can now start the app to test the new profile launcher:"
echo "  yarn start"
echo ""

