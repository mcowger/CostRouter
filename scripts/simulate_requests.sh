#!/bin/bash

# Chat completion request simulation script for CostRouter
# Continuously sends real chat completion requests until stopped with Ctrl+C

# Configuration
API_URL="http://localhost:3000/v1/chat/completions"
# Model names that exist in the configuration
MODELS=("gemini-2.5-flash")
MIN_DELAY=1
MAX_DELAY=3

# Sample prompts for variety
PROMPTS=(
    "Hello, how are you today?"
    "What is the capital of France?"
    "Explain quantum computing in simple terms."
    "Write a haiku about programming."
    "What are the benefits of renewable energy?"
    "How does machine learning work?"
    "Tell me a fun fact about space."
    "What is the difference between AI and ML?"
    "Describe the water cycle."
    "What makes a good leader?"
    "How do computers process information?"
    "What is the importance of biodiversity?"
    "Explain photosynthesis briefly."
    "What are the main programming paradigms?"
    "How does the internet work?"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to generate random number between min and max
random_between() {
    local min=$1
    local max=$2
    echo $((RANDOM % (max - min + 1) + min))
}

# Function to send chat completion request
simulate_request() {
    local model=${MODELS[$((RANDOM % ${#MODELS[@]}))]}
    local prompt=${PROMPTS[$((RANDOM % ${#PROMPTS[@]}))]}
    
    # Print the request info without newline
    echo -n -e "${BLUE}[$(date '+%H:%M:%S')]${NC} Sending request to ${YELLOW}$model${NC}: ${CYAN}\"$(echo "$prompt" | cut -c1-40)...\"${NC} ... "
    
    # Make the API call
    response=$(curl -s -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer dummy-key" \
        -d "{
            \"model\": \"$model\",
            \"messages\": [
                {\"role\": \"user\", \"content\": \"$prompt\"}
            ],
            \"max_tokens\": 100,
            \"temperature\": 0.7
        }")
    
    # Check if the request was successful
    if echo "$response" | grep -q '"choices"'; then
        # Extract token usage if available
        prompt_tokens=$(echo "$response" | grep -o '"prompt_tokens":[0-9]*' | cut -d':' -f2)
        completion_tokens=$(echo "$response" | grep -o '"completion_tokens":[0-9]*' | cut -d':' -f2)

        if [[ -n "$prompt_tokens" && -n "$completion_tokens" && "$prompt_tokens" =~ ^[0-9]+$ && "$completion_tokens" =~ ^[0-9]+$ ]]; then
            total_tokens=$((prompt_tokens + completion_tokens))
            echo -e "${GREEN}✓ Success${NC} (${GREEN}${total_tokens} tokens${NC})"
        else
            echo -e "${GREEN}✓ Success${NC}"
        fi
    elif echo "$response" | grep -q '"error"'; then
        # Extract error message
        error_msg=$(echo "$response" | grep -o '"message":"[^"]*"' | cut -d'"' -f4)
        echo -e "${RED}✗ Error: $error_msg${NC}"
    else
        echo -e "${RED}✗ Failed: Unexpected response${NC}"
    fi
}

# Function to handle cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Stopping request simulation...${NC}"
    echo -e "${GREEN}Total requests sent: $count${NC}"
    exit 0
}

# Set up signal handler for graceful exit
trap cleanup SIGINT SIGTERM

# Check if the API is reachable
echo -e "${BLUE}Checking API connectivity...${NC}"
if ! curl -s --connect-timeout 5 "$API_URL" > /dev/null 2>&1; then
    echo -e "${RED}Error: Cannot reach API at $API_URL${NC}"
    echo "Make sure the CostRouter server is running on localhost:3000"
    exit 1
fi

echo -e "${GREEN}✓ API is reachable${NC}"
echo -e "${BLUE}Starting continuous chat completion requests...${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
echo ""

# Main simulation loop
count=0
while true; do
    simulate_request
    count=$((count + 1))
    
    # Random delay between requests
    delay=$(random_between $MIN_DELAY $MAX_DELAY)
    sleep $delay
done
