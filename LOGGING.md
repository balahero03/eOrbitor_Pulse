# eOrbitor Pulse - Logging System

## Overview

The logging system automatically captures all development prompts, responses, and important data with timestamps. This creates a complete audit trail of the project's development history.

---

## Log Files Location

```
logs/chat_YYYY-MM-DD.txt
```

Example:
- `logs/chat_2026-05-25.txt` - Logs for May 25, 2026
- `logs/chat_2026-05-26.txt` - Logs for May 26, 2026

Each day gets its own file automatically.

---

## Log Entry Format

```
[ISO_TIMESTAMP] TYPE: Content
  Metadata: {...}
```

### Example Entries

```
[2026-05-25T14:00:00Z] PROMPT: Create login page with branding
[2026-05-25T14:00:01Z] RESPONSE: Login page created successfully
  Metadata: {"file": "app/(auth)/login/page.tsx", "features": ["logo", "form", "error-handling"]}

[2026-05-25T14:00:05Z] DATA: Database schema created
  Metadata: {"tables": 15, "models": ["User", "Lead", "Customer", "Deal", ...]}

[2026-05-25T14:00:10Z] ERROR: Failed to connect to database
  Metadata: {"code": "ECONNREFUSED", "port": 5432}

[2026-05-25T14:00:15Z] SYSTEM: Environment variables validated
  Metadata: {"env": "development", "variables": 8}
```

---

## Log Types

| Type | Usage | Example |
|------|-------|---------|
| `prompt` | User requests/instructions | "Create leads list page" |
| `response` | System responses/completions | "Page created successfully" |
| `data` | Important data points | Files created, configs, stats |
| `error` | Errors and issues | Connection failed, validation error |
| `system` | System events | Initialization, validation, setup |

---

## How to Use Logs

### View Today's Logs
```bash
cat logs/chat_2026-05-25.txt
```

### View Recent Entries
```bash
tail -50 logs/chat_2026-05-25.txt
```

### Search for Specific Topics
```bash
grep "PROMPT" logs/chat_2026-05-25.txt
grep "ERROR" logs/chat_2026-05-25.txt
grep "leads" logs/chat_2026-05-25.txt
```

### Filter by Type
```bash
# Show all prompts
grep "^\[.*\] PROMPT:" logs/chat_*.txt

# Show all errors
grep "^\[.*\] ERROR:" logs/chat_*.txt

# Show all data entries
grep "^\[.*\] DATA:" logs/chat_*.txt
```

### View Logs from Specific Date
```bash
cat logs/chat_2026-05-26.txt
```

---

## Logging API

Use the logger utilities to manually log important events:

```typescript
import { 
  logPrompt, 
  logResponse, 
  logData, 
  logError, 
  logSystem 
} from '@/lib/logger';

// Log user request
logPrompt('Create leads import feature', { 
  priority: 'high',
  estimatedTime: '2 hours' 
});

// Log system response
logResponse('Leads import feature completed', { 
  files: 1,
  time: '1.5 hours' 
});

// Log important data
logData('Database backup completed', { 
  size: '245 MB',
  duration: '30 seconds',
  timestamp: new Date().toISOString()
});

// Log errors
logError('Authentication failed for user', { 
  userId: 'usr_123',
  reason: 'invalid credentials',
  timestamp: new Date().toISOString()
});

// Log system events
logSystem('Application started', { 
  port: 3000,
  environment: 'development',
  timestamp: new Date().toISOString()
});
```

---

## Log Retention Policy

- **Automatic Organization:** Logs organized by date
- **No Automatic Deletion:** Logs are kept indefinitely
- **Manual Archival:** Archive old logs as needed
- **Backup:** Include logs in database backups for compliance

---

## Privacy & Security

⚠️ **Important Notes:**

1. **Sensitive Data:** Avoid logging passwords, API keys, or PII
2. **Metadata:** Use metadata field for context without exposing details
3. **Sanitization:** Always sanitize user input before logging
4. **Access:** Keep log files secure with appropriate file permissions

Example - Wrong:
```javascript
logData('User login', { password: 'abc123' }); // ❌ Don't do this!
```

Example - Right:
```javascript
logData('User login successful', { userId: 'usr_123' }); // ✅ Better
```

---

## Integration with Development Workflow

### When Starting New Features
```bash
# Check what was done previously
cat logs/chat_2026-05-25.txt | grep "PROMPT\|RESPONSE"

# Current date logs
tail -20 logs/chat_*.txt | sort -r
```

