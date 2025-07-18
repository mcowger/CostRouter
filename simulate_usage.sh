#!/bin/bash

# Usage simulation script for CostRouter
# Continuously generates randomized usage data until stopped with Ctrl+C

# Configuration
API_URL="http://localhost:3000/usage/simulate"
PROVIDERS=("openroutera" "openrouterb" "copilot-provider")
MIN_TOKENS=50
MAX_TOKENS=500
MIN_DELAY=2
MAX_DELAY=8

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to generate random number between min and max
random_between() {
    local min=$1
    local max=$2
    echo $((RANDOM % (max - min + 1) + min))
}

# Function to calculate cost based on tokens (rough estimate)
calculate_cost() {
    local tokens=$1
    # Rough pricing: $0.00002 per token (varies by model)
    echo "scale=6; $tokens * 0.00002" | bc -l
}

# Function to simulate usage
simulate_usage() {
    local provider=${PROVIDERS[$((RANDOM % ${#PROVIDERS[@]}))]}
    local tokens=$(random_between $MIN_TOKENS $MAX_TOKENS)
    local cost=$(calculate_cost $tokens)
    
    # Round cost to 6 decimal places
    cost=$(printf "%.6f" $cost)
    
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} Simulating usage for ${YELLOW}$provider${NC}: ${GREEN}$tokens tokens${NC}, ${RED}\$$cost${NC}"
    
    # Make the API call
    response=$(curl -s -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -d "{\"providerId\": \"$provider\", \"tokens\": $tokens, \"cost\": $cost}")
    
    # Check if the request was successful
    if echo "$response" | grep -q "message"; then
        echo -e "  ${GREEN}✓${NC} Success"
    else
        echo -e "  ${RED}✗${NC} Failed: $response"
    fi
}

# Function to handle cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Stopping usage simulation...${NC}"
    echo -e "${GREEN}Total simulations run: $count${NC}"
    exit 0
}

# Set up signal handler for graceful exit
trap cleanup SIGINT SIGTERM

# Check if bc is available for cost calculations
if ! command -v bc &> /dev/null; then
    echo -e "${RED}Error: 'bc' command not found. Please install bc for cost calculations.${NC}"
    echo "On macOS: brew install bc"
    echo "On Ubuntu/Debian: sudo apt-get install bc"
    exit 1
fi

# Check if the API is reachable
echo -e "${BLUE}Checking API connectivity...${NC}"
if ! curl -s --connect-timeout 5 "$API_URL" > /dev/null 2>&1; then
    echo -e "${RED}Error: Cannot reach API at $API_URL${NC}"
    echo "Make sure the CostRouter server is running on localhost:3000"
    exit 1
fi

echo -e "${GREEN}✓ API is reachable${NC}"
echo -e "${BLUE}Starting continuous usage simulation...${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
echo ""

# Main simulation loop
count=0
while true; do
    simulate_usage
    count=$((count + 1))
    
    # Random delay between requests
    delay=$(random_between $MIN_DELAY $MAX_DELAY)
    sleep $delay
done
