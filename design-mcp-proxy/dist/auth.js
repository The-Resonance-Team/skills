import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
/**
 * Read design token from env or ~/.claude/.credentials.json
 * Priority:
 * 1. CLAUDE_DESIGN_TOKEN env var
 * 2. .designOauth (separate design credential)
 * 3. .claudeAiOauth with design scopes
 */
export function loadDesignToken() {
    // Env var override
    if (process.env.CLAUDE_DESIGN_TOKEN) {
        return { accessToken: process.env.CLAUDE_DESIGN_TOKEN };
    }
    const credsPath = join(homedir(), '.claude', '.credentials.json');
    let creds;
    try {
        creds = JSON.parse(readFileSync(credsPath, 'utf-8'));
    }
    catch (err) {
        throw new Error(`Cannot read ${credsPath}: ${err}`);
    }
    // Try separate design credential first
    if (creds.designOauth?.accessToken) {
        return {
            accessToken: creds.designOauth.accessToken,
            refreshToken: creds.designOauth.refreshToken,
            expiresAt: creds.designOauth.expiresAt,
            scopes: creds.designOauth.scopes,
        };
    }
    // Fallback: main OAuth with design scopes
    if (creds.claudeAiOauth?.accessToken) {
        const scopes = creds.claudeAiOauth.scopes || [];
        const hasDesign = scopes.includes('user:design:read') && scopes.includes('user:design:write');
        if (hasDesign) {
            return {
                accessToken: creds.claudeAiOauth.accessToken,
                refreshToken: creds.claudeAiOauth.refreshToken,
                expiresAt: creds.claudeAiOauth.expiresAt,
                scopes,
            };
        }
    }
    throw new Error('No design token found. Run `/design-login` in Claude Code first.');
}
