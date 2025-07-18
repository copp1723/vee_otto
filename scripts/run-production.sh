#!/bin/bash

# VAuto MVP Production Deployment Script
# This script runs the automation in production mode with monitoring and error recovery

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
LOG_DIR="./logs/production"
REPORT_DIR="./reports/production"
SCREENSHOT_DIR="./screenshots/production"
STATE_FILE="./production-state.json"
SLACK_WEBHOOK="${SLACK_WEBHOOK_URL}"
EMAIL_RECIPIENT="${REPORT_EMAIL:-notifications@veeotto.ai}"

# Create directories
mkdir -p "$LOG_DIR" "$REPORT_DIR" "$SCREENSHOT_DIR"

# Timestamp for this run
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$LOG_DIR/production_${TIMESTAMP}.log"

# Function to send notifications
send_notification() {
    local level=$1
    local message=$2
    
    # Log to file
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [$level] $message" >> "$LOG_FILE"
    
    # Send to Slack if configured
    if [ ! -z "$SLACK_WEBHOOK" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"[$level] VAuto Automation: $message\"}" \
            "$SLACK_WEBHOOK" 2>/dev/null || true
    fi
    
    # Send email for errors
    if [ "$level" = "ERROR" ] && [ ! -z "$EMAIL_RECIPIENT" ]; then
        echo "$message" | mail -s "VAuto Automation Error" "$EMAIL_RECIPIENT" 2>/dev/null || true
    fi
}

# Function to check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}Node.js is not installed${NC}"
        exit 1
    fi
    
    # Check environment variables
    if [ -z "$VAUTO_USERNAME" ] || [ -z "$VAUTO_PASSWORD" ]; then
        echo -e "${RED}Missing required environment variables: VAUTO_USERNAME and VAUTO_PASSWORD${NC}"
        exit 1
    fi
    
    # Check TypeScript
    if ! npx tsc --version &> /dev/null; then
        echo -e "${YELLOW}Installing TypeScript...${NC}"
        npm install -g typescript
    fi
    
    # Check dependencies
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}Installing dependencies...${NC}"
        npm install
    fi
    
    echo -e "${GREEN}Prerequisites check passed${NC}"
}

# Function to run with retry
run_with_retry() {
    local max_attempts=3
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        echo -e "${YELLOW}Attempt $attempt of $max_attempts${NC}"
        
        # Run the automation
        if npx ts-node scripts/run-mvp-end-to-end.ts 2>&1 | tee -a "$LOG_FILE"; then
            echo -e "${GREEN}Run completed successfully${NC}"
            return 0
        else
            echo -e "${RED}Run failed on attempt $attempt${NC}"
            send_notification "WARNING" "Run failed on attempt $attempt of $max_attempts"
            
            if [ $attempt -lt $max_attempts ]; then
                echo "Waiting 60 seconds before retry..."
                sleep 60
            fi
        fi
        
        attempt=$((attempt + 1))
    done
    
    return 1
}

# Function to generate summary report
generate_summary() {
    local report_files=$(ls -t "$REPORT_DIR"/mvp-report-*.json 2>/dev/null | head -5)
    
    if [ -z "$report_files" ]; then
        echo "No reports found"
        return
    fi
    
    echo -e "\n${YELLOW}=== Production Run Summary ===${NC}"
    
    local total_vehicles=0
    local total_success=0
    local total_failed=0
    local total_features=0
    local total_checkboxes=0
    
    for report in $report_files; do
        if [ -f "$report" ]; then
            vehicles=$(jq -r '.totalVehicles // 0' "$report" 2>/dev/null || echo 0)
            success=$(jq -r '.successful // 0' "$report" 2>/dev/null || echo 0)
            failed=$(jq -r '.failed // 0' "$report" 2>/dev/null || echo 0)
            features=$(jq -r '.totalFeaturesFound // 0' "$report" 2>/dev/null || echo 0)
            checkboxes=$(jq -r '.totalCheckboxesUpdated // 0' "$report" 2>/dev/null || echo 0)
            
            total_vehicles=$((total_vehicles + vehicles))
            total_success=$((total_success + success))
            total_failed=$((total_failed + failed))
            total_features=$((total_features + features))
            total_checkboxes=$((total_checkboxes + checkboxes))
        fi
    done
    
    echo "Total Vehicles Processed: $total_vehicles"
    echo "Successful: $total_success"
    echo "Failed: $total_failed"
    
    if [ $total_vehicles -gt 0 ]; then
        success_rate=$((total_success * 100 / total_vehicles))
        echo "Success Rate: ${success_rate}%"
    fi
    
    echo "Total Features Found: $total_features"
    echo "Total Checkboxes Updated: $total_checkboxes"
    
    # Send summary notification
    send_notification "INFO" "Run complete: $total_success/$total_vehicles vehicles processed (${success_rate}% success rate)"
}

