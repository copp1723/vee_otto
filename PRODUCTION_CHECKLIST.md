# Production Deployment Checklist

## Pre-Deployment (One-Time Setup)

### Environment Setup
- [ ] Node.js 18+ installed
- [ ] Chrome/Chromium installed
- [ ] 4GB+ RAM available
- [ ] 10GB+ disk space available
- [ ] Stable internet connection

### Credentials & Configuration
- [ ] `VAUTO_USERNAME` set correctly
- [ ] `VAUTO_PASSWORD` set correctly  
- [ ] 2FA phone number configured
- [ ] Webhook URL configured (optional)
- [ ] Email notifications configured (optional)

### Initial Testing
- [ ] Run parsing logic test: `npx ts-node scripts/test-parsing-logic.ts`
- [ ] Test login manually: `HEADLESS=false MAX_VEHICLES=1 ./scripts/run-mvp.sh`
- [ ] Verify 2FA works
- [ ] Process 1 vehicle successfully
- [ ] Check JSON report generated correctly

## Daily Production Run

### Pre-Run Checks
- [ ] Check disk space: `df -h .` (need >2GB free)
- [ ] Check previous run logs for errors
- [ ] Verify internet connectivity
- [ ] Clear old screenshots if needed: `find screenshots/mvp -mtime +7 -delete`

### Run Configuration
```bash
# Standard production run (100 vehicles)
export VAUTO_USERNAME="Jcopp"
export VAUTO_PASSWORD="htu9QMD-wtkjpt6qak"
export HEADLESS=true
export MAX_VEHICLES=100
export MAX_PAGES=10

./scripts/run-production.sh
```

### During Run Monitoring
- [ ] Monitor dashboard in separate terminal: `npx ts-node scripts/monitor-dashboard.ts`
- [ ] Check for timeout errors
- [ ] Monitor success rate (should be >80%)
- [ ] Watch for selector failures

### Post-Run Verification
- [ ] Check final report in `reports/production/`
- [ ] Verify success rate meets expectations
- [ ] Review any failed vehicles
- [ ] Check if features are mapping correctly
- [ ] Verify checkboxes were actually updated in VAuto

## Troubleshooting Quick Reference

### Common Issues & Fixes

#### 1. Login Failures
```bash
# Clear session and retry
rm -rf session/*
HEADLESS=false MAX_VEHICLES=1 ./scripts/run-mvp.sh
```

#### 2. Timeout Errors
```bash
# Increase delays
export SLOW_MO=3000
export BROWSER_TIMEOUT=60000
```

#### 3. Selector Failures
```bash
# Run in headed mode to see issue
HEADLESS=false MAX_VEHICLES=1 ./scripts/run-mvp.sh
# Update selectors in platforms/vauto/vautoSelectors.ts
```

#### 4. Memory Issues
```bash
# Process fewer vehicles per run
export MAX_VEHICLES=25
# Clear old files
./scripts/error-recovery.ts
```

#### 5. Recovery from Failure
```bash
# Diagnose and recover
npx ts-node scripts/error-recovery.ts

# Resume from checkpoint
npx ts-node scripts/resume-from-checkpoint.ts
```

## Performance Metrics

### Target Metrics
- ✅ Login success rate: 100%
- ✅ Vehicle navigation: >95%  
- ✅ Factory Equipment access: >90%
- ✅ Feature extraction: >80% mapped
- ✅ Processing time: <3 min/vehicle

### Red Flags
- ❌ Success rate <70%
- ❌ Multiple timeout errors
- ❌ No checkboxes updating
- ❌ Session expiring repeatedly

## Maintenance Schedule

### Daily
- Check logs for errors
- Verify reports generated
- Monitor success rates

### Weekly  
- Clean up old screenshots/reports
- Review unmapped features
- Update feature mappings as needed
- Test selector stability

### Monthly
- Full system test with HEADLESS=false
- Update Node dependencies
- Review and optimize performance
- Backup important reports

## Emergency Contacts

### System Issues
- Check `DEVELOPER_HANDOFF_GUIDE.md`
- Run diagnostics: `npx ts-node scripts/error-recovery.ts`
- Review `QUICK_DEBUG_COMMANDS.md`

### Quick Commands
```bash
# Kill stuck process
pkill -f chromium

# Monitor in real-time
tail -f logs/production/*.log | grep -E "(ERROR|Success rate)"

# Generate summary report
cat reports/production/mvp-report-*.json | jq '{total: .totalVehicles, success: .successful}'
```

## Production Best Practices

1. **Start Small**: Begin each day with a test run of 5 vehicles
2. **Monitor Actively**: Keep dashboard open during runs
3. **Document Issues**: Log any new error patterns
4. **Update Mappings**: Add new feature mappings weekly
5. **Backup Reports**: Archive important reports monthly

## Sign-Off

- [ ] All tests passing
- [ ] Documentation reviewed
- [ ] Emergency procedures understood
- [ ] Monitoring tools working
- [ ] First production run successful

Ready for production! 🚀