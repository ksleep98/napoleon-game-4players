# Auto Branch Cleanup System Test

## Purpose

This document serves as a test for the new GitHub MCP Server-based auto branch cleanup system implemented in PR #65.

## Test Scenario

1. Create feature branch: `feature/test-auto-cleanup-system`
2. Add this test documentation
3. Create PR to `develop`
4. Merge PR remotely
5. Verify local branch is automatically deleted

## Expected Behavior

After PR merge:

- Local `feature/test-auto-cleanup-system` branch should be automatically deleted
- Remote tracking branch should be cleaned up
- `develop` branch should be updated to latest
- Git post-merge hook should trigger cleanup script

## Auto Cleanup System Components

### Scripts Added

- `scripts/auto-branch-cleanup.js` - GitHub API integration
- `scripts/github-webhook-cleanup.js` - Webhook handler

### Commands Available

- `pnpm cleanup:auto` - Manual cleanup execution
- `pnpm cleanup:auto:schedule` - Scheduled cleanup with develop update

### Features Implemented

- ✅ GitHub API verification of merged PRs
- ✅ Safe local branch deletion (soft delete -> force delete fallback)
- ✅ Remote tracking branch cleanup
- ✅ Git post-merge hook integration
- ✅ Cron job setup for periodic cleanup
- ✅ Protection of base branches (main, develop)

## Test Date

Created: 2025-01-14

## Expected Outcome

This PR will test the complete workflow:

1. PR creation ✅
2. PR merge (manual step)
3. Auto branch cleanup (automatic)
4. Verification of cleanup success

If successful, this confirms the auto-cleanup system is working correctly.