# Main execution
main() {
    echo -e "${GREEN}=== VAuto MVP Production Runner ===${NC}"
    echo "Timestamp: $TIMESTAMP"
    echo "Log file: $LOG_FILE"
    
    # Check prerequisites
    check_prerequisites
    
    # Set production environment
    export NODE_ENV=production
    export HEADLESS=${HEADLESS:-true}
    export MAX_VEHICLES_TO_PROCESS=${MAX_VEHICLES:-100}
    export MAX_PAGES=${MAX_PAGES:-10}
    export SLOW_MO=${SLOW_MO:-1000}
    export LOG_LEVEL=${LOG_LEVEL:-info}
    export SCREENSHOT_ON_FAILURE=true
    
    echo -e "\n${YELLOW}Configuration:${NC}"
    echo "  HEADLESS: $HEADLESS"
    echo "  MAX_VEHICLES: $MAX_VEHICLES_TO_PROCESS"
    echo "  MAX_PAGES: $MAX_PAGES"
    echo "  SLOW_MO: $SLOW_MO"
    
    # Start monitoring in background
    echo -e "\n${YELLOW}Starting monitoring...${NC}"
    (
        while true; do
            # Check if process is still running
            if ! pgrep -f "run-mvp-end-to-end.ts" > /dev/null; then
                break
            fi
            
            # Monitor disk space
            disk_usage=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')
            if [ $disk_usage -gt 90 ]; then
                send_notification "WARNING" "Disk usage is at ${disk_usage}%"
            fi
            
            # Monitor memory
            if command -v free &> /dev/null; then
                mem_usage=$(free | awk 'NR==2 {print int($3/$2 * 100)}')
                if [ $mem_usage -gt 90 ]; then
                    send_notification "WARNING" "Memory usage is at ${mem_usage}%"
                fi
            fi
            
            sleep 300  # Check every 5 minutes
        done
    ) &
    MONITOR_PID=$!
    
    # Run the automation
    echo -e "\n${YELLOW}Starting automation...${NC}"
    send_notification "INFO" "Production run started with $MAX_VEHICLES_TO_PROCESS vehicles"
    
    if run_with_retry; then
        echo -e "${GREEN}Automation completed successfully!${NC}"
        EXIT_CODE=0
    else
        echo -e "${RED}Automation failed after all retries${NC}"
        send_notification "ERROR" "Production run failed after all retries"
        EXIT_CODE=1
    fi
    
    # Kill monitor
    kill $MONITOR_PID 2>/dev/null || true
    
    # Generate summary
    generate_summary
    
    # Cleanup old files (keep last 7 days)
    echo -e "\n${YELLOW}Cleaning up old files...${NC}"
    find "$LOG_DIR" -name "*.log" -mtime +7 -delete 2>/dev/null || true
    find "$SCREENSHOT_DIR" -name "*.png" -mtime +7 -delete 2>/dev/null || true
    find "$REPORT_DIR" -name "*.json" -mtime +30 -delete 2>/dev/null || true
    
    echo -e "\n${GREEN}Production run complete${NC}"
    exit $EXIT_CODE
}

# Handle interrupts
trap 'echo -e "\n${RED}Interrupted${NC}"; kill $MONITOR_PID 2>/dev/null || true; exit 130' INT TERM

# Run main
main "$@"