### When Debugging
```bash
# Find all errors from today
grep "ERROR" logs/chat_2026-05-25.txt

# Find errors with specific module
grep "ERROR" logs/chat_*.txt | grep "leads"

# Find when feature was implemented
grep -i "leads" logs/chat_*.txt | head -10
```

### When Handoff/Documentation
```bash
# Export development history
cat logs/chat_*.txt > project_history.txt

# Include in project documentation
# Reference logs for decision history and rationale
```

---

## Log Analysis Examples

### Find All Completed Tasks
```bash
grep "completed\|success\|✅" logs/chat_*.txt
```

### Track Development Timeline
```bash
# See what was done each day
for file in logs/chat_*.txt; do
  echo "=== $file ==="
  head -5 "$file"  # First entries of the day
  tail -5 "$file"  # Last entries of the day
done
```

### Count Development Activities
```bash
echo "Total Prompts: $(grep -c "PROMPT:" logs/chat_*.txt)"
echo "Total Responses: $(grep -c "RESPONSE:" logs/chat_*.txt)"
echo "Total Errors: $(grep -c "ERROR:" logs/chat_*.txt)"
echo "Total Data: $(grep -c "DATA:" logs/chat_*.txt)"
```

---

## Best Practices

1. **Log at Key Points**
   - Feature implementation start
   - Major milestones
   - Errors and issues
   - Configuration changes

2. **Use Descriptive Messages**
   - Clear, actionable descriptions
   - Include what was done (not just that it was done)
   - Add relevant context in metadata

3. **Organize with Metadata**
   - Use metadata for structured data
   - Include timestamps when relevant
   - Add file names, line numbers for debugging

4. **Regular Reviews**
   - Check logs daily for issues
   - Track progress against roadmap
   - Document decisions and rationale

5. **Maintain Chronological Order**
   - Logs are timestamped automatically
   - Don't manually edit timestamps
   - Keep entries in chronological order

---

## Example: Daily Development Log

```
[2026-05-25T09:00:00Z] SYSTEM: Developer starts work
[2026-05-25T09:00:15Z] PROMPT: Implement leads list with search and filter
[2026-05-25T09:15:00Z] DATA: Started leads module implementation
  Metadata: {"file": "app/(dashboard)/leads/page.tsx", "components": ["ListTable", "Filter"]}
[2026-05-25T10:30:00Z] RESPONSE: List component created with filter
[2026-05-25T10:30:15Z] PROMPT: Add pagination to leads list
[2026-05-25T11:00:00Z] RESPONSE: Pagination added (20 items per page)
[2026-05-25T11:00:30Z] ERROR: API endpoint not responding
  Metadata: {"endpoint": "/api/leads", "status": 503}
[2026-05-25T11:15:00Z] SYSTEM: Investigating API issues
[2026-05-25T11:30:00Z] RESPONSE: Fixed database connection timeout
[2026-05-25T12:00:00Z] DATA: All leads features completed
  Metadata: {"totalHours": 3, "filesChanged": 5, "tasksCompleted": 1}
[2026-05-25T12:00:30Z] PROMPT: Move to customers module implementation
[2026-05-25T12:00:45Z] SYSTEM: Switching development context
[2026-05-25T12:01:00Z] RESPONSE: Ready to implement customers module
```

---

## Viewing Full Development History

The logs create a complete project history:

```bash
# Full project history (all logs)
cat logs/chat_*.txt

# Timeline view (newest first)
cat logs/chat_*.txt | sort -r

# By module
grep -i "leads\|customer\|orders" logs/chat_*.txt

# By developer action
grep "PROMPT:" logs/chat_*.txt  # All requests
grep "RESPONSE:" logs/chat_*.txt  # All completions
grep "ERROR:" logs/chat_*.txt  # All issues
```

---

## Log File Maintenance

### Backup Logs
```bash
# Create backup of logs
tar -czf logs_backup_2026-05-25.tar.gz logs/

# Move to archive
mkdir -p archives/
mv logs_backup_2026-05-25.tar.gz archives/
```

### Cleanup Old Logs (if needed)
```bash
# Archive logs older than 30 days
find logs/ -name "chat_*.txt" -mtime +30 -exec gzip {} \;

# Delete archived logs older than 90 days
find logs/ -name "chat_*.txt.gz" -mtime +90 -delete
```

---

## Integration with CI/CD

Logs can be included in:
- Deployment artifacts
- Release notes (summary of changes)
- Incident reports (if issues occurred)
- Team documentation
- Knowledge base (decisions and solutions)

---

**Last Updated:** 2026-05-25  
**Version:** 1.0.0

For questions about logging, refer to `lib/logger.ts` implementation.